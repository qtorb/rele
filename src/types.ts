export type Signal =
  | 'EN_RUTA'
  | 'GATE_PRIMERO'
  | 'STOP'
  | 'BLOQUEADO'
  | 'MADRIGUERA'
  | 'FALTA_MAPA'
  | 'READ_ONLY'

export type Source = 'auto' | 'builder' | 'producto' | 'cto' | 'gtm' | 'founder'

export type InputType =
  | 'project_status'
  | 'brief'
  | 'builder_output'
  | 'review'
  | 'blocker'
  | 'decision_candidate'
  | 'unknown'

/** Campos de texto del Project Pack que la memoria propuesta puede tocar. */
export type PackTextField = 'project' | 'destination' | 'currentWaypoint' | 'nextSeat'

/** Campos de lista del Project Pack que la memoria propuesta puede tocar. */
export type PackListField = 'blockingGates' | 'liveRules' | 'liveRisks' | 'parked'

export type PackField = PackTextField | PackListField

export type ProjectPack = {
  project: string
  destination: string
  currentWaypoint: string
  nextSeat: string
  blockingGates: string[]
  liveRules: string[]
  liveRisks: string[]
  parked: string[]
  updatedAt: string
}

/**
 * Una propuesta de cambio sobre el Project Pack.
 * Relé nunca la aplica sola: `critical` marca las que además exigen
 * una segunda confirmación explícita antes de escribir.
 */
export type MemoryUpdate = {
  id: string
  field: PackField
  action: 'add' | 'replace' | 'remove'
  value: string
  reason: string
  critical: boolean
}

export type Analysis = {
  input_type: InputType
  signal: Signal
  project: string
  front: string[]
  next_seat: string
  can_advance: boolean
  can_start_write: boolean
  blocking_gates: string[]
  contradictions: string[]
  risks: string[]
  rules_detected: string[]
  memory_updates: MemoryUpdate[]
  handoff: string
  /** Explicación corta de por qué esta señal. */
  explanation: string
  /** Qué cambia respecto al waypoint actual. */
  what_changes: string[]
  /** Qué bloquea el avance ahora mismo. */
  what_blocks: string[]
  /** Qué hacer ahora, en una frase accionable. */
  next_action: string
  /** Qué motor produjo este análisis. */
  engine: 'demo' | 'real'
  /** Nota de degradación cuando el modo real no pudo completarse. */
  engineNote?: string
}

export const PACK_TEXT_FIELDS: PackTextField[] = [
  'project',
  'destination',
  'currentWaypoint',
  'nextSeat',
]

export const PACK_LIST_FIELDS: PackListField[] = [
  'blockingGates',
  'liveRules',
  'liveRisks',
  'parked',
]

export const PACK_FIELD_LABELS: Record<PackField, string> = {
  project: 'Proyecto',
  destination: 'Destino',
  currentWaypoint: 'Waypoint actual',
  nextSeat: 'Siguiente asiento',
  blockingGates: 'Gates bloqueantes',
  liveRules: 'Reglas vivas',
  liveRisks: 'Riesgos vivos',
  parked: 'Aparcado',
}

/** Campos cuyo cambio es una decisión, no una anotación. Requieren confirmación reforzada. */
export const CRITICAL_FIELDS: PackField[] = ['destination', 'currentWaypoint', 'blockingGates', 'liveRules']

export function isPackListField(field: PackField): field is PackListField {
  return (PACK_LIST_FIELDS as PackField[]).includes(field)
}
