import { beforeEach, describe, expect, it } from 'vitest'
import {
  CASES_KEY,
  COUNTER_KEY,
  STORAGE_KEY,
  addCase,
  bumpRelayCount,
  deserializePack,
  loadCases,
  loadPack,
  loadRelayCount,
  savePack,
  serializeCases,
  serializePack,
} from './storage'
import { defaultPack } from './defaultPack'

beforeEach(() => {
  window.localStorage.clear()
})

describe('contador de caducidad', () => {
  it('8 · guardar el pack pone el contador a 0', () => {
    bumpRelayCount()
    bumpRelayCount()
    bumpRelayCount()
    expect(loadRelayCount()).toBe(3)

    savePack({ ...defaultPack, destination: 'destino editado a mano' })

    expect(loadRelayCount()).toBe(0)
  })

  it('cuenta un relay por análisis', () => {
    expect(loadRelayCount()).toBe(0)
    expect(bumpRelayCount()).toBe(1)
    expect(bumpRelayCount()).toBe(2)
    expect(loadRelayCount()).toBe(2)
  })
})

describe('corpus de desacuerdo', () => {
  it('9 · registrar un desacuerdo añade exactamente un caso', () => {
    expect(loadCases()).toHaveLength(0)

    addCase({
      pastedText: 'texto pegado',
      rawResponse: '{"signal":"EN_RUTA"}',
      shownSignal: 'EN_RUTA',
      correctSignal: 'STOP',
    })

    const cases = loadCases()
    expect(cases).toHaveLength(1)
    expect(cases[0].shownSignal).toBe('EN_RUTA')
    expect(cases[0].correctSignal).toBe('STOP')
    expect(cases[0].pastedText).toBe('texto pegado')
    expect(cases[0].createdAt).toBeTruthy()
  })

  it('10 · exportar casos devuelve todos los guardados', () => {
    addCase({ pastedText: 'uno', rawResponse: '{}', shownSignal: 'EN_RUTA', correctSignal: 'STOP' })
    addCase({ pastedText: 'dos', rawResponse: '{}', shownSignal: 'STOP', correctSignal: 'BLOQUEADO' })
    addCase({ pastedText: 'tres', rawResponse: '{}', shownSignal: 'FALTA_MAPA', correctSignal: 'EN_RUTA' })

    const exported = JSON.parse(serializeCases(loadCases())) as { cases: unknown[] }

    expect(exported.cases).toHaveLength(3)
    expect(exported.cases.map((item) => (item as { pastedText: string }).pastedText)).toEqual([
      'uno',
      'dos',
      'tres',
    ])
  })
})

describe('migración de claves de F1', () => {
  const LEGACY_PACK = 'rele.f1.projectPack'
  const LEGACY_COUNTER = 'rele.f1.relayCount'
  const LEGACY_CASES = 'rele.f1.cases'

  it('migra el pack guardado con la clave vieja y retira la vieja', () => {
    const legacyPack = { ...defaultPack, project: 'UXM guardado en F1' }
    window.localStorage.setItem(LEGACY_PACK, JSON.stringify(legacyPack))

    expect(loadPack().project).toBe('UXM guardado en F1')

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').project).toBe('UXM guardado en F1')
    expect(window.localStorage.getItem(LEGACY_PACK)).toBeNull()
  })

  it('migra el contador y el corpus', () => {
    window.localStorage.setItem(LEGACY_COUNTER, '4')
    window.localStorage.setItem(
      LEGACY_CASES,
      JSON.stringify([
        {
          id: 'viejo',
          pastedText: 'texto de F1',
          rawResponse: '{}',
          shownSignal: 'EN_RUTA',
          correctSignal: 'STOP',
          createdAt: '2026-08-16T10:00:00.000Z',
        },
      ]),
    )

    expect(loadRelayCount()).toBe(4)
    expect(loadCases()).toHaveLength(1)

    expect(window.localStorage.getItem(COUNTER_KEY)).toBe('4')
    expect(window.localStorage.getItem(LEGACY_COUNTER)).toBeNull()
    expect(window.localStorage.getItem(LEGACY_CASES)).toBeNull()
  })

  it('si ya existe la clave nueva, la vieja no la pisa y se descarta', () => {
    savePack({ ...defaultPack, project: 'el bueno' })
    window.localStorage.setItem(LEGACY_PACK, JSON.stringify({ ...defaultPack, project: 'el viejo' }))

    expect(loadPack().project).toBe('el bueno')
    expect(window.localStorage.getItem(LEGACY_PACK)).toBeNull()
  })

  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(loadPack().project).toBe(defaultPack.project)
    expect(loadRelayCount()).toBe(0)
    expect(loadCases()).toEqual([])
  })
})

describe('pack', () => {
  it('exportar e importar devuelve el mismo objeto', () => {
    const pack = { ...defaultPack, updatedAt: '2026-08-16T10:00:00.000Z' }
    expect(deserializePack(serializePack(pack))).toEqual(pack)
  })
})
