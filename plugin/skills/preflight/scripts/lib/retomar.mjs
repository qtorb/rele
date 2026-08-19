/**
 * Retomar: «¿por dónde iba en este proyecto?»
 *
 * El estado no se guarda al salir de una sesión: se calcula al llegar a la
 * siguiente. Nada caduca porque nada se almacena.
 *
 * Dos bloques con frontera estructural, no tipográfica. Lo comprobado ahora, y
 * lo que alguien dijo y nadie ha verificado. Sin niveles intermedios: no existe
 * «probablemente cierto».
 *
 * Este módulo no escribe: ni en el repositorio analizado, ni en el registro.
 * Pedir el estado es una lectura, no una corrida.
 */

import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

export const CABECERA_COMPROBADO = '=== COMPROBADO AHORA ==='
export const CABECERA_DICHO = '=== DICHO · SIN COMPROBAR ==='
export const MARCA_ENCARGO_INICIO = '--- encargo aportado ---'
export const MARCA_ENCARGO_FIN = '--- fin del encargo ---'

/** Prefijo visible de neutralización. Declarado en SKILL.md. */
export const PREFIJO_NEUTRALIZADO = '! '

/** Presupuesto duro para toda la recolección. */
export const BUDGET_MS = 3000

const RESERVADAS = [CABECERA_COMPROBADO, CABECERA_DICHO, MARCA_ENCARGO_INICIO, MARCA_ENCARGO_FIN]

/**
 * ¿Esta línea puede hacerse pasar por una cabecera o por una marca de encargo?
 * También cuenta la que ya lleva el prefijo: si no, la neutralización sería
 * imitable en dos pasadas.
 */
function imita(linea) {
  const t = String(linea).trim()
  if (t.startsWith(PREFIJO_NEUTRALIZADO.trim())) return true
  return RESERVADAS.some((marca) => t === marca || t.startsWith(marca))
}

/** Neutraliza un texto de varias líneas: el encargo. */
export function neutralizar(texto) {
  return String(texto)
    .split('\n')
    .map((linea) => (imita(linea) ? PREFIJO_NEUTRALIZADO + linea : linea))
    .join('\n')
}

/**
 * Tapa credenciales antes de imprimir. El bloque comprobado no lleva tokens ni
 * URLs con autenticación; el encargo es del usuario y no se filtra.
 */
export function sinCredenciales(valor) {
  return String(valor ?? '')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*:[^\s/@]*@/gi, '$1…@')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{6,}\b/g, '…')
    .replace(/\b(token|password|secret)=\S+/gi, '$1=…')
}

/** Neutraliza un valor suelto: nombre de directorio, de rama, título de PR. */
export function neutralizarValor(valor) {
  const v = String(valor ?? '')
  return imita(v) ? PREFIJO_NEUTRALIZADO + v : v
}

/** Envuelve el runner con un plazo. Lo que no llega a tiempo, no sale. */
function conPlazo(run, now, limite) {
  return (cmd, args) => {
    if (now() > limite) return { ok: false, stdout: '', code: 1, agotado: true }
    const r = run(cmd, args)
    if (now() > limite) return { ok: false, stdout: '', code: 1, agotado: true }
    return r
  }
}

function contarLineas(salida) {
  return String(salida).split('\n').filter((l) => l.trim()).length
}

/** Sello local legible, no ISO: lo lee una persona. */
function selloLocal(fecha) {
  const dos = (n) => String(n).padStart(2, '0')
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ` +
    `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`
  )
}

/**
 * Recoge los hechos. Primero disco, `gh` al final: es red, y si se come el
 * presupuesto primero se pierden las líneas baratas.
 *
 * Cada hecho es `{ valor, fuente }` o `undefined` si su fuente no respondió.
 * Esa diferencia es la regla de §2.3: valor cero sale, fuente ausente no.
 */
function recoger({ run, repoPath, leerPackage }) {
  const h = {}

  h.proyecto = { valor: basename(repoPath), fuente: 'nombre del directorio' }

  const rama = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (rama.ok) {
    const nombre = rama.stdout.trim()
    h.rama = {
      valor: nombre === 'HEAD' ? 'ninguna, el repositorio está en un commit suelto' : nombre,
      fuente: 'git rev-parse --abbrev-ref HEAD',
    }
  }

  const commit = run('git', ['rev-parse', '--short', 'HEAD'])
  if (commit.ok && commit.stdout.trim()) {
    h.commit = { valor: commit.stdout.trim(), fuente: 'git rev-parse --short HEAD' }
  }

  const version = leerPackage(repoPath)
  // La fuente NO se anota como `package.json`: ese token lo extrae `claims`
  // como afirmación de ruta, y entonces la línea parecería comprobar la
  // versión cuando solo comprobaría que el fichero existe.
  if (version) h.version = { valor: version, fuente: 'package del proyecto, campo version' }

  const remoto = run('git', ['rev-list', '--count', '--left-right', '@{u}...HEAD'])
  if (remoto.ok && /\d+\s+\d+/.test(remoto.stdout)) {
    const [detras, delante] = remoto.stdout.trim().split(/\s+/).map(Number)
    const partes = []
    if (delante) partes.push(`${delante} ${delante === 1 ? 'commit' : 'commits'} por delante del remoto`)
    if (detras) partes.push(`${detras} por detrás`)
    h.remoto = {
      valor: partes.length ? partes.join(', ') : 'nada, al mismo punto que el remoto',
      fuente: 'git rev-list --count',
    }
  }

  const sucio = run('git', ['status', '--porcelain'])
  if (sucio.ok) {
    const n = contarLineas(sucio.stdout)
    h.sinGuardar = {
      valor: n === 0 ? 'ninguno' : `${n} ${n === 1 ? 'fichero modificado' : 'ficheros modificados'}`,
      fuente: 'git status --porcelain',
    }
  }

  const stash = run('git', ['stash', 'list'])
  if (stash.ok) {
    const n = contarLineas(stash.stdout)
    h.stash = { valor: n === 0 ? 'ninguno' : `${n} ${n === 1 ? 'stash' : 'stashes'}`, fuente: 'git stash list' }
  }

  // `gh` al final: es la única fuente de red.
  if (run('gh', ['--version']).ok) {
    const prs = run('gh', ['pr', 'list', '--state', 'open', '--json', 'number,title'])
    if (prs.ok) {
      let lista = []
      try {
        lista = JSON.parse(prs.stdout || '[]')
      } catch {
        lista = []
      }
      h.prs = {
        valor: lista.length === 0 ? 'ninguno' : String(lista.length),
        // El título es valor externo: se neutraliza antes de componer la línea.
        detalle: lista.map((pr) => ({ numero: pr.number, titulo: pr.title })),
        fuente: 'gh pr list',
      }
    }

    const rel = run('gh', ['release', 'list', '--limit', '1'])
    if (rel.ok) {
      const primera = String(rel.stdout).split('\n').find((l) => l.trim())
      h.release = {
        valor: primera ? primera.split('\t')[0].trim() : 'ninguna',
        fuente: 'gh release list',
      }
    }
  }

  return h
}

/** Una línea del bloque comprobado, con su fuente anotada. Nunca sin ella. */
function linea(etiqueta, hecho) {
  if (!hecho) return null
  return `${etiqueta}: ${neutralizarValor(sinCredenciales(hecho.valor))}   (${hecho.fuente})`
}

/**
 * Compone la salida. El orden de impresión es fijo y no depende del orden en
 * que se hayan resuelto las fuentes.
 */
function componer({ hechos, ahora, encargo, corridas }) {
  const out = [CABECERA_COMPROBADO]

  out.push(`generado: ${selloLocal(ahora)}   (reloj local)`)

  for (const [etiqueta, hecho] of [
    ['proyecto', hechos.proyecto],
    ['rama', hechos.rama],
    ['último commit', hechos.commit],
    ['versión', hechos.version],
    ['sin subir', hechos.remoto],
    ['sin guardar', hechos.sinGuardar],
    ['guardados aparte', hechos.stash],
    ['PRs abiertos', hechos.prs],
    ['última release', hechos.release],
  ]) {
    const l = linea(etiqueta, hecho)
    if (l) out.push(l)
    if (etiqueta === 'PRs abiertos' && hecho?.detalle?.length) {
      for (const pr of hecho.detalle) {
        out.push(`  #${pr.numero} ${neutralizarValor(sinCredenciales(pr.titulo))}`)
      }
    }
  }

  out.push('', CABECERA_DICHO, '')

  if (encargo !== null && encargo !== undefined) {
    out.push(MARCA_ENCARGO_INICIO, neutralizar(encargo), MARCA_ENCARGO_FIN, '')
  }

  if (corridas?.length) {
    out.push('últimas 3 corridas de Relé en este proyecto:')
    for (const c of corridas) out.push(`  ${neutralizarValor(c)}`)
  }

  return out.join('\n').replace(/\n+$/, '') + '\n'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Resumen mecánico de una corrida del registro. Sin adjetivos. */
function resumirCorrida(entrada) {
  const f = new Date(entrada.fecha)
  const dos = (n) => String(n).padStart(2, '0')
  const cuando = Number.isNaN(f.getTime())
    ? '(fecha ilegible)'
    : `${f.getDate()} ${MESES[f.getMonth()]} ${dos(f.getHours())}:${dos(f.getMinutes())}`

  const afirmaciones = Array.isArray(entrada.afirmaciones) ? entrada.afirmaciones : []
  const contradichas = afirmaciones.filter((a) => a && a.cubo === 'CONTRADICHA')
  const sostenidas = afirmaciones.filter((a) => a && a.cubo === 'SOSTENIDA').length

  let cola
  if (contradichas.length) {
    const n = contradichas.length
    cola = `${n} ${n === 1 ? 'contradicción' : 'contradicciones'}`
  } else if (sostenidas) {
    cola = `${sostenidas} ${sostenidas === 1 ? 'afirmación comprobada' : 'afirmaciones comprobadas'}`
  } else {
    cola = 'sin afirmaciones comprobables'
  }

  return `${cuando} · ${entrada.senal ?? 'sin señal'} · ${cola}`
}

/** Lee el registro y devuelve las tres últimas corridas de este repositorio. */
export function ultimasCorridas(repoPath, leerRegistro) {
  try {
    const crudo = leerRegistro()
    if (!crudo) return []
    const objetivo = String(repoPath).replace(/[\\/]+$/, '').toLowerCase()

    const suyas = []
    for (const l of String(crudo).split('\n')) {
      if (!l.trim()) continue
      try {
        const e = JSON.parse(l)
        if (String(e.repo ?? '').replace(/[\\/]+$/, '').toLowerCase() === objetivo) suyas.push(e)
      } catch {
        // Línea corrupta: se salta, las demás se leen.
      }
    }
    return suyas.slice(-3).reverse().map(resumirCorrida)
  } catch {
    return []
  }
}

function leerPackagePorDefecto(repoPath) {
  try {
    const p = JSON.parse(readFileSync(join(repoPath, 'package.json'), 'utf8'))
    return typeof p.version === 'string' ? p.version : null
  } catch {
    return null
  }
}

/** ¿Este texto es una salida de `retomar`? Sirve para marcarlo en el registro. */
export function esSalidaDeEstado(texto) {
  return typeof texto === 'string' && texto.includes(CABECERA_COMPROBADO)
}

/**
 * La función única. La llaman el comando y el botón de la app.
 *
 * @returns {{ok: true, salida: string} | {ok: false, error: string}}
 */
export function retomar({
  repoPath,
  encargo = null,
  run,
  now = Date.now,
  ahora = new Date(),
  leerRegistro = () => null,
  leerPackage = leerPackagePorDefecto,
  budgetMs = BUDGET_MS,
} = {}) {
  if (typeof repoPath !== 'string' || !repoPath.trim()) {
    return { ok: false, error: 'Falta la carpeta del proyecto.' }
  }

  const guarded = conPlazo(run, now, now() + budgetMs)

  if (!guarded('git', ['rev-parse', '--is-inside-work-tree']).ok) {
    return { ok: false, error: 'Esa carpeta no es un repositorio git.' }
  }

  const hechos = recoger({ run: guarded, repoPath, leerPackage })
  const corridas = ultimasCorridas(repoPath, leerRegistro)

  return { ok: true, salida: componer({ hechos, ahora, encargo, corridas }) }
}
