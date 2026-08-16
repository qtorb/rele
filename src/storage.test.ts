import { beforeEach, describe, expect, it } from 'vitest'
import {
  addCase,
  bumpRelayCount,
  deserializePack,
  loadCases,
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

describe('pack', () => {
  it('exportar e importar devuelve el mismo objeto', () => {
    const pack = { ...defaultPack, updatedAt: '2026-08-16T10:00:00.000Z' }
    expect(deserializePack(serializePack(pack))).toEqual(pack)
  })
})
