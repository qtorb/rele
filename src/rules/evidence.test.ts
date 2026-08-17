import { describe, expect, it } from 'vitest'
import { MOTIVES, applyEvidenceGate, applyGates, applyStalenessGate } from './evidence'
import { SIGNALS } from '../lib/signals'
import type { Signal } from '../types'

const TEXT = `BRIEF C13 · rev.4 · EJECUTABLE

Preflight ya recomputado:
- Árbol limpio verificado.
- Tests en verde.

Ejecuta solo el brief adjunto.`

function extractorSaid(signal: Signal, evidencia: string) {
  return { signal, evidencia }
}

describe('puerta de evidencia', () => {
  it('1 · evidencia vacía degrada a FALTA MAPA', () => {
    const result = applyEvidenceGate(extractorSaid('EN_RUTA', ''), TEXT)
    expect(result.signal).toBe('FALTA_MAPA')
    expect(result.motive).toBe(MOTIVES.noEvidence)
    expect(result.degraded).toBe(true)
  })

  it('2 · una cita que no está en el texto pegado degrada por cita no verificable', () => {
    const result = applyEvidenceGate(
      extractorSaid('EN_RUTA', 'El CTO aprobó el despliegue en la reunión del martes.'),
      TEXT,
    )
    expect(result.signal).toBe('FALTA_MAPA')
    expect(result.motive).toBe(MOTIVES.unverifiable)
  })

  it('3 · una cita con distinto espaciado o saltos de línea pasa intacta', () => {
    const result = applyEvidenceGate(
      extractorSaid('STOP', '  Árbol   limpio\n\n  verificado.  '),
      TEXT,
    )
    expect(result.signal).toBe('STOP')
    expect(result.motive).toBeNull()
    expect(result.degraded).toBe(false)
  })

  it('4 · una cita válida con EN RUTA sigue siendo EN RUTA', () => {
    const result = applyEvidenceGate(extractorSaid('EN_RUTA', 'Tests en verde.'), TEXT)
    expect(result.signal).toBe('EN_RUTA')
    expect(result.motive).toBeNull()
  })

  it('5 · asimetría: ninguna entrada produce EN RUTA si el extractor no dijo EN RUTA', () => {
    const evidencias = ['', 'Tests en verde.', 'cita inventada', '   ', 'Ejecuta solo el brief adjunto.']
    const textos = [TEXT, '', 'otro texto cualquiera']
    const contadores = [0, 4, 5, 99]

    for (const signal of SIGNALS.filter((candidate) => candidate !== 'EN_RUTA')) {
      for (const evidencia of evidencias) {
        for (const texto of textos) {
          for (const contador of contadores) {
            const result = applyGates(extractorSaid(signal, evidencia), texto, contador)
            expect(result.signal).not.toBe('EN_RUTA')
          }
        }
      }
    }

    // Y las entradas basura tampoco pueden ascender a EN_RUTA.
    for (const basura of [null, undefined, 42, 'texto', {}, { signal: 'INVENTADA' }, []]) {
      expect(applyGates(basura, TEXT, 0).signal).toBe('FALTA_MAPA')
    }
  })

  it('6 · una respuesta malformada o sin campo devuelve FALTA MAPA, no una excepción', () => {
    expect(() => applyEvidenceGate(null, TEXT)).not.toThrow()
    expect(applyEvidenceGate(null, TEXT).motive).toBe(MOTIVES.malformed)
    expect(applyEvidenceGate({}, TEXT).motive).toBe(MOTIVES.malformed)
    expect(applyEvidenceGate({ evidencia: 'Tests en verde.' }, TEXT).motive).toBe(MOTIVES.malformed)
    expect(applyEvidenceGate({ signal: 'NO_EXISTE', evidencia: 'Tests en verde.' }, TEXT).motive).toBe(
      MOTIVES.malformed,
    )
  })

  it('FALTA MAPA del propio extractor no exige prueba: ya es el suelo', () => {
    const result = applyEvidenceGate(extractorSaid('FALTA_MAPA', ''), TEXT)
    expect(result.signal).toBe('FALTA_MAPA')
    expect(result.degraded).toBe(false)
  })
})

describe('puerta de caducidad del pack', () => {
  it('7 · contador en 5 con evidencia válida y EN RUTA degrada a FALTA MAPA', () => {
    const result = applyGates(extractorSaid('EN_RUTA', 'Tests en verde.'), TEXT, 5)
    expect(result.signal).toBe('FALTA_MAPA')
    expect(result.motive).toBe(MOTIVES.stale)
    // La cita verificada se conserva aunque la señal caiga.
    expect(result.evidencia).toBe('Tests en verde.')
  })

  it('por debajo del límite no toca la señal', () => {
    const result = applyGates(extractorSaid('EN_RUTA', 'Tests en verde.'), TEXT, 4)
    expect(result.signal).toBe('EN_RUTA')
    expect(result.motive).toBeNull()
  })

  it('un contador corrupto se trata como cero, no rompe', () => {
    const result = applyStalenessGate(
      { signal: 'EN_RUTA', evidencia: 'Tests en verde.', motive: null, degraded: false },
      Number.NaN,
    )
    expect(result.signal).toBe('EN_RUTA')
  })
})
