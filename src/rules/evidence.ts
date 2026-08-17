import { isSignal } from '../lib/signals'
import type { Signal } from '../types'

/**
 * Puertas que se aplican a la salida del motor ANTES de pintar nada.
 * Módulo puro: sin React, sin red, sin localStorage.
 *
 * Invariante vinculante (regla de asimetría): estas puertas SOLO pueden
 * degradar. Ninguna entrada posible puede producir EN_RUTA si el motor no
 * dijo EN_RUTA. Cualquier cambio aquí debe mantenerlo.
 */

export const STALE_RELAY_LIMIT = 5

export const MOTIVES = {
  noEvidence: 'señal sin prueba',
  unverifiable: 'cita no verificable',
  malformed: 'salida del extractor no válida',
  stale: `el mapa lleva ${STALE_RELAY_LIMIT} relays sin actualizarse`,
} as const

export type GateMotive = (typeof MOTIVES)[keyof typeof MOTIVES]

export type GateResult = {
  signal: Signal
  /** La cita, tal cual la devolvió el motor. Vacía si no había o no verifica. */
  evidencia: string
  motive: GateMotive | null
  degraded: boolean
}

/**
 * Normaliza para comparar: colapsa cualquier racha de espacios y saltos de
 * línea a un solo espacio. Una cita con distinto espaciado sigue siendo la
 * misma cita; una cita inventada no lo es.
 */
export function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function degrade(motive: GateMotive, evidencia = ''): GateResult {
  return { signal: 'FALTA_MAPA', evidencia, motive, degraded: true }
}

/**
 * Puerta de evidencia. Una señal sin prueba literal no se muestra.
 * Nunca lanza: una respuesta malformada es un FALTA_MAPA, no una excepción.
 */
export function applyEvidenceGate(raw: unknown, pastedText: string): GateResult {
  if (!raw || typeof raw !== 'object') return degrade(MOTIVES.malformed)

  const item = raw as Record<string, unknown>
  if (!isSignal(item.signal)) return degrade(MOTIVES.malformed)

  const signal = item.signal
  const evidencia = typeof item.evidencia === 'string' ? item.evidencia : ''

  // FALTA_MAPA ya es el suelo: no hay nada que degradar y no exige prueba.
  if (signal === 'FALTA_MAPA') {
    return { signal, evidencia, motive: null, degraded: false }
  }

  if (!evidencia.trim()) return degrade(MOTIVES.noEvidence)

  const haystack = normalizeForMatch(typeof pastedText === 'string' ? pastedText : '')
  const needle = normalizeForMatch(evidencia)
  if (!needle || !haystack.includes(needle)) return degrade(MOTIVES.unverifiable)

  return { signal, evidencia, motive: null, degraded: false }
}

/**
 * Puerta de caducidad. Un mapa que lleva 5 relays sin tocarse deja de ser mapa,
 * diga lo que diga el extractor. Conserva la cita si ya estaba verificada.
 */
export function applyStalenessGate(result: GateResult, relayCount: number): GateResult {
  const count = Number.isFinite(relayCount) ? relayCount : 0
  if (count < STALE_RELAY_LIMIT) return result
  return { signal: 'FALTA_MAPA', evidencia: result.evidencia, motive: MOTIVES.stale, degraded: true }
}

/** Ambas puertas en el orden en que deben correr. */
export function applyGates(raw: unknown, pastedText: string, relayCount: number): GateResult {
  return applyStalenessGate(applyEvidenceGate(raw, pastedText), relayCount)
}
