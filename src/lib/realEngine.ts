import { analyzeDemo } from './demoEngine'
import { buildHandoff } from './handoff'
import { SIGNAL_COPY, isSignal } from './signals'
import { CRITICAL_FIELDS, PACK_LIST_FIELDS, PACK_TEXT_FIELDS } from '../types'
import type { Analysis, InputType, MemoryUpdate, PackField, ProjectPack, Source } from '../types'

const INPUT_TYPES: InputType[] = [
  'project_status',
  'brief',
  'builder_output',
  'review',
  'blocker',
  'decision_candidate',
  'unknown',
]

const ALL_PACK_FIELDS: PackField[] = [...PACK_TEXT_FIELDS, ...PACK_LIST_FIELDS]

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeMemoryUpdates(value: unknown): MemoryUpdate[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw, index): MemoryUpdate | null => {
      if (!raw || typeof raw !== 'object') return null
      const item = raw as Record<string, unknown>
      const field = str(item.field) as PackField
      if (!ALL_PACK_FIELDS.includes(field)) return null
      const value_ = str(item.value)
      if (!value_) return null
      const action = str(item.action, 'add')
      const normalizedAction: MemoryUpdate['action'] =
        action === 'replace' || action === 'remove' ? action : 'add'
      return {
        id: `llm:${field}:${index}`,
        field,
        action: normalizedAction,
        value: value_,
        reason: str(item.reason, 'Propuesto por el extractor.'),
        // La criticidad la decide Relé por campo, no el LLM.
        critical: CRITICAL_FIELDS.includes(field),
      }
    })
    .filter((item): item is MemoryUpdate => item !== null)
}

/**
 * Convierte la salida cruda del extractor en un Analysis válido.
 * Cualquier campo ausente o fuera de dominio cae a un valor seguro:
 * el LLM extrae estructura, no decide qué es válido.
 */
export function normalizeAnalysis(raw: unknown, pack: ProjectPack): Analysis {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const signal = isSignal(item.signal) ? item.signal : 'FALTA_MAPA'
  const inputTypeRaw = str(item.input_type, 'unknown') as InputType
  const inputType = INPUT_TYPES.includes(inputTypeRaw) ? inputTypeRaw : 'unknown'

  const base: Omit<Analysis, 'handoff'> = {
    input_type: inputType,
    signal,
    project: str(item.project, pack.project || 'sin declarar'),
    front: strList(item.front).slice(0, 6),
    next_seat: str(item.next_seat, SIGNAL_COPY[signal].seat),
    can_advance: bool(item.can_advance, signal === 'EN_RUTA'),
    can_start_write: bool(item.can_start_write, false),
    blocking_gates: strList(item.blocking_gates),
    contradictions: strList(item.contradictions),
    risks: strList(item.risks),
    rules_detected: strList(item.rules_detected),
    memory_updates: normalizeMemoryUpdates(item.memory_updates),
    // La cita se copia tal cual llegó. Verificarla es trabajo de la puerta de
    // evidencia, no de esta normalización.
    evidencia: typeof item.evidencia === 'string' ? item.evidencia : '',
    motive: null,
    rawResponse: JSON.stringify(raw ?? null, null, 2),
    explanation: str(item.explanation, SIGNAL_COPY[signal].title),
    what_changes: strList(item.what_changes),
    what_blocks: strList(item.what_blocks),
    next_action: str(item.next_action, 'Revisa la señal y decide el siguiente pase.'),
    engine: 'real',
  }

  // Coherencia dura: ninguna señal que no sea EN_RUTA puede autorizar WRITE.
  if (signal !== 'EN_RUTA') {
    base.can_advance = false
    base.can_start_write = false
  }

  const handoff = str(item.handoff)
  return { ...base, handoff: handoff || buildHandoff(base, pack) }
}

export type ExtractOutcome = {
  analysis: Analysis
  /** Motivo de degradación cuando el modo real no pudo usarse. */
  degradedReason?: string
}

/** Consulta al backend local si el modo real está configurado. */
export async function fetchMode(): Promise<'real' | 'demo'> {
  try {
    const response = await fetch('/api/health')
    if (!response.ok) return 'demo'
    const data = (await response.json()) as { mode?: string }
    return data.mode === 'real' ? 'real' : 'demo'
  } catch {
    return 'demo'
  }
}

/**
 * Modo real con degradación explícita: si el backend no está, no responde
 * o devuelve algo inservible, caemos al motor determinista y lo decimos.
 */
export async function analyzeReal(
  input: string,
  source: Source,
  pack: ProjectPack,
): Promise<ExtractOutcome> {
  const fallback = (reason: string): ExtractOutcome => ({
    analysis: { ...analyzeDemo(input, source, pack), engineNote: reason },
    degradedReason: reason,
  })

  let response: Response
  try {
    response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, source, pack }),
    })
  } catch {
    return fallback('El backend local no responde. Análisis hecho con reglas deterministas.')
  }

  let payload: { ok?: boolean; analysis?: unknown; error?: string }
  try {
    payload = (await response.json()) as typeof payload
  } catch {
    return fallback('El backend devolvió una respuesta ilegible. Análisis hecho con reglas deterministas.')
  }

  if (!response.ok || !payload.ok || !payload.analysis) {
    const detail = payload.error ? ` (${payload.error})` : ''
    return fallback(`El extractor no pudo completar${detail}. Análisis hecho con reglas deterministas.`)
  }

  return { analysis: normalizeAnalysis(payload.analysis, pack) }
}
