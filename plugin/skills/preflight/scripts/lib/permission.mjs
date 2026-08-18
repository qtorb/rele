/**
 * Gate de permiso: READ ONLY antes de WRITE.
 *
 * Es la primera regla viva del proyecto y hasta ahora nadie la comprobaba. Un
 * brief que se declara READ ONLY y manda escribir es el mismo modo de fallo del
 * fixture 001: una instrucción incompatible viajando como si estuviera
 * autorizada.
 *
 * Módulo puro: sin red, sin git, sin LLM. Son patrones, como `claims`.
 *
 * Invariante vinculante: solo puede degradar. Ninguna entrada puede producir
 * PUEDE IR por su causa, porque solo emite SOSTENIDA cuando el texto declara
 * WRITE y además ordena escribir de verdad.
 */

import { CONTRADICHA, NO_COMPROBABLE, SOSTENIDA } from './verify.mjs'

export const READ_ONLY = 'READ ONLY'
export const WRITE = 'WRITE'

/** Cuántas líneas del principio cuentan como cabecera. */
const HEADER_LINES = 6

const READ_ONLY_RE = /\bREAD[\s_-]?ONLY\b/i
const WRITE_RE = /\bWRITE\b/i

/** Zona de la app y permiso que declara. `vuelta` no declara ninguno. */
const ZONE_PERMISSION = {
  lectura: READ_ONLY,
  escritura: WRITE,
  vuelta: null,
}

/**
 * Verbos que ordenan tocar el repositorio. Se buscan como palabra entera, para
 * no cazar un verbo dentro de otra palabra.
 */
const WRITE_VERBS = [
  'crea',
  'crear',
  'cree',
  'crees',
  'modifica',
  'modificar',
  'modifiques',
  'borra',
  'borrar',
  'borres',
  'elimina',
  'eliminar',
  'elimines',
  'renombra',
  'renombrar',
  'mueve',
  'mover',
  'escribe',
  'escribir',
  'anade',
  'anadir',
  'agrega',
  'agregar',
  'commitea',
  'commitear',
  'haz commit',
  'git commit',
  'empuja',
  'empujar',
  'git push',
  'fusiona',
  'fusionar',
  'git merge',
]

/** Marcas de negación. Si preceden al verbo en su cláusula, no es una orden. */
const NEGATIONS = [
  'no',
  'ni',
  'nunca',
  'jamas',
  'sin',
  'prohibido',
  'prohibida',
  'prohibe',
  'evita',
  'evitar',
]

/** Encabezados bajo los cuales los verbos de escritura son prohibiciones. */
const NO_TOUCH_HEADINGS = [
  'no se toca',
  'no se construye',
  'no se implementa',
  'no se toque',
  'que no',
  'lo que no',
  'fuera de alcance',
  'no implementado',
  'prohibido',
]

/** Quita acentos para comparar sin depender de cómo se escribió. */
function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function lines(text) {
  return String(text).split('\n')
}

/** Encabezado: numerado, con §, con # o línea corta casi toda en mayúsculas. */
function isHeading(line) {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^(§\s*\d|#{1,6}\s|\d+(\.\d+)*\.?\s+\S)/.test(trimmed)) return true

  const letters = trimmed.replace(/[^A-Za-zÀ-ɏ]/g, '')
  if (letters.length < 4 || trimmed.length > 90) return false
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '')
  return upper.length / letters.length >= 0.7
}

function isNoTouchHeading(line) {
  const folded = fold(line)
  return NO_TOUCH_HEADINGS.some((mark) => folded.includes(fold(mark)))
}

/**
 * El permiso que el texto declara en su cabecera, con la cita literal.
 * Si la cabecera nombra los dos, es ambigua y no declara nada.
 */
export function detectDeclaredPermission(text) {
  if (typeof text !== 'string') return null

  const candidates = lines(text)
    .filter((line) => line.trim())
    .slice(0, HEADER_LINES)

  for (const line of candidates) {
    const readOnly = READ_ONLY_RE.test(line)
    const write = WRITE_RE.test(line)
    if (!readOnly && !write) continue
    if (readOnly && write) return null
    return { permission: readOnly ? READ_ONLY : WRITE, quote: line.trim() }
  }

  return null
}

/**
 * Mira si el verbo va negado dentro de su frase.
 *
 * La negación gobierna hasta el punto, no hasta la coma: "prohibido crear
 * ramas, modificar ficheros o empujar commits" es una sola prohibición, y
 * cortarla por las comas dejaba sin negar todo menos el primer verbo.
 */
function isNegated(sentence, verbIndex) {
  const before = fold(sentence.slice(0, verbIndex))
  const words = before.split(/[^a-z]+/).filter(Boolean)
  return words.some((word) => NEGATIONS.includes(word))
}

/**
 * Órdenes de escritura que da el cuerpo. Se saltan las negadas y las que caen
 * bajo una sección de "qué no se toca": un brief READ ONLY bien escrito está
 * lleno de verbos negados, y marcarlos sería el falso positivo que apaga el
 * producto.
 */
export function detectWriteOrders(text) {
  if (typeof text !== 'string') return []

  const found = []
  let inNoTouchSection = false

  for (const line of lines(text)) {
    if (!line.trim()) continue

    if (isHeading(line)) {
      inNoTouchSection = isNoTouchHeading(line)
      continue
    }
    if (inNoTouchSection) continue

    for (const sentence of line.split(/[.;]/)) {
      const folded = fold(sentence)
      for (const verb of WRITE_VERBS) {
        const match = new RegExp(`\\b${verb}\\b`).exec(folded)
        if (!match) continue
        if (isNegated(sentence, match.index)) continue
        found.push({ verb, quote: line.trim() })
        break
      }
    }
  }

  return found
}

function verdict(bucket, { declared, breach, zone, repoSays }) {
  return {
    claim: {
      id: 'permiso-1',
      type: 'permiso',
      value: declared?.permission ?? 'sin declarar',
      quote: declared?.quote ?? '',
      breach: breach?.quote ?? '',
      zone: zone ?? null,
    },
    bucket,
    repoSays,
    // No hay comando: la prueba de este cubo son las dos citas literales.
    command: '',
    fact: bucket === SOSTENIDA ? 'declarado WRITE, coherente con lo que ordena' : null,
  }
}

/**
 * Devuelve cero o un veredicto. Se combina con los de `verifyClaims` en los
 * tres caminos; no vive dentro de la verificación del repo porque no toca el
 * repo.
 *
 * @param {string} text
 * @param {{zone?: 'lectura'|'escritura'|'vuelta'}} opciones
 */
export function permissionVerdicts(text, { zone } = {}) {
  try {
    if (typeof text !== 'string' || !text.trim()) return []

    const fromHeader = detectDeclaredPermission(text)
    const fromZone = zone ? (ZONE_PERMISSION[zone] ?? null) : null

    // Cabecera y zona en desacuerdo: ambiguo, y ante ambigüedad no se dice nada.
    if (fromHeader && fromZone && fromHeader.permission !== fromZone) return []

    const declared = fromHeader ?? (fromZone ? { permission: fromZone, quote: '' } : null)

    // Sin cabecera y sin zona no se adivina el permiso a partir del contenido.
    if (!declared) return []

    const orders = detectWriteOrders(text)

    if (!orders.length) {
      return [
        verdict(NO_COMPROBABLE, {
          declared,
          zone,
          repoSays: `El texto se declara ${declared.permission} y no ordena escribir.`,
        }),
      ]
    }

    if (declared.permission === WRITE) {
      return [
        verdict(SOSTENIDA, {
          declared,
          breach: orders[0],
          zone,
          repoSays: 'El texto se declara WRITE y ordena escribir: coherente.',
        }),
      ]
    }

    // READ ONLY que ordena escribir. Único caso que contradice, y solo se
    // reporta con las dos citas literales delante.
    const breach = orders[0]
    if (!declared.quote || !breach.quote) return []
    if (!text.includes(declared.quote) || !text.includes(breach.quote)) return []

    return [
      verdict(CONTRADICHA, {
        declared,
        breach,
        zone,
        repoSays: 'El texto se declara READ ONLY y sin embargo ordena escribir.',
      }),
    ]
  } catch {
    // Malformado o cabecera partida: no comprobable, nunca una excepción.
    return []
  }
}
