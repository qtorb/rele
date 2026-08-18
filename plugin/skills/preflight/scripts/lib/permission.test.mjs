// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectDeclaredPermission, detectWriteOrders, permissionVerdicts } from './permission.mjs'
import { CONTRADICHA, NO_COMPROBABLE, SOSTENIDA, verifyClaims } from './verify.mjs'
import { extractClaims } from './claims.mjs'
import { PARA, PUEDE_IR, formatReport, globalSignal } from './report.mjs'

const FIXTURE_002 = readFileSync(
  resolve(process.cwd(), 'plugin/fixtures/002-brief-f1-w1-completo.md'),
  'utf8',
)

const READ_ONLY_QUE_ESCRIBE = [
  'ASIENTO REVISOR · READ ONLY · no convierto nada en decisión.',
  '',
  'Repasa el estado del frente y devuelve un diagnóstico.',
  'Crea la rama `feat/x` y empieza a trabajar ahí.',
].join('\n')

const WRITE_COHERENTE = [
  'BUILDER · WRITE · RELÉ F9-W1 · Prueba',
  '',
  'Crea la rama `feat/x` y empieza a trabajar ahí.',
  'Modifica `src/App.tsx` con el cambio descrito.',
].join('\n')

describe('gate de permiso · cubos', () => {
  it('6 · READ ONLY que ordena crear una rama es contradicción, con las dos citas', () => {
    const [v] = permissionVerdicts(READ_ONLY_QUE_ESCRIBE)

    expect(v.bucket).toBe(CONTRADICHA)
    expect(v.claim.type).toBe('permiso')
    expect(v.claim.quote).toContain('READ ONLY')
    expect(v.claim.breach).toContain('Crea la rama')
    // Las dos citas son literales del texto.
    expect(READ_ONLY_QUE_ESCRIBE).toContain(v.claim.quote)
    expect(READ_ONLY_QUE_ESCRIBE).toContain(v.claim.breach)

    const report = formatReport([v])
    expect(report).toContain('Y sin embargo:')
    expect(report).toContain('Crea la rama')
  })

  it('7 · WRITE con los mismos verbos es sostenida, nunca contradicción', () => {
    const [v] = permissionVerdicts(WRITE_COHERENTE)

    expect(v.bucket).toBe(SOSTENIDA)
    expect(globalSignal([v])).not.toBe(PARA)
  })

  it('8 · sin cabecera y sin zona, no comprobable y la señal no empeora', () => {
    const texto = 'Crea la rama `feat/x` y modifica `src/App.tsx`.'

    expect(permissionVerdicts(texto)).toHaveLength(0)
    expect(globalSignal(permissionVerdicts(texto))).not.toBe(PARA)
  })

  it('9 · READ ONLY con el verbo negado no es contradicción', () => {
    for (const orden of [
      'No crees ninguna rama.',
      'Prohibido modificar `src/App.tsx`.',
      'Sin crear ficheros nuevos.',
      'Nunca borres nada del árbol.',
      'Esto no se toca.',
    ]) {
      const texto = `ASIENTO REVISOR · READ ONLY\n\n${orden}`
      const [v] = permissionVerdicts(texto)
      expect(v?.bucket ?? NO_COMPROBABLE).toBe(NO_COMPROBABLE)
    }
  })

  it('10 · verbos de escritura bajo "QUÉ NO SE TOCA" no cuentan', () => {
    const texto = [
      'ASIENTO REVISOR · READ ONLY',
      '',
      'Repasa el frente y devuelve un diagnóstico.',
      '',
      '§5 QUÉ NO SE TOCA',
      'Crea ramas nuevas. Modifica el pack. Empuja a main. Fusiona nada.',
    ].join('\n')

    const [v] = permissionVerdicts(texto)
    expect(v.bucket).toBe(NO_COMPROBABLE)
  })

  it('14 · texto malformado o cabecera partida no lanza y no comprueba', () => {
    for (const entrada of [null, undefined, 42, '', '   ', '\n\n\n', { a: 1 }, 'READ\nONLY roto']) {
      expect(() => permissionVerdicts(entrada)).not.toThrow()
      const salida = permissionVerdicts(entrada)
      expect(Array.isArray(salida)).toBe(true)
      expect(salida.filter((v) => v.bucket === CONTRADICHA)).toHaveLength(0)
    }
  })

  it('cabecera que nombra los dos permisos es ambigua y no declara nada', () => {
    expect(detectDeclaredPermission('READ ONLY antes de WRITE, siempre.')).toBeNull()
    expect(permissionVerdicts('READ ONLY antes de WRITE.\n\nCrea la rama `feat/x`.')).toHaveLength(0)
  })
})

describe('gate de permiso · zona de la app', () => {
  it('la zona declara el permiso cuando el texto no trae cabecera', () => {
    const texto = 'Crea la rama `feat/x` y empieza ahí.'

    expect(permissionVerdicts(texto, { zone: 'escritura' })[0].bucket).toBe(SOSTENIDA)
    // La vuelta no declara permiso: no hay nada que comprobar.
    expect(permissionVerdicts(texto, { zone: 'vuelta' })).toHaveLength(0)

    // La zona LECTURA sí declara READ ONLY, pero sin cabecera en el texto no
    // hay dos citas literales que enseñar, y la regla de evidencia manda:
    // sin las dos, no se reporta.
    expect(permissionVerdicts(texto, { zone: 'lectura' })).toHaveLength(0)
  })

  it('zona y cabecera en desacuerdo es ambiguo, y ante ambigüedad se calla', () => {
    expect(permissionVerdicts(WRITE_COHERENTE, { zone: 'lectura' })).toHaveLength(0)
    expect(permissionVerdicts(READ_ONLY_QUE_ESCRIBE, { zone: 'escritura' })).toHaveLength(0)
  })
})

describe('gate de permiso · reglas vinculantes', () => {
  it('13 · asimetría: ninguna entrada produce PUEDE IR por causa de este módulo', () => {
    const cabeceras = ['ASIENTO REVISOR · READ ONLY', 'BUILDER · WRITE · X', 'Sin cabecera ninguna', '']
    const cuerpos = [
      'Crea la rama `feat/x`.',
      'No crees ninguna rama.',
      'Repasa y diagnostica.',
      '§5 QUÉ NO SE TOCA\nBorra todo.',
      '',
    ]
    const zonas = [undefined, 'lectura', 'escritura', 'vuelta']

    for (const cabecera of cabeceras) {
      for (const cuerpo of cuerpos) {
        for (const zone of zonas) {
          const verdicts = permissionVerdicts(`${cabecera}\n\n${cuerpo}`, { zone })
          const senal = globalSignal(verdicts)
          // Solo puede degradar: si dice PUEDE IR es porque declaró WRITE y
          // ordena escribir, jamás por una entrada ambigua o vacía.
          if (senal === PUEDE_IR) {
            expect(verdicts[0].bucket).toBe(SOSTENIDA)
            expect(verdicts[0].claim.value).toBe('WRITE')
          }
          expect(verdicts.every((v) => [CONTRADICHA, SOSTENIDA, NO_COMPROBABLE].includes(v.bucket))).toBe(true)
        }
      }
    }
  })

  it('sin las dos citas literales, la contradicción no se reporta', () => {
    // Zona lectura sin cabecera: no hay cita de cabecera que enseñar, así que
    // se calla en vez de inventar una.
    expect(permissionVerdicts('Crea la rama `feat/x`.', { zone: 'lectura' })).toHaveLength(0)

    // Con cabecera sí hay las dos, y entonces sí se reporta.
    const conCabecera = permissionVerdicts(
      ['REVISIÓN · READ ONLY', '', 'Crea la rama `feat/x`.'].join('\n'),
    )
    expect(conCabecera[0].bucket).toBe(CONTRADICHA)
    expect(conCabecera[0].claim.quote).toContain('READ ONLY')
    expect(conCabecera[0].claim.breach).toContain('Crea la rama')
  })
})

describe('gate de permiso · sobre el fixture real', () => {
  it('11 · fixture 002 sigue con una sola contradicción: la rama', () => {
    const run = (cmd, args) => {
      if (cmd === 'git' && args[0] === 'branch') {
        return { ok: true, stdout: args[args.length - 1] === 'feat/rele-f1-uxm-app' ? '  x\n' : '', code: 0 }
      }
      if (cmd === 'gh' && args[0] === '--version') return { ok: true, stdout: 'gh', code: 0 }
      if (cmd === 'gh' && args[0] === 'pr') {
        return { ok: true, stdout: JSON.stringify({ state: 'OPEN', baseRefName: 'main' }), code: 0 }
      }
      return { ok: false, stdout: '', code: 1 }
    }

    const verdicts = [
      ...verifyClaims(extractClaims(FIXTURE_002), { run, text: FIXTURE_002 }),
      ...permissionVerdicts(FIXTURE_002),
    ]
    const contradichas = verdicts.filter((v) => v.bucket === CONTRADICHA)

    expect(contradichas).toHaveLength(1)
    expect(contradichas[0].claim.type).toBe('branch')
    // El fixture se declara WRITE, pero está escrito en descriptivo: no da
    // ni una orden de escritura. El gate no añade ninguna contradicción.
    const permiso = verdicts.find((v) => v.claim.type === 'permiso')
    expect(permiso.bucket).not.toBe(CONTRADICHA)
    expect(permiso.claim.value).toBe('WRITE')
  })

  it('12 · briefs READ ONLY reales del proyecto no dan falsos positivos', () => {
    // Los propios READ ONLY de Relé, tal como se escribieron.
    const reales = [
      [
        'ASIENTO REVISOR · READ ONLY · no convierto nada en decisión.',
        '',
        'Qué confirma:',
        '- El gate antes que el arreglo.',
        '- Comprometer no es publicar.',
        '',
        'Qué contradice:',
        '1 · El paso 2 reimpone una doctrina retirada.',
        '2 · "Reporta y PARA" y "B sin esperarme" son órdenes incompatibles.',
      ].join('\n'),
      [
        'READ ONLY PREVIO · obligatorio antes de tocar código',
        '',
        'Reporta en tres líneas antes del primer commit:',
        '1. Nombre exacto de la rama base y su HEAD.',
        '2. Qué hay hoy en `src/App.tsx`.',
        '3. Si `npm test` pasa en limpio.',
        '',
        'Si algo de esto no se puede confirmar, PARAR.',
      ].join('\n'),
      [
        'REVISIÓN · READ ONLY',
        '',
        'No se toca nada del repositorio en esta pasada.',
        'Prohibido crear ramas, modificar ficheros o empujar commits.',
        'Solo se mira y se informa.',
      ].join('\n'),
    ]

    for (const brief of reales) {
      const verdicts = permissionVerdicts(brief)
      expect(verdicts.filter((v) => v.bucket === CONTRADICHA)).toHaveLength(0)
    }
  })
})

describe('gate de permiso · piezas sueltas', () => {
  it('la cabecera se busca solo al principio, no en todo el texto', () => {
    const tarde = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'READ ONLY aquí abajo'].join('\n')
    expect(detectDeclaredPermission(tarde)).toBeNull()
  })

  it('los verbos negados no aparecen entre las órdenes detectadas', () => {
    const ordenes = detectWriteOrders('No crees la rama. Crea el fichero.')
    expect(ordenes.map((o) => o.quote)).toEqual(['No crees la rama. Crea el fichero.'])
    expect(ordenes).toHaveLength(1)
  })
})
