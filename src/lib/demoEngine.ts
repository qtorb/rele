import { buildHandoff } from './handoff'
import { SIGNAL_COPY, SOURCE_LABELS } from './signals'
import { missingPackFields, packIsUsable } from '../storage'
import { CRITICAL_FIELDS } from '../types'
import type { Analysis, InputType, MemoryUpdate, PackField, ProjectPack, Signal, Source } from '../types'

/** Debajo de esto no hay pieza que analizar, solo una frase suelta. */
const MIN_INPUT_LENGTH = 25

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}

function detectFronts(raw: string) {
  const matches = raw.match(/\b([A-Z]{1,2}\d{1,3})\b/g)
  return unique(matches ?? []).slice(0, 4)
}

/**
 * Extrae frases que se comportan como regla: prohibiciones, condiciones previas
 * y absolutos. No interpreta: solo recorta lo que ya está escrito como norma.
 */
function detectRules(raw: string) {
  return unique(
    raw
      .split('\n')
      .map((line) => line.replace(/^[-•*\d.\s]+/, '').trim())
      .filter((line) => line.length > 12 && line.length < 220)
      .filter((line) => /^(no |nunca |siempre |antes de |solo |únicamente )/i.test(line)),
  ).slice(0, 5)
}

function makeUpdate(
  field: PackField,
  action: MemoryUpdate['action'],
  value: string,
  reason: string,
  index: number,
): MemoryUpdate {
  return {
    id: `${field}:${action}:${index}`,
    field,
    action,
    value,
    reason,
    critical: CRITICAL_FIELDS.includes(field),
  }
}

function detectInputType(text: string, source: Source, hardBlock: boolean, review: boolean): InputType {
  if (hardBlock) return 'blocker'
  if (review) return 'review'
  if (hasAny(text, ['brief', 'qué se hace', 'entrega:', 'alcance obligatorio'])) return 'brief'
  if (source === 'builder' || hasAny(text, ['archivos tocados', 'tests ejecutados', 'veredicto', 'commit'])) {
    return 'builder_output'
  }
  if (hasAny(text, ['status', 'waypoint', 'estado del proyecto', 'último estado'])) return 'project_status'
  if (hasAny(text, ['queda acordado', 'decisión:', 'decidimos', 'se acepta'])) return 'decision_candidate'
  return 'unknown'
}

function faltaMapa(
  pack: ProjectPack,
  reason: string,
  detail: string[],
  observed: { inputType?: InputType; fronts?: string[] } = {},
): Analysis {
  const base: Omit<Analysis, 'handoff'> = {
    input_type: observed.inputType ?? 'unknown',
    signal: 'FALTA_MAPA',
    project: pack.project || 'sin declarar',
    front: observed.fronts ?? [],
    next_seat: SIGNAL_COPY.FALTA_MAPA.seat,
    can_advance: false,
    can_start_write: false,
    blocking_gates: [],
    contradictions: [],
    risks: ['Pedir orientación sin mapa devuelve una respuesta que parece criterio y no lo es.'],
    rules_detected: [],
    memory_updates: [],
    explanation: reason,
    what_changes: [],
    what_blocks: detail,
    next_action: 'Completa el Project Pack antes de volver a analizar. Relé no finge criterio.',
    engine: 'demo',
  }
  return { ...base, handoff: buildHandoff(base, pack) }
}

export function analyzeDemo(input: string, source: Source, pack: ProjectPack): Analysis {
  const trimmed = input.trim()

  if (!packIsUsable(pack)) {
    const missing = missingPackFields(pack)
    return faltaMapa(
      pack,
      'No hay mapa contra el que comparar esta pieza. Sin destino ni waypoint, cualquier señal sería inventada.',
      [`Faltan campos del Project Pack: ${missing.join(', ')}.`],
    )
  }

  if (trimmed.length < MIN_INPUT_LENGTH) {
    return faltaMapa(pack, 'La pieza pegada es demasiado corta para ubicarla contra el waypoint.', [
      'Pega la salida completa: brief, veredicto del builder, revisión o bloqueo.',
    ])
  }

  const text = trimmed.toLowerCase()
  const declaredSource = source === 'auto' ? null : SOURCE_LABELS[source]

  const hardBlock = hasAny(text, [
    'bloqueo:',
    'no puedo confirmar',
    'me detengo',
    'no se ha modificado',
    'no se ha creado rama',
    'no se ha creado commit',
    'no puedo continuar',
  ])

  const review = hasAny(text, [
    'read only',
    'asiento revisor',
    'no convierto nada en decisión',
    'qué confirma',
    'qué contradice',
  ])

  const executable = hasAny(text, [
    'ejecutable',
    'listo para builder',
    'puede lanzar',
    'se puede lanzar',
    'write',
    'ejecuta solo',
  ])

  const gateCleared = hasAny(text, [
    'árbol limpio',
    'arbol limpio',
    'gate en verde',
    'gate pasa',
    'tests en verde',
    'preflight ok',
    'turno de despliegue concedido',
  ])

  const scopeDrift = hasAny(text, [
    'nuevo frente',
    'otro frente',
    'abrir c1',
    'roadmap trimestral',
    'comité',
    'matriz de riesgos',
    'ya que estamos',
    'aprovechando',
  ])

  const deployPressure =
    hasAny(text, ['desplegar ahora', 'railway up', 'subir a producción', 'deploy ya']) && !gateCleared

  // Contradicciones: pares de instrucciones que no pueden cumplirse a la vez.
  const contradictions: string[] = []
  if (
    hasAny(text, ['para y reporta', 'reporta y para', 'para y dilo']) &&
    hasAny(text, ['sin esperarme', 'sigue con', 'continúa con', 'continua con'])
  ) {
    contradictions.push('Hay dos órdenes incompatibles: parar y, a la vez, continuar sin esperar.')
  }
  if (hasAny(text, ['no está en el brief', 'no esta en el brief', 'instrucción lateral', 'requisito lateral'])) {
    contradictions.push('Entra un criterio de aceptación que no pasó por revisión del brief.')
  }
  if (hasAny(text, ['dos fuentes de verdad']) || (hasAny(text, ['lista buena']) && hasAny(text, ['gate']))) {
    contradictions.push('Hay dos fuentes de verdad para el alcance: una cifra fija y lo que salga del gate.')
  }
  if (hasAny(text, ['no quede ning', 'no queda ninguna']) && hasAny(text, ['plantilla', 'gate'])) {
    contradictions.push('Se prescribe el medio interno cuando el contrato real es que pase el gate.')
  }
  if (hasAny(text, ['contradice', 'incompatible', 'se contradicen'])) {
    contradictions.push('La propia pieza declara una contradicción sin resolverla.')
  }

  const fronts = detectFronts(trimmed)
  const rulesDetected = detectRules(trimmed)
  const inputType = detectInputType(text, source, hardBlock, review)

  const packGatesPending = pack.blockingGates.length > 0 && !gateCleared

  let signal: Signal
  if (hardBlock) signal = 'BLOQUEADO'
  else if (contradictions.length) signal = 'STOP'
  else if (scopeDrift || deployPressure) signal = 'MADRIGUERA'
  else if (executable && packGatesPending) signal = 'GATE_PRIMERO'
  else if (review && !executable) signal = 'READ_ONLY'
  else if (executable) signal = 'EN_RUTA'
  else signal = 'FALTA_MAPA'

  if (signal === 'FALTA_MAPA') {
    return faltaMapa(
      pack,
      'Hay pieza y hay mapa, pero la pieza no declara si es ejecutable, revisión o bloqueo.',
      [
        'La pieza no se presenta como ejecutable ni como revisión cerrada.',
        'Sin eso, marcarla como avance sería una suposición.',
      ],
      { inputType, fronts },
    )
  }

  const canAdvance = signal === 'EN_RUTA'
  const canStartWrite = signal === 'EN_RUTA' && executable

  const blockingGates: string[] = []
  if (signal === 'GATE_PRIMERO') blockingGates.push(...pack.blockingGates)
  if (deployPressure) blockingGates.push('Despliegue pedido sin gate explícito ni árbol limpio verificado.')

  const risks: string[] = []
  if (scopeDrift) risks.push('Abrir alcance nuevo antes de cerrar el frente vivo.')
  if (deployPressure) risks.push('Desplegar por inercia sin turno ni gate.')
  if (hardBlock) risks.push('Relanzar el WRITE sin resolver la causa del bloqueo.')
  if (contradictions.length) risks.push('El builder ejecuta literalmente una instrucción contradictoria.')
  if (review) risks.push('Tratar una revisión como decisión aceptada.')

  const whatChanges: string[] = []
  whatChanges.push(`Origen de la pieza: ${declaredSource ?? 'no declarado, inferido del contenido'}.`)
  whatChanges.push(fronts.length ? `Frente detectado: ${fronts.join(', ')}.` : 'No se detecta frente cerrado.')
  if (executable) whatChanges.push('La pieza se presenta como ejecutable.')
  if (review) whatChanges.push('La pieza se presenta como revisión, no como decisión.')
  if (rulesDetected.length) whatChanges.push(`Aparecen ${rulesDetected.length} formulaciones con forma de regla.`)

  const whatBlocks: string[] = []
  if (hardBlock) whatBlocks.push('El builder no pudo confirmar una condición segura de ejecución.')
  if (contradictions.length) whatBlocks.push('El brief necesita corrección antes de llegar al builder.')
  if (signal === 'GATE_PRIMERO') whatBlocks.push('Hay gates bloqueantes vivos en el Project Pack sin evidencia de que pasen.')
  if (scopeDrift) whatBlocks.push('La pieza empuja hacia un alcance que el waypoint actual no cubre.')
  if (deployPressure) whatBlocks.push('Se pide despliegue sin gate explícito.')
  if (review) whatBlocks.push('Una revisión no autoriza WRITE por sí sola.')

  const nextSeat =
    signal === 'EN_RUTA' && pack.nextSeat.trim() ? pack.nextSeat.trim() : SIGNAL_COPY[signal].seat

  const explanation: Record<Signal, string> = {
    EN_RUTA: 'La pieza es ejecutable y no choca con los gates ni con el waypoint actual.',
    GATE_PRIMERO: 'La pieza quiere avanzar, pero el Project Pack tiene gates bloqueantes que nadie ha declarado superados.',
    STOP: 'La pieza contiene instrucciones incompatibles entre sí. Si avanza tal cual, el builder ejecuta una madriguera.',
    BLOQUEADO: 'El builder se detuvo antes de escribir. Esto es un bloqueo, no una autorización de WRITE.',
    MADRIGUERA: 'La pieza empuja fuera del waypoint: frente nuevo, alcance nuevo o despliegue sin gate.',
    FALTA_MAPA: 'Señal insuficiente.',
    READ_ONLY: 'Es una revisión útil, pero no es decisión canónica ni permiso de ejecución.',
  }

  const nextAction: Record<Signal, string> = {
    EN_RUTA: `Pasa la pieza a ${nextSeat} con esta portada. Mantén los límites: sin frentes nuevos y sin despliegue.`,
    GATE_PRIMERO: `Antes de tocar código, pasa los gates listados y declara el resultado. Solo entonces vuelve a analizar.`,
    STOP: 'Devuélvelo a Producto/Founder como checkpoint breve con las contradicciones listadas. No lo pegues al builder.',
    BLOQUEADO: 'Llévalo a CTO/Founder como READ ONLY: causa probable, decisión pendiente y siguiente pase mínimo.',
    MADRIGUERA: 'Haz checkpoint: mantener el waypoint, aparcar el desvío o sustituir el plan de forma explícita.',
    FALTA_MAPA: 'Completa el Project Pack antes de volver a analizar.',
    READ_ONLY: 'Usa la revisión como insumo acotado y decide aparte qué parte se convierte en instrucción.',
  }

  // Memoria propuesta: nada se escribe sin que Albert lo confirme.
  const memoryUpdates: MemoryUpdate[] = []
  rulesDetected
    .filter((rule) => !pack.liveRules.some((existing) => existing.toLowerCase() === rule.toLowerCase()))
    .forEach((rule, index) => {
      memoryUpdates.push(makeUpdate('liveRules', 'add', rule, 'Aparece formulada como norma en la pieza.', index))
    })
  risks
    .filter((risk) => !pack.liveRisks.includes(risk))
    .forEach((risk, index) => {
      memoryUpdates.push(makeUpdate('liveRisks', 'add', risk, 'Riesgo derivado de la señal detectada.', index))
    })
  if (deployPressure && !pack.blockingGates.some((gate) => gate.toLowerCase().includes('despliegue'))) {
    memoryUpdates.push(
      makeUpdate('blockingGates', 'add', 'No desplegar sin gate explícito y árbol limpio.', 'La pieza pide despliegue sin gate.', 0),
    )
  }
  if (scopeDrift) {
    memoryUpdates.push(
      makeUpdate('parked', 'add', 'Desvío detectado en esta pieza: decidir si se aparca o sustituye el plan.', 'Alcance fuera del waypoint actual.', 0),
    )
  }
  if (nextSeat !== pack.nextSeat.trim()) {
    memoryUpdates.push(
      makeUpdate('nextSeat', 'replace', nextSeat, 'La señal cambia quién tiene la pelota.', 0),
    )
  }

  const base: Omit<Analysis, 'handoff'> = {
    input_type: inputType,
    signal,
    project: pack.project,
    front: fronts,
    next_seat: nextSeat,
    can_advance: canAdvance,
    can_start_write: canStartWrite,
    blocking_gates: unique(blockingGates),
    contradictions: unique(contradictions),
    risks: unique(risks),
    rules_detected: rulesDetected,
    memory_updates: memoryUpdates,
    explanation: explanation[signal],
    what_changes: unique(whatChanges),
    what_blocks: unique(whatBlocks),
    next_action: nextAction[signal],
    engine: 'demo',
  }

  return { ...base, handoff: buildHandoff(base, pack) }
}
