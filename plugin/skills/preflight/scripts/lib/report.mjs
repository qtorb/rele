/**
 * Formato de salida. Módulo puro.
 *
 * Castellano llano y sin vocabulario de método: quien lee esto quiere saber si
 * puede seguir, no aprender un dialecto.
 *
 * Regla vinculante de redacción: el plugin puede decir que no ha detectado
 * problemas, pero nunca sin denominador. Toda frase de ausencia lleva en la
 * misma línea el número de afirmaciones comprobadas. Y nunca se afirma nada
 * sobre el texto en su conjunto: el plugin habla de lo que comprobó.
 */

import { CONTRADICHA, NO_COMPROBABLE, SOSTENIDA } from './verify.mjs'

export const PARA = 'PARA'
export const PUEDE_IR = 'PUEDE IR'
export const SIN_AFIRMACIONES = 'SIN AFIRMACIONES COMPROBABLES'

const TYPE_LABEL = { branch: 'rama', pr: 'PR', path: 'ruta', commit: 'commit', permiso: 'permiso' }

/**
 * Concuerda un número con su sustantivo. Es el único mecanismo de plural del
 * plugin: la línea de cuenta del registro también tira de aquí.
 */
export function plural(count, singular, many) {
  return `${count} ${count === 1 ? singular : many}`
}

/**
 * Señal global, derivada mecánicamente de los cubos.
 * Una NO COMPROBABLE nunca empeora la señal: el silencio ante lo desconocido
 * es la decisión de diseño, no una carencia.
 */
export function globalSignal(verdicts) {
  const list = verdicts ?? []
  if (list.some((item) => item.bucket === CONTRADICHA)) return PARA
  if (list.some((item) => item.bucket === SOSTENIDA)) return PUEDE_IR
  return SIN_AFIRMACIONES
}

export function counts(verdicts) {
  const list = verdicts ?? []
  return {
    contradichas: list.filter((item) => item.bucket === CONTRADICHA).length,
    sostenidas: list.filter((item) => item.bucket === SOSTENIDA).length,
    noComprobables: list.filter((item) => item.bucket === NO_COMPROBABLE).length,
  }
}

/** Línea corta del recibo: solo el hecho, sin comando y sin cita. */
function receiptLine(item) {
  const label = TYPE_LABEL[item.claim.type] ?? item.claim.type
  const value = item.claim.type === 'pr' ? `#${item.claim.value}` : item.claim.value
  return `- ${label} ${value} ${item.fact ?? 'comprobado'}`
}

export function formatReport(verdicts, { countLine = null } = {}) {
  const list = verdicts ?? []
  const signal = globalSignal(list)
  const { contradichas, sostenidas, noComprobables } = counts(list)

  // Comprobadas = las que realmente se pudieron verificar. Las no comprobables
  // no cuentan como prueba de nada, así que no entran en el denominador.
  const checked = contradichas + sostenidas

  const lines = []

  // 1 · Señal. La frase de ausencia solo aparece con su denominador al lado.
  if (signal === PUEDE_IR) {
    const articulo = checked === 1 ? 'la' : 'las'
    const cuantas = plural(checked, 'afirmación comprobada', 'afirmaciones comprobadas')
    lines.push(`${PUEDE_IR} · sin contradicciones en ${articulo} ${cuantas}`)
  } else {
    lines.push(signal)
  }
  lines.push('')

  // 2 · Contradicciones, en detalle.
  const contradicted = list.filter((item) => item.bucket === CONTRADICHA)
  contradicted.forEach((item, index) => {
    lines.push(`${index + 1}. «${item.claim.quote}»`)
    if (item.claim.type === 'permiso') {
      // El permiso no se prueba con un comando sino con la instrucción
      // que rompe la cabecera: por eso van las dos citas literales.
      lines.push(`   Y sin embargo: «${item.claim.breach}»`)
      lines.push(`   ${item.repoSays}`)
    } else {
      lines.push(`   El repo dice: ${item.repoSays}`)
      lines.push(`   Comprobado con: ${item.command}`)
    }
    lines.push('')
  })

  // 3 · Sostenidas, una línea cada una. El detalle largo sigue siendo
  // exclusivo de las contradicciones.
  const sustained = list.filter((item) => item.bucket === SOSTENIDA)
  if (sustained.length) {
    lines.push(`Sostenidas (${sustained.length}):`)
    sustained.forEach((item) => lines.push(receiptLine(item)))
    lines.push('')
  }

  // Cero afirmaciones: no se usa frase de ausencia. Un recibo de cero no es un
  // aprobado.
  if (!list.length) {
    lines.push('No se ha encontrado en el texto nada que git o gh puedan comprobar.')
    lines.push('')
  }

  // 4 · Recuento de no comprobables, y debajo la cuenta del registro.
  lines.push(`${sostenidas} sostenidas · ${noComprobables} no comprobables`)

  if (countLine) {
    lines.push('')
    lines.push(countLine)
  }

  return lines.join('\n')
}
