/**
 * Formato de salida. Módulo puro.
 *
 * Castellano llano y sin vocabulario de método: quien lee esto quiere saber si
 * puede seguir, no aprender un dialecto.
 */

import { CONTRADICHA, NO_COMPROBABLE, SOSTENIDA } from './verify.mjs'

export const PARA = 'PARA'
export const PUEDE_IR = 'PUEDE IR'
export const SIN_AFIRMACIONES = 'SIN AFIRMACIONES COMPROBABLES'

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

export function formatReport(verdicts) {
  const list = verdicts ?? []
  const signal = globalSignal(list)
  const { sostenidas, noComprobables } = counts(list)
  const lines = [signal, '']

  const contradicted = list.filter((item) => item.bucket === CONTRADICHA)

  if (contradicted.length) {
    contradicted.forEach((item, index) => {
      lines.push(`${index + 1}. «${item.claim.quote}»`)
      lines.push(`   El repo dice: ${item.repoSays}`)
      lines.push(`   Comprobado con: ${item.command}`)
      lines.push('')
    })
  } else if (signal === PUEDE_IR) {
    lines.push('Nada de lo que el texto afirma sobre el repo lo contradice el repo.')
    lines.push('')
  } else {
    lines.push('No hay nada en el texto que se pueda comprobar contra el repo.')
    lines.push('')
  }

  lines.push(`${sostenidas} sostenidas · ${noComprobables} no comprobables`)

  return lines.join('\n')
}
