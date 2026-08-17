import { defaultPack, emptyPack } from './defaultPack'
import type { DisagreementCase, ProjectPack, Signal } from './types'

export const STORAGE_KEY = 'rele.pack'
export const COUNTER_KEY = 'rele.contador'
export const CASES_KEY = 'rele.casos'

/**
 * Claves que usó F1 antes del renombrado. Se migran al vuelo la primera vez
 * que se lee cada una y luego se retiran, para no dejar dos copias divergentes.
 */
const LEGACY_KEYS: Record<string, string> = {
  [STORAGE_KEY]: 'rele.f1.projectPack',
  [COUNTER_KEY]: 'rele.f1.relayCount',
  [CASES_KEY]: 'rele.f1.cases',
}

const EXPORT_KIND = 'rele.project-pack'
const CASES_EXPORT_KIND = 'rele.disagreement-cases'
const EXPORT_VERSION = 1

/**
 * Lee la clave nueva. Si no existe pero sí la vieja, copia el valor a la nueva,
 * borra la vieja y lo devuelve. Nunca lanza: si localStorage está bloqueado,
 * la app sigue con sus valores por defecto.
 */
function readWithMigration(key: string): string | null {
  try {
    const legacyKey = LEGACY_KEYS[key]
    const current = window.localStorage.getItem(key)

    if (current !== null) {
      // La clave nueva manda. Si la vieja sigue ahí, se retira para no dejar
      // dos copias que puedan divergir.
      if (legacyKey) window.localStorage.removeItem(legacyKey)
      return current
    }

    if (!legacyKey) return null

    const legacy = window.localStorage.getItem(legacyKey)
    if (legacy === null) return null

    window.localStorage.setItem(key, legacy)
    window.localStorage.removeItem(legacyKey)
    return legacy
  } catch {
    return null
  }
}

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
    const stored = readWithMigration(STORAGE_KEY)
    if (!stored) return { ...defaultPack }
    return normalizePack(JSON.parse(stored))
  } catch {
    // localStorage bloqueado o JSON corrupto: seguimos con la semilla en memoria.
    return { ...defaultPack }
  }
}

/**
 * Guardar el Pack resetea el contador de caducidad. Va acoplado a propósito:
 * así ningún camino de la app puede actualizar el mapa y olvidarse del contador.
 */
export function savePack(pack: ProjectPack) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pack))
    window.localStorage.setItem(COUNTER_KEY, '0')
  } catch {
    // Sin persistencia el Pack sigue vivo en la sesión; no bloqueamos el trabajo.
  }
}

/* --- Contador de caducidad -------------------------------------------- */

export function loadRelayCount(): number {
  const stored = Number(readWithMigration(COUNTER_KEY))
  return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
}

/** Suma un relay analizado y devuelve el valor nuevo. */
export function bumpRelayCount(): number {
  const next = loadRelayCount() + 1
  try {
    window.localStorage.setItem(COUNTER_KEY, String(next))
  } catch {
    // El contador vive en memoria durante la sesión aunque no persista.
  }
  return next
}

/* --- Corpus de desacuerdo ---------------------------------------------- */

export function loadCases(): DisagreementCase[] {
  try {
    const stored = readWithMigration(CASES_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? (parsed as DisagreementCase[]) : []
  } catch {
    return []
  }
}

export function addCase(input: {
  pastedText: string
  rawResponse: string
  shownSignal: Signal
  correctSignal: Signal
}): DisagreementCase[] {
  const now = new Date()
  const next: DisagreementCase[] = [
    ...loadCases(),
    { ...input, id: `case-${now.getTime()}-${loadCases().length}`, createdAt: now.toISOString() },
  ]
  try {
    window.localStorage.setItem(CASES_KEY, JSON.stringify(next))
  } catch {
    // Sin persistencia el caso se pierde al recargar; no bloqueamos el análisis.
  }
  return next
}

export function serializeCases(cases: DisagreementCase[]) {
  return JSON.stringify({ kind: CASES_EXPORT_KIND, version: EXPORT_VERSION, cases }, null, 2)
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
