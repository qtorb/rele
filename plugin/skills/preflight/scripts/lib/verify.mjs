/**
 * Verificación de afirmaciones contra el repo.
 *
 * Toda ejecución externa pasa por una única función `run`, inyectable, para
 * poder testear con un doble y sin repo. Este módulo no escribe nada: solo
 * lecturas de git/gh.
 */

import { execFileSync } from 'node:child_process'

export const SOSTENIDA = 'SOSTENIDA'
export const CONTRADICHA = 'CONTRADICHA'
export const NO_COMPROBABLE = 'NO_COMPROBABLE'

const PR_STATE_ES = { OPEN: 'abierto', MERGED: 'fusionado', CLOSED: 'cerrado' }

/** Runner real. Nunca lanza: un fallo es un resultado, no una excepción. */
export function nodeRunner(cwd = process.cwd()) {
  return (cmd, args) => {
    try {
      const stdout = execFileSync(cmd, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, stdout: stdout ?? '', code: 0 }
    } catch (error) {
      return { ok: false, stdout: error.stdout ?? '', stderr: error.stderr ?? '', code: error.status ?? 1 }
    }
  }
}

function display(cmd, args) {
  return [cmd, ...args].join(' ')
}

/**
 * `fact` es la forma corta para el recibo: solo el hecho comprobado, sin
 * sujeto ni comando. El detalle largo sigue siendo exclusivo de las
 * contradicciones.
 */
function verdict(claim, bucket, repoSays, command, fact = null) {
  return { claim, bucket, repoSays, command, fact }
}

function verifyBranch(claim, { run }) {
  const localArgs = ['branch', '-a', '--list', claim.value]
  const local = run('git', localArgs)
  let exists = local.ok && local.stdout.trim().length > 0
  let command = display('git', localArgs)

  if (!exists) {
    const remoteArgs = ['ls-remote', '--heads', 'origin', claim.value]
    const remote = run('git', remoteArgs)
    if (remote.ok) {
      exists = remote.stdout.trim().length > 0
      command = display('git', remoteArgs)
    }
  }

  if (claim.assertion === 'create') {
    return exists
      ? verdict(claim, CONTRADICHA, `La rama ${claim.value} ya existe.`, command)
      : verdict(claim, SOSTENIDA, `La rama ${claim.value} no existe todavía.`, command, 'no existe todavía')
  }

  if (claim.assertion === 'exists') {
    return exists
      ? verdict(claim, SOSTENIDA, `La rama ${claim.value} existe.`, command, 'existe')
      : verdict(claim, CONTRADICHA, `La rama ${claim.value} no existe.`, command)
  }

  // Mención suelta: si existe, lo confirmamos. Si no, callamos: nombrar una
  // rama no es afirmar que esté.
  return exists
    ? verdict(claim, SOSTENIDA, `La rama ${claim.value} existe.`, command, 'existe')
    : verdict(claim, NO_COMPROBABLE, 'La rama se menciona sin afirmar si existe.', command)
}

function verifyPr(claim, { run, ghAvailable }) {
  const args = ['pr', 'view', claim.value, '--json', 'state,headRefName,baseRefName']
  const command = display('gh', args)

  if (!ghAvailable) {
    return verdict(claim, NO_COMPROBABLE, 'gh no está disponible en este entorno.', command)
  }

  const result = run('gh', args)
  if (!result.ok) {
    return verdict(claim, CONTRADICHA, `No hay ningún PR #${claim.value} accesible.`, command)
  }

  let data
  try {
    data = JSON.parse(result.stdout)
  } catch {
    return verdict(claim, NO_COMPROBABLE, 'gh devolvió una respuesta ilegible.', command)
  }

  const state = String(data.state ?? '').toUpperCase()
  const isOpen = state === 'OPEN'

  if (claim.prState === 'closed' && isOpen) {
    return verdict(claim, CONTRADICHA, `El PR #${claim.value} sigue abierto (state: ${state}).`, command)
  }
  if (claim.prState === 'open' && !isOpen) {
    return verdict(claim, CONTRADICHA, `El PR #${claim.value} no está abierto (state: ${state}).`, command)
  }

  const estado = PR_STATE_ES[state] ?? state.toLowerCase()
  const base = data.baseRefName ? ` contra ${data.baseRefName}` : ''
  return verdict(claim, SOSTENIDA, `El PR #${claim.value} existe (state: ${state}).`, command, `${estado}${base}`)
}

/**
 * Las rutas se leen por intención, igual que las ramas. Solo una ruta que el
 * texto afirma existente puede contradecir: una que pide crearse describe
 * trabajo por hacer, y una mención suelta no afirma nada.
 */
function verifyPath(claim, { run, baseRef }) {
  const args = ['cat-file', '-e', `${baseRef}:${claim.value}`]
  const command = display('git', args)

  if (claim.pathIntent === 'create') {
    // Aparcado a propósito: redactar "crea X" cuando X ya existe a medias es
    // demasiado frecuente para tratarlo como alarma. Podría cambiar; hoy no.
    return verdict(
      claim,
      NO_COMPROBABLE,
      `El texto pide crear ${claim.value}; no afirma que ya esté.`,
      command,
    )
  }

  if (claim.pathIntent !== 'exists') {
    return verdict(claim, NO_COMPROBABLE, `${claim.value} se menciona sin afirmar que exista.`, command)
  }

  const exists = run('git', args).ok
  return exists
    ? verdict(claim, SOSTENIDA, `${claim.value} existe en ${baseRef}.`, command, `existe en ${baseRef}`)
    : verdict(claim, CONTRADICHA, `${claim.value} no existe en ${baseRef}.`, command)
}

function verifyCommit(claim, { run }) {
  const args = ['cat-file', '-e', `${claim.value}^{commit}`]
  const command = display('git', args)
  return run('git', args).ok
    ? verdict(claim, SOSTENIDA, `El commit ${claim.value} existe.`, command, 'existe')
    : verdict(claim, CONTRADICHA, `El commit ${claim.value} no existe en este repo.`, command)
}

/**
 * @param {Array} claims
 * @param {{run: Function, text: string, baseRef?: string}} deps
 */
export function verifyClaims(claims, { run, text, baseRef = 'HEAD' }) {
  // Regla de evidencia: sin cita literal recuperable, la afirmación no se
  // reporta. Se filtra aquí y no más tarde para que nada sin prueba llegue a
  // contar hacia la señal.
  const usable = (claims ?? []).filter(
    (claim) => claim && typeof claim.quote === 'string' && claim.quote.trim() && text.includes(claim.quote),
  )

  const ghAvailable = run('gh', ['--version']).ok
  const deps = { run, baseRef, ghAvailable }

  return usable.map((claim) => {
    switch (claim.type) {
      case 'branch':
        return verifyBranch(claim, deps)
      case 'pr':
        return verifyPr(claim, deps)
      case 'path':
        return verifyPath(claim, deps)
      case 'commit':
        return verifyCommit(claim, deps)
      default:
        return verdict(claim, NO_COMPROBABLE, 'Tipo de afirmación no soportado en v1.', '')
    }
  })
}
