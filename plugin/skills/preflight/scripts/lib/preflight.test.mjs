// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractClaims } from './claims.mjs'
import { CONTRADICHA, NO_COMPROBABLE, SOSTENIDA, verifyClaims } from './verify.mjs'
import { PARA, PUEDE_IR, SIN_AFIRMACIONES, formatReport, globalSignal } from './report.mjs'

const FIXTURE_001 = readFileSync(resolve(process.cwd(), 'plugin/fixtures/001-brief-f1-w1.md'), 'utf8')
const FIXTURE_002 = readFileSync(
  resolve(process.cwd(), 'plugin/fixtures/002-brief-f1-w1-completo.md'),
  'utf8',
)

/** Doble de repo. Ninguna llamada real a git ni a gh. */
function fakeRepo({ branches = [], paths = [], commits = [], prs = {}, gh = true } = {}) {
  const fail = { ok: false, stdout: '', stderr: '', code: 1 }
  return (cmd, args) => {
    if (cmd === 'gh') {
      if (!gh) return { ok: false, stdout: '', stderr: 'command not found', code: 127 }
      if (args[0] === '--version') return { ok: true, stdout: 'gh version 2.90.0', code: 0 }
      if (args[0] === 'pr' && args[1] === 'view') {
        const pr = prs[args[2]]
        return pr ? { ok: true, stdout: JSON.stringify(pr), code: 0 } : fail
      }
      return fail
    }

    if (cmd === 'git') {
      const name = args[args.length - 1]
      if (args[0] === 'branch') {
        return { ok: true, stdout: branches.includes(name) ? `  remotes/origin/${name}\n` : '', code: 0 }
      }
      if (args[0] === 'ls-remote') {
        return { ok: true, stdout: branches.includes(name) ? `aaaaaaa\trefs/heads/${name}\n` : '', code: 0 }
      }
      // Búsqueda por nombre suelto en todo el árbol.
      if (args[0] === 'ls-files') {
        const bareName = args[args.length - 1]
        const hits = paths.filter((path) => path === bareName || path.endsWith(`/${bareName}`))
        return { ok: true, stdout: hits.join('\n'), code: 0 }
      }
      if (args[0] === 'cat-file') {
        const spec = args[2]
        if (spec.endsWith('^{commit}')) {
          return commits.includes(spec.replace('^{commit}', '')) ? { ok: true, stdout: '', code: 0 } : fail
        }
        const path = spec.slice(spec.indexOf(':') + 1)
        return paths.includes(path) ? { ok: true, stdout: '', code: 0 } : fail
      }
    }

    return fail
  }
}

function analyze(text, repo) {
  return verifyClaims(extractClaims(text), { run: fakeRepo(repo), text })
}

const FIXTURE_PATHS = ['src/App.tsx', 'src/extractor/prompt.ts', 'src/rules/validate.ts']

describe('fixture 001 · el brief que manda crear una rama que ya existe', () => {
  it('1 · contra un repo donde la rama existe con PR abierto devuelve PARA y señala la rama', () => {
    const verdicts = analyze(FIXTURE_001, {
      branches: ['feat/rele-f1-uxm-app'],
      paths: FIXTURE_PATHS,
      prs: { 1: { state: 'OPEN', headRefName: 'feat/rele-f0-clickable-mock', baseRefName: 'main' } },
    })

    expect(globalSignal(verdicts)).toBe(PARA)

    const branchVerdict = verdicts.find((item) => item.claim.value === 'feat/rele-f1-uxm-app')
    expect(branchVerdict.bucket).toBe(CONTRADICHA)
    expect(branchVerdict.claim.quote).toContain('feat/rele-f1-uxm-app')
    expect(branchVerdict.repoSays).toContain('ya existe')
    expect(branchVerdict.command).toContain('git')

    // Y sale en el reporte, con cita y comando.
    const report = formatReport(verdicts)
    expect(report.startsWith(PARA)).toBe(true)
    expect(report).toContain('feat/rele-f1-uxm-app')
    expect(report).toContain('Comprobado con:')
  })

  it('2 · contra un repo donde esa rama no existe, no hay contradicción', () => {
    const verdicts = analyze(FIXTURE_001, {
      branches: [],
      paths: FIXTURE_PATHS,
      prs: { 1: { state: 'OPEN', headRefName: 'feat/rele-f0-clickable-mock', baseRefName: 'main' } },
    })

    expect(verdicts.filter((item) => item.bucket === CONTRADICHA)).toHaveLength(0)
    expect(globalSignal(verdicts)).toBe(PUEDE_IR)
  })

  it('no confunde las claves de localStorage del brief con rutas de fichero', () => {
    const claims = extractClaims(FIXTURE_001)
    const paths = claims.filter((claim) => claim.type === 'path').map((claim) => claim.value)

    expect(paths).toEqual(expect.arrayContaining(FIXTURE_PATHS))
    expect(paths).not.toContain('rele.pack')
    expect(paths).not.toContain('rele.contador')
    expect(paths).not.toContain('github.com')
  })
})

describe('cubos', () => {
  it('3 · un PR dado por cerrado que sigue abierto es una contradicción', () => {
    const text = 'El PR #7 ya está cerrado, así que podemos seguir.'
    const verdicts = analyze(text, { prs: { 7: { state: 'OPEN', headRefName: 'x', baseRefName: 'main' } } })

    expect(verdicts[0].bucket).toBe(CONTRADICHA)
    expect(verdicts[0].repoSays).toContain('sigue abierto')
    expect(globalSignal(verdicts)).toBe(PARA)
  })

  it('4 · una ruta de fichero que no existe es una contradicción, con el comando en el reporte', () => {
    const text = 'La lógica vive en src/inventado/modulo.ts y ya está probada.'
    const verdicts = analyze(text, { paths: [] })

    expect(verdicts[0].bucket).toBe(CONTRADICHA)
    expect(formatReport(verdicts)).toContain('git cat-file -e HEAD:src/inventado/modulo.ts')
  })

  it('5 · un SHA inexistente es una contradicción', () => {
    const text = 'Partimos del commit a1b2c3d, que ya está en main.'
    const verdicts = analyze(text, { commits: [] })

    expect(verdicts[0].claim.type).toBe('commit')
    expect(verdicts[0].bucket).toBe(CONTRADICHA)
    expect(globalSignal(verdicts)).toBe(PARA)
  })

  it('6 · un texto sin afirmaciones nunca produce PARA', () => {
    const text = [
      'Deberíamos centrarnos en que el producto se entienda a la primera.',
      'La prioridad es que el usuario no pierda el hilo entre sesiones.',
    ].join('\n')

    const verdicts = analyze(text, {})

    expect(verdicts).toHaveLength(0)
    expect(globalSignal(verdicts)).toBe(SIN_AFIRMACIONES)
    expect(globalSignal(verdicts)).not.toBe(PARA)
  })

  it('7 · sin gh, las afirmaciones de PR pasan a no comprobables y la señal no empeora', () => {
    const text = 'El PR #7 ya está cerrado.'

    const conGh = analyze(text, { prs: { 7: { state: 'OPEN' } }, gh: true })
    const sinGh = analyze(text, { prs: { 7: { state: 'OPEN' } }, gh: false })

    expect(conGh[0].bucket).toBe(CONTRADICHA)
    expect(globalSignal(conGh)).toBe(PARA)

    expect(sinGh[0].bucket).toBe(NO_COMPROBABLE)
    expect(sinGh[0].repoSays).toContain('gh no está disponible')
    expect(globalSignal(sinGh)).toBe(SIN_AFIRMACIONES)
    expect(globalSignal(sinGh)).not.toBe(PARA)
  })
})

describe('reglas vinculantes', () => {
  it('8 · asimetría: ninguna combinación produce PUEDE IR si hay al menos una CONTRADICHA', () => {
    const buckets = [SOSTENIDA, CONTRADICHA, NO_COMPROBABLE]

    // Fuerza bruta sobre todas las combinaciones de hasta cuatro afirmaciones.
    const combinations = []
    const build = (current) => {
      if (current.length === 4) {
        combinations.push([...current])
        return
      }
      for (const bucket of buckets) build([...current, bucket])
    }
    build([])

    for (const combination of combinations) {
      const verdicts = combination.map((bucket, index) => ({
        claim: { id: String(index), quote: 'cita', type: 'branch', value: 'x' },
        bucket,
        repoSays: '',
        command: 'git',
      }))

      const signal = globalSignal(verdicts)
      if (combination.includes(CONTRADICHA)) {
        expect(signal).toBe(PARA)
      } else {
        expect(signal).not.toBe(PARA)
      }
    }
  })

  it('9 · una afirmación sin cita literal recuperable no se reporta', () => {
    const text = 'Trabajamos sobre feat/real que sí está en el texto.'
    const claims = [
      { id: 'a', type: 'branch', value: 'feat/inventada', quote: 'esta cita no aparece en el texto', assertion: 'exists' },
      { id: 'b', type: 'branch', value: 'feat/real', quote: text, assertion: 'exists' },
      { id: 'c', type: 'branch', value: 'feat/sin-cita', quote: '', assertion: 'exists' },
    ]

    const verdicts = verifyClaims(claims, { run: fakeRepo({ branches: ['feat/real'] }), text })

    expect(verdicts).toHaveLength(1)
    expect(verdicts[0].claim.value).toBe('feat/real')
  })

  it('10 · todo no comprobable nunca produce PARA', () => {
    const text = 'Quizá toquemos feat/algo-futuro en algún momento.'
    const verdicts = analyze(text, { branches: [] })

    expect(verdicts.every((item) => item.bucket === NO_COMPROBABLE)).toBe(true)
    expect(globalSignal(verdicts)).toBe(SIN_AFIRMACIONES)
    expect(globalSignal(verdicts)).not.toBe(PARA)
  })

  // §5 de F2-W3 derogó §6 de F2-W1 en cuanto a ocultar las sostenidas: ahora se
  // listan. Lo que NO derogó es que el detalle —comando y cita literal— sea
  // exclusivo de las contradicciones, y eso es lo que este test conserva.
  it('las sostenidas se listan sin comando ni cita', () => {
    const text = ['Rama nueva: feat/nueva-cosa.', 'El fichero src/App.tsx ya existe.', 'Quizá feat/otra.'].join('\n')
    const verdicts = analyze(text, { branches: ['feat/nueva-cosa'], paths: ['src/App.tsx'] })
    const report = formatReport(verdicts)

    expect(report).toContain('feat/nueva-cosa')

    const receipt = report.split('\n').filter((line) => line.startsWith('- '))
    expect(receipt).toHaveLength(1)
    expect(receipt[0]).toContain('src/App.tsx')

    for (const line of receipt) {
      expect(line).not.toMatch(/\b(git|gh)\b/)
      expect(line).not.toContain('«')
      expect(line).not.toContain('»')
    }

    expect(report.trim().endsWith('1 sostenidas · 1 no comprobables')).toBe(true)
  })
})

describe('F2-W2 · intención en rutas', () => {
  it('1 · fixture 002 produce PARA con una sola contradicción: la rama', () => {
    const verdicts = analyze(FIXTURE_002, {
      branches: ['feat/rele-f1-uxm-app'],
      paths: [],
      prs: { 1: { state: 'OPEN', headRefName: 'feat/rele-f0-clickable-mock', baseRefName: 'main' } },
    })

    const contradicted = verdicts.filter((item) => item.bucket === CONTRADICHA)

    expect(globalSignal(verdicts)).toBe(PARA)
    expect(contradicted).toHaveLength(1)
    expect(contradicted[0].claim.type).toBe('branch')
    expect(contradicted[0].claim.value).toBe('feat/rele-f1-uxm-app')

    // Las dos rutas que el brief mandaba crear caen en no comprobable.
    for (const path of ['src/extractor/prompt.ts', 'src/rules/validate.ts']) {
      const verdict = verdicts.find((item) => item.claim.value === path)
      expect(verdict.bucket).toBe(NO_COMPROBABLE)
    }
  })

  it('2 · "modifica" una ruta ausente es contradicción', () => {
    const verdicts = analyze('Para arreglarlo, modifica `src/App.tsx` y vuelve a lanzar.', { paths: [] })

    expect(verdicts[0].claim.type).toBe('path')
    expect(verdicts[0].bucket).toBe(CONTRADICHA)
    expect(formatReport(verdicts)).toContain('git cat-file -e HEAD:src/App.tsx')
  })

  it('3 · "crea" una ruta ausente no es comprobable', () => {
    const verdicts = analyze('Crea `src/nuevo.ts` con la lógica de arranque.', { paths: [] })

    expect(verdicts[0].bucket).toBe(NO_COMPROBABLE)
    expect(globalSignal(verdicts)).not.toBe(PARA)
  })

  it('4 · "crea" una ruta que ya existe tampoco es comprobable, por ahora', () => {
    const verdicts = analyze('Crea `src/nuevo.ts` con la lógica de arranque.', { paths: ['src/nuevo.ts'] })

    expect(verdicts[0].bucket).toBe(NO_COMPROBABLE)
    expect(globalSignal(verdicts)).not.toBe(PARA)
  })

  it('5 · una ruta mencionada sin verbo ni contexto no es comprobable', () => {
    const verdicts = analyze('Referencias: `src/suelto.ts`.', { paths: [] })

    expect(verdicts[0].bucket).toBe(NO_COMPROBABLE)
    expect(globalSignal(verdicts)).not.toBe(PARA)
  })

  it('6 · una ruta ambigua nunca es contradicción', () => {
    // "vive en" por sí solo no decide nada: describe igual de bien el repo de
    // hoy que dónde irá el código mañana.
    const ambigua = analyze('La lógica vive en `src/ambiguo.ts`.', { paths: [] })

    expect(ambigua[0].bucket).toBe(NO_COMPROBABLE)
    expect(ambigua[0].bucket).not.toBe(CONTRADICHA)
    expect(globalSignal(ambigua)).not.toBe(PARA)

    // Lo que decide es el marcador explícito de existencia, no "vive en".
    const afirmada = analyze('La lógica vive en `src/ambiguo.ts` y ya está probada.', { paths: [] })

    expect(afirmada[0].bucket).toBe(CONTRADICHA)
  })

  it('una sección de alcance basta para leer la ruta como trabajo por hacer', () => {
    const text = ['3. ALCANCE', '3.1 Validación', 'Módulo `src/rules/validate.ts`, puro, con tests propios.'].join('\n')
    const fuera = ['1. ESTADO', 'Módulo `src/rules/validate.ts`, puro, con tests propios.'].join('\n')

    expect(analyze(text, { paths: [] })[0].bucket).toBe(NO_COMPROBABLE)
    // Fuera de una sección de alcance y sin verbo, sigue siendo una mención.
    expect(analyze(fuera, { paths: [] })[0].bucket).toBe(NO_COMPROBABLE)
  })

  it('un marcador de existencia gana al contexto de sección', () => {
    const text = ['3. ALCANCE', 'El módulo `src/rules/validate.ts` ya contiene la lógica.'].join('\n')

    // Dentro de una sección de alcance, pero afirmando estado: es verificable.
    expect(analyze(text, { paths: [] })[0].bucket).toBe(CONTRADICHA)
    expect(analyze(text, { paths: ['src/rules/validate.ts'] })[0].bucket).toBe(SOSTENIDA)
  })
})

describe('F3-W1 · un nombre de fichero suelto se busca en todo el árbol', () => {
  it('1 · un nombre suelto que existe en un subdirectorio es SOSTENIDA', () => {
    const text = 'El detector ya está en `capture.mjs` y los tests pasan.'
    const verdicts = analyze(text, { paths: ['src/capture/capture.mjs'] })

    expect(verdicts[0].claim.type).toBe('path')
    expect(verdicts[0].bucket).toBe(SOSTENIDA)
    expect(verdicts[0].repoSays).toContain('src/capture/capture.mjs')
    // El comando del reporte es el de la búsqueda, no el de la raíz.
    expect(verdicts[0].command).toContain('ls-files')
    expect(verdicts[0].command).not.toContain('cat-file')
  })

  it('2 · un nombre suelto que no existe en ninguna parte es CONTRADICHA', () => {
    const text = 'El detector ya está en `inventado.mjs` y los tests pasan.'
    const verdicts = analyze(text, { paths: ['src/capture/capture.mjs'] })

    expect(verdicts[0].bucket).toBe(CONTRADICHA)
    expect(verdicts[0].repoSays).toContain('no aparece en ninguna parte')
    expect(globalSignal(verdicts)).toBe(PARA)
  })

  it('3 · una ruta con directorios que existe sigue siendo SOSTENIDA', () => {
    const text = 'El detector ya está en `src/capture/capture.mjs`.'
    const verdicts = analyze(text, { paths: ['src/capture/capture.mjs'] })

    expect(verdicts[0].bucket).toBe(SOSTENIDA)
    // Con directorios la ruta sí es la afirmación: se comprueba exacta.
    expect(verdicts[0].command).toContain('cat-file')
  })

  it('4 · una ruta con directorios que no existe sigue siendo CONTRADICHA', () => {
    const text = 'El detector ya está en `src/otro/capture.mjs`.'
    const verdicts = analyze(text, { paths: ['src/capture/capture.mjs'] })

    expect(verdicts[0].bucket).toBe(CONTRADICHA)
    expect(verdicts[0].command).toContain('cat-file')
  })

  it('5 · un nombre suelto en varios sitios es SOSTENIDA y el reporte dice cuántos, sin elegir', () => {
    const text = 'El detector ya está en `tipos.mjs`.'
    const verdicts = analyze(text, {
      paths: ['src/capture/tipos.mjs', 'src/informe/tipos.mjs', 'src/gate/tipos.mjs'],
    })

    expect(verdicts[0].bucket).toBe(SOSTENIDA)
    expect(verdicts[0].repoSays).toContain('3 sitios')

    const report = formatReport(verdicts)
    expect(report).toContain('aparece en 3 sitios')
    // No elige ninguno de los tres.
    expect(report).not.toContain('src/capture/tipos.mjs')
    expect(report).not.toContain('src/informe/tipos.mjs')
  })

  it('un nombre suelto que el texto pide crear sigue siendo no comprobable', () => {
    const verdicts = analyze('Crea `nuevo.mjs` con el detector.', { paths: [] })

    expect(verdicts[0].bucket).toBe(NO_COMPROBABLE)
  })
})

describe('F2-W3 · recibo de comprobación', () => {
  // Frases que afirman ausencia. Ninguna puede aparecer sin su denominador.
  const ABSENCE_PATTERNS = [
    /sin contradicciones/i,
    /no se han? detectado/i,
    /ninguna contradicha/i,
    /sin problemas/i,
    /nada que contradecir/i,
  ]

  // Frases que afirman sobre el texto en su conjunto. Prohibidas siempre.
  const WHOLE_TEXT_PATTERNS = [
    /el brief est[áa] bien/i,
    /el texto est[áa] bien/i,
    /todo correcto/i,
    /todo en orden/i,
    /puedes seguir/i,
    /con confianza/i,
    /aprobado/i,
  ]

  const LIMPIO = [
    'Seguimos en la rama `feat/limpia`.',
    'El PR #7 sigue abierto.',
    'El fichero `src/App.tsx` ya contiene la lógica.',
    'Partimos del commit a1b2c3d.',
  ].join('\n')

  const limpio = () =>
    analyze(LIMPIO, {
      branches: ['feat/limpia'],
      paths: ['src/App.tsx'],
      commits: ['a1b2c3d'],
      prs: { 7: { state: 'OPEN', headRefName: 'feat/limpia', baseRefName: 'main' } },
    })

  it('10 · sin contradicciones, el reporte nombra cada sostenida en su propia línea', () => {
    const verdicts = limpio()
    const report = formatReport(verdicts)

    expect(globalSignal(verdicts)).toBe(PUEDE_IR)
    expect(report).toContain('Sostenidas (4):')
    expect(report).toContain('- rama feat/limpia existe')
    expect(report).toContain('- PR #7 abierto contra main')
    expect(report).toContain('- ruta src/App.tsx existe en HEAD')
    expect(report).toContain('- commit a1b2c3d existe')

    // Una línea por afirmación, ni más ni menos.
    const receipt = report.split('\n').filter((line) => line.startsWith('- '))
    expect(receipt).toHaveLength(4)
  })

  it('11 · con contradicciones, las sostenidas siguen apareciendo y van después', () => {
    const text = `${LIMPIO}\nRama nueva: \`feat/ya-existe\`.`
    const verdicts = analyze(text, {
      branches: ['feat/limpia', 'feat/ya-existe'],
      paths: ['src/App.tsx'],
      commits: ['a1b2c3d'],
      prs: { 7: { state: 'OPEN', headRefName: 'feat/limpia', baseRefName: 'main' } },
    })
    const report = formatReport(verdicts)

    expect(globalSignal(verdicts)).toBe(PARA)
    expect(report).toContain('Sostenidas (4):')
    expect(report.indexOf('feat/ya-existe')).toBeLessThan(report.indexOf('Sostenidas ('))
  })

  it('12 · ninguna frase de ausencia aparece sin su número en la misma línea', () => {
    const reports = [
      formatReport(limpio()),
      formatReport(limpio(), { countLine: 'corridas: 9 · última contradicción: ninguna' }),
      formatReport(analyze('Rama nueva: `feat/x`.', { branches: ['feat/x'] })),
      formatReport(analyze('Un texto sobre producto, sin nada verificable.', {})),
    ]

    for (const report of reports) {
      for (const line of report.split('\n')) {
        const declaresAbsence = ABSENCE_PATTERNS.some((pattern) => pattern.test(line))
        if (declaresAbsence) expect(line).toMatch(/\d/)
      }
    }
  })

  it('13 · cero afirmaciones no usa frase de ausencia y dice que no encontró nada comprobable', () => {
    const verdicts = analyze('Deberíamos centrarnos en que el producto se entienda a la primera.', {})
    const report = formatReport(verdicts)

    expect(verdicts).toHaveLength(0)
    expect(report).toContain('No se ha encontrado en el texto nada que git o gh puedan comprobar.')
    for (const pattern of ABSENCE_PATTERNS) expect(report).not.toMatch(pattern)
  })

  it('14 · el reporte nunca afirma nada sobre el texto en su conjunto', () => {
    const reports = [
      formatReport(limpio()),
      formatReport(analyze('Rama nueva: `feat/x`.', { branches: ['feat/x'] })),
      formatReport(analyze('Un texto sobre producto, sin nada verificable.', {})),
    ]

    for (const report of reports) {
      for (const pattern of WHOLE_TEXT_PATTERNS) expect(report).not.toMatch(pattern)
    }
  })

  it('la línea de cuenta va al final, y sin ella el reporte sigue siendo válido', () => {
    const conCuenta = formatReport(limpio(), { countLine: 'corridas: 9 · última contradicción: hace 2 corridas' })
    const sinCuenta = formatReport(limpio())

    expect(conCuenta.trim().endsWith('corridas: 9 · última contradicción: hace 2 corridas')).toBe(true)
    expect(sinCuenta).not.toContain('corridas:')
  })
})
