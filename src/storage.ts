import { defaultPack, emptyPack } from './defaultPack'
import type { ProjectPack } from './types'

export const STORAGE_KEY = 'rele.f1.projectPack'
const EXPORT_KIND = 'rele.project-pack'
const EXPORT_VERSION = 1

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

/**
 * Acepta cualquier objeto y devuelve un Pack completo.
 * Los campos ausentes o del tipo equivocado caen al valor vacío en vez de
 * romper la app: un pack importado a medias sigue siendo utilizable.
 */
export function normalizePack(raw: unknown): ProjectPack {
  if (!raw || typeof raw !== 'object') return { ...emptyPack }
  const source = raw as Record<string, unknown>
  return {
    project: asString(source.project),
    destination: asString(source.destination),
    currentWaypoint: asString(source.currentWaypoint),
    nextSeat: asString(source.nextSeat),
    blockingGates: asStringList(source.blockingGates),
    liveRules: asStringList(source.liveRules),
    liveRisks: asStringList(source.liveRisks),
    parked: asStringList(source.parked),
    updatedAt: asString(source.updatedAt),
  }
}

export function loadPack(): ProjectPack {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...defaultPack }
    return normalizePack(JSON.parse(stored))
  } catch {
    // localStorage bloqueado o JSON corrupto: seguimos con la semilla en memoria.
    return { ...defaultPack }
  }
}

export function savePack(pack: ProjectPack) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pack))
  } catch {
    // Sin persistencia el Pack sigue vivo en la sesión; no bloqueamos el trabajo.
  }
}

export function serializePack(pack: ProjectPack) {
  return JSON.stringify({ kind: EXPORT_KIND, version: EXPORT_VERSION, pack }, null, 2)
}

/** Acepta tanto el sobre exportado por Relé como un Pack pelado. */
export function deserializePack(text: string): ProjectPack {
  const parsed = JSON.parse(text) as Record<string, unknown>
  if (parsed && typeof parsed === 'object' && parsed.kind === EXPORT_KIND) {
    return normalizePack(parsed.pack)
  }
  return normalizePack(parsed)
}

export function packIsUsable(pack: ProjectPack) {
  return Boolean(pack.project.trim() && pack.destination.trim() && pack.currentWaypoint.trim())
}

export function missingPackFields(pack: ProjectPack) {
  const missing: string[] = []
  if (!pack.project.trim()) missing.push('proyecto')
  if (!pack.destination.trim()) missing.push('destino')
  if (!pack.currentWaypoint.trim()) missing.push('waypoint actual')
  return missing
}
