// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeProjectPath } from './paths.js'

const RUTA = String.raw`C:\Users\AlbertGarciaPujadas\proyectos\uxm-v3`

describe('normalizar la ruta de la carpeta', () => {
  it('quita las comillas dobles que pone "Copiar como ruta" de Windows', () => {
    expect(normalizeProjectPath(`"${RUTA}"`)).toBe(RUTA)
  })

  it('quita las comillas simples', () => {
    expect(normalizeProjectPath(`'${RUTA}'`)).toBe(RUTA)
  })

  it('quita los espacios de delante y de detrás', () => {
    expect(normalizeProjectPath(`   ${RUTA}   `)).toBe(RUTA)
    expect(normalizeProjectPath(`\t${RUTA}\n`)).toBe(RUTA)
  })

  it('quita comillas y espacios combinados, en cualquier orden', () => {
    expect(normalizeProjectPath(`  "${RUTA}"  `)).toBe(RUTA)
    expect(normalizeProjectPath(`"  ${RUTA}  "`)).toBe(RUTA)
    expect(normalizeProjectPath(`  '  ${RUTA}  '  `)).toBe(RUTA)
  })

  it('deja intacta una ruta que ya viene limpia', () => {
    expect(normalizeProjectPath(RUTA)).toBe(RUTA)
    expect(normalizeProjectPath('/home/albert/proyectos/rele')).toBe('/home/albert/proyectos/rele')
  })

  it('no toca las comillas que no envuelven la ruta entera', () => {
    expect(normalizeProjectPath(`C:\\carpeta "rara"\\sub`)).toBe(`C:\\carpeta "rara"\\sub`)
  })

  it('devuelve cadena vacía para lo que no es una ruta utilizable', () => {
    expect(normalizeProjectPath('')).toBe('')
    expect(normalizeProjectPath('   ')).toBe('')
    expect(normalizeProjectPath('""')).toBe('')
    expect(normalizeProjectPath(null)).toBe('')
    expect(normalizeProjectPath(undefined)).toBe('')
    expect(normalizeProjectPath(42)).toBe('')
  })
})
