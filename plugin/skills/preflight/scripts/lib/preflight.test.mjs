// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractClaims } from './claims.mjs'
import { CONTRADICHA, NO_COMPROBABLE, SOSTENIDA, verifyClaims } from './verify.mjs'
import { PARA, PUEDE_IR, SIN_AFIRMACIONES, formatReport, globalSignal } from './report.mjs'

const FIXTURE_001 = readFileSync(resolve(process.cwd(), 'plugin/fixtures/001-brief-f1-w1.md'), 'utf8')

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

  it('el reporte solo despliega las contradicciones y resume el resto en una línea', () => {
    const text = ['Rama nueva: feat/nueva-cosa.', 'El fichero src/App.tsx ya existe.', 'Quizá feat/otra.'].join('\n')
    const verdicts = analyze(text, { branches: ['feat/nueva-cosa'], paths: ['src/App.tsx'] })
    const report = formatReport(verdicts)

    expect(report).toContain('feat/nueva-cosa')
    expect(report).not.toContain('src/App.tsx existe')
    expect(report.trim().endsWith('1 sostenidas · 1 no comprobables')).toBe(true)
  })
})
