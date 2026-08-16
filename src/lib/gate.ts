import { buildHandoff } from './handoff'
import { SIGNAL_COPY } from './signals'
import { MOTIVES, applyGates } from '../rules/evidence'
import type { GateMotive } from '../rules/evidence'
import type { Analysis, ProjectPack } from '../types'

const EXPLANATION: Record<GateMotive, string> = {
  [MOTIVES.noEvidence]:
    'El motor devolvió una señal sin citar ninguna prueba del texto pegado. Sin prueba no hay señal.',
  [MOTIVES.unverifiable]:
    'La cita que justificaba la señal no aparece en el texto pegado. Puede estar inventada, así que la señal no se muestra.',
  [MOTIVES.malformed]:
    'La salida del extractor no tiene la forma esperada, así que no hay señal que mostrar.',
  [MOTIVES.stale]:
    'El Project Pack lleva 5 relays sin actualizarse. Un mapa así ya no sirve para decidir, diga lo que diga la pieza.',
}

const NEXT_ACTION: Record<GateMotive, string> = {
  [MOTIVES.noEvidence]: 'Revisa la pieza a mano o vuelve a analizarla. Relé no muestra una señal que no puede probar.',
  [MOTIVES.unverifiable]: 'Contrasta la cita contra el texto pegado antes de fiarte de nada. Vuelve a analizar.',
  [MOTIVES.malformed]: 'Vuelve a analizar. Si se repite, revisa el extractor.',
  [MOTIVES.stale]: 'Actualiza el Project Pack —edítalo o acepta una propuesta— y vuelve a analizar.',
}

/**
 * Aplica las puertas a la salida de cualquier motor, demo o real.
 * `rawResponse` se conserva intacto a propósito: el corpus de desacuerdo debe
 * guardar lo que dijo el motor, no lo que Relé acabó mostrando.
 */
export function gateAnalysis(analysis: Analysis, pastedText: string, relayCount: number, pack: ProjectPack): Analysis {
  const verdict = applyGates(
    { signal: analysis.signal, evidencia: analysis.evidencia },
    pastedText,
    relayCount,
  )

  if (!verdict.degraded) {
    return { ...analysis, signal: verdict.signal, evidencia: verdict.evidencia, motive: null }
  }

  const motive = verdict.motive as GateMotive
  const degraded: Omit<Analysis, 'handoff'> = {
    ...analysis,
    signal: verdict.signal,
    evidencia: verdict.evidencia,
    motive,
    can_advance: false,
    can_start_write: false,
    next_seat: SIGNAL_COPY.FALTA_MAPA.seat,
    explanation: EXPLANATION[motive],
    next_action: NEXT_ACTION[motive],
    what_blocks: [`Señal degradada por Relé: ${motive}.`, ...analysis.what_blocks],
  }

  return { ...degraded, handoff: buildHandoff(degraded, pack) }
}
