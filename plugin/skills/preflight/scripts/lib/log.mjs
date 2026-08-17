/**
 * Registro de corridas.
 *
 * El plugin está sesgado al silencio por diseño: las falsas alarmas se ven, los
 * fallos por omisión no. Un fallo por omisión solo se reconoce en retrospectiva,
 * así que aquí no se detecta nada: se deja constancia para poder auditarlo
 * después.
 *
 * Es telemetría, nunca load-bearing. Ningún fallo de escritura o de lectura
 * puede romper la corrida ni cambiar la señal. Todo va envuelto en try/catch y
 * degrada a "no hay registro".
 *
 * Se escribe en el directorio de datos del usuario, NUNCA en el repo analizado:
 * la invariante de cero escrituras de F2-W1 se mantiene intacta.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const DISABLE_ENV = 'RELE_NO_LOG'
export const PATH_ENV = 'RELE_LOG_PATH'

/** Adaptador de disco, inyectable para poder testear sin tocar el sistema. */
export const nodeIo = {
  read: (path) => readFileSync(path, 'utf8'),
  append: (path, contents) => appendFileSync(path, contents, 'utf8'),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
}

export function defaultLogPath(env = process.env) {
  if (env[PATH_ENV]) return env[PATH_ENV]
  return join(homedir(), '.rele', 'preflight-log.jsonl')
}

export function loggingDisabled(env = process.env) {
  const value = env[DISABLE_ENV]
  if (!value) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false'
}

export function buildEntry({ date, repo, branch, signal, text, verdicts, version }) {
  return {
    fecha: date,
    repo,
    rama: branch,
    senal: signal,
    version_plugin: version,
    texto: text,
    afirmaciones: (verdicts ?? []).map((item) => ({
      cita: item.claim.quote,
      tipo: item.claim.type,
      cubo: item.bucket,
      intencion: item.claim.pathIntent ?? item.claim.assertion ?? null,
      comando: item.command,
    })),
  }
}

/**
 * Anexa una línea. Devuelve true solo si se escribió.
 * Nunca lanza: un destino no escribible es un false, no una excepción.
 */
export function appendRun(entry, { path, env = process.env, io = nodeIo } = {}) {
  if (loggingDisabled(env)) return false
  try {
    io.mkdir(dirname(path))
    io.append(path, `${JSON.stringify(entry)}\n`)
    return true
  } catch {
    return false
  }
}

/**
 * Lee el registro y devuelve el total de corridas y a cuántas queda la última
 * contradicción. Las líneas ilegibles se saltan sin ruido; si no queda ninguna
 * legible, devuelve null y la línea de cuenta se omitirá entera.
 */
export function readStats(path, io = nodeIo) {
  let raw
  try {
    raw = io.read(path)
  } catch {
    return null
  }

  const runs = []
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (parsed && typeof parsed === 'object') runs.push(parsed)
    } catch {
      // Línea corrupta: se salta. Ni impide contar ni impide anexar después.
    }
  }

  if (!runs.length) return null

  let lastContradiction = null
  runs.forEach((run, index) => {
    const contradicted = Array.isArray(run.afirmaciones)
      ? run.afirmaciones.some((item) => item && item.cubo === 'CONTRADICHA')
      : false
    if (contradicted) lastContradiction = index + 1
  })

  return { total: runs.length, lastContradiction }
}

/**
 * Un dato, no una alarma: sin umbral, sin color, sin recomendación. Si N
 * corridas sin contradicción es mucho o poco lo juzga la persona.
 */
export function countLine(stats) {
  if (!stats) return null
  const distance =
    stats.lastContradiction === null
      ? 'ninguna'
      : `hace ${stats.total - stats.lastContradiction} corridas`
  return `corridas: ${stats.total} · última contradicción: ${distance}`
}
