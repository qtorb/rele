import { SIGNAL_COPY } from './signals'
import type { Analysis, ProjectPack } from '../types'

function bullets(items: string[], fallback = '- (ninguno detectado)') {
  if (!items.length) return fallback
  return items.map((item) => `- ${item}`).join('\n')
}

/**
 * Texto listo para pegar en el siguiente asiento.
 * Relé no envía nada: solo prepara la pieza para que Albert la mueva.
 */
export function buildHandoff(analysis: Omit<Analysis, 'handoff'>, pack: ProjectPack): string {
  const copy = SIGNAL_COPY[analysis.signal]
  const front = analysis.front.length ? analysis.front.join(', ') : 'no detectado'

  const header = [
    `PARA ${analysis.next_seat.toUpperCase()} — ${copy.label}`,
    '',
    `Proyecto: ${pack.project || 'sin declarar'}`,
    `Destino: ${pack.destination || 'sin declarar'}`,
    `Waypoint actual: ${pack.currentWaypoint || 'sin declarar'}`,
    `Frente: ${front}`,
    `Tipo de pieza: ${analysis.input_type}`,
    '',
    analysis.explanation,
  ].join('\n')

  const body = [
    '',
    'QUÉ CAMBIA',
    bullets(analysis.what_changes, '- Nada que altere el waypoint actual.'),
    '',
    'QUÉ BLOQUEA',
    bullets(analysis.what_blocks, '- Sin bloqueo explícito.'),
  ]

  if (analysis.contradictions.length) {
    body.push('', 'CONTRADICCIONES', bullets(analysis.contradictions))
  }
  if (analysis.blocking_gates.length) {
    body.push('', 'GATES QUE DEBEN PASAR ANTES', bullets(analysis.blocking_gates))
  }
  if (analysis.risks.length) {
    body.push('', 'RIESGOS VIVOS', bullets(analysis.risks))
  }

  const permissions = [
    '',
    'PERMISOS',
    `- Avanzar: ${analysis.can_advance ? 'sí' : 'no'}`,
    `- Empezar WRITE: ${analysis.can_start_write ? 'sí' : 'no'}`,
    '',
    'QUÉ HACER AHORA',
    analysis.next_action,
  ]

  const footer = analysis.can_start_write
    ? [
        '',
        'LÍMITES',
        '- No abrir frentes nuevos.',
        '- No desplegar salvo gate explícito.',
        '- Entregar veredicto, archivos tocados, evidencia y tests ejecutados.',
      ]
    : ['', 'LÍMITES', '- Esta pieza no autoriza WRITE.', '- No la conviertas en decisión sin checkpoint.']

  return [header, ...body, ...permissions, ...footer].join('\n')
}
