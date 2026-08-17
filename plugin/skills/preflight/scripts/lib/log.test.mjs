// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { DISABLE_ENV, appendRun, buildEntry, countLine, readStats } from './log.mjs'

/** Registro en memoria. Ningún test toca el disco salvo el de integración. */
function memoryLog(initial = null) {
  let content = initial
  return {
    io: {
      read: () => {
        if (content === null) throw new Error('ENOENT')
        return content
      },
      append: (_path, chunk) => {
        content = (content ?? '') + chunk
      },
      mkdir: () => {},
    },
    get lines() {
      return (content ?? '').split('\n').filter((line) => line.trim())
    },
  }
}

const brokenLog = {
  read: () => {
    throw new Error('EACCES')
  },
  append: () => {
    throw new Error('EACCES')
  },
  mkdir: () => {
    throw new Error('EACCES')
  },
}

function entry({ contradiction = false } = {}) {
  return buildEntry({
    date: '2026-08-17T10:00:00.000Z',
    repo: '/repo',
    branch: 'main',
    signal: contradiction ? 'PARA' : 'PUEDE IR',
    text: 'texto de entrada',
    verdicts: [
      {
        claim: { quote: 'cita', type: 'branch', pathIntent: null, assertion: 'exists' },
        bucket: contradiction ? 'CONTRADICHA' : 'SOSTENIDA',
        command: 'git branch -a --list feat/x',
      },
    ],
    version: '0.2.0',
  })
}

function seed(runs) {
  return runs.map((contradiction) => JSON.stringify(entry({ contradiction }))).join('\n') + '\n'
}

describe('registro', () => {
  it('1 · una corrida anexa exactamente una línea', () => {
    const log = memoryLog()

    expect(appendRun(entry(), { path: '/x.jsonl', env: {}, io: log.io })).toBe(true)

    expect(log.lines).toHaveLength(1)
    expect(JSON.parse(log.lines[0]).senal).toBe('PUEDE IR')
  })

  it('2 · dos corridas anexan dos líneas y la primera queda intacta', () => {
    const log = memoryLog()

    appendRun(entry(), { path: '/x.jsonl', env: {}, io: log.io })
    const first = log.lines[0]
    appendRun(entry({ contradiction: true }), { path: '/x.jsonl', env: {}, io: log.io })

    expect(log.lines).toHaveLength(2)
    expect(log.lines[0]).toBe(first)
    expect(JSON.parse(log.lines[1]).senal).toBe('PARA')
  })

  it('3 · una línea corrupta no impide anexar ni contar', () => {
    const log = memoryLog(`${JSON.stringify(entry())}\nesto no es json\n`)

    expect(appendRun(entry(), { path: '/x.jsonl', env: {}, io: log.io })).toBe(true)

    expect(log.lines).toHaveLength(3)
    // La corrupta se salta; las dos legibles cuentan.
    expect(readStats('/x.jsonl', log.io).total).toBe(2)
  })

  it('4 · un destino no escribible no rompe la corrida', () => {
    expect(() => appendRun(entry(), { path: '/no/escribible.jsonl', env: {}, io: brokenLog })).not.toThrow()
    expect(appendRun(entry(), { path: '/no/escribible.jsonl', env: {}, io: brokenLog })).toBe(false)
    // Y leer tampoco: degrada a "no hay registro".
    expect(readStats('/no/escribible.jsonl', brokenLog)).toBeNull()
  })

  it('5 · la variable de desactivación impide toda escritura', () => {
    const log = memoryLog()

    expect(appendRun(entry(), { path: '/x.jsonl', env: { [DISABLE_ENV]: '1' }, io: log.io })).toBe(false)

    expect(log.lines).toHaveLength(0)
  })
})

describe('línea de cuenta', () => {
  it('7 · 12 corridas con la última contradicción en la 3', () => {
    const runs = Array.from({ length: 12 }, (_, index) => index === 2)
    const log = memoryLog(seed(runs))

    expect(countLine(readStats('/x.jsonl', log.io))).toBe('corridas: 12 · última contradicción: hace 9 corridas')
  })

  it('8 · sin ninguna contradicción', () => {
    const log = memoryLog(seed([false, false, false]))

    expect(countLine(readStats('/x.jsonl', log.io))).toBe('corridas: 3 · última contradicción: ninguna')
  })

  it('9 · registro ausente o corrupto omite la línea entera', () => {
    expect(countLine(readStats('/x.jsonl', memoryLog().io))).toBeNull()
    expect(countLine(readStats('/x.jsonl', memoryLog('basura\nmás basura\n').io))).toBeNull()
  })
})

describe('cero escrituras en el repo analizado', () => {
  const temp = mkdtempSync(join(tmpdir(), 'rele-log-'))
  afterAll(() => rmSync(temp, { recursive: true, force: true }))

  it('6 · una corrida real no toca el árbol ni el HEAD del repo', () => {
    const repo = process.cwd()
    const git = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
    const snapshot = () => git(['status', '--porcelain']) + git(['rev-parse', 'HEAD'])

    const before = snapshot()

    try {
      execFileSync(
        'node',
        [
          resolve(repo, 'plugin/skills/preflight/scripts/preflight.mjs'),
          '--file',
          resolve(repo, 'plugin/fixtures/002-brief-f1-w1-completo.md'),
        ],
        { cwd: repo, encoding: 'utf8', env: { ...process.env, RELE_LOG_PATH: join(temp, 'log.jsonl') } },
      )
    } catch {
      // Sale con código 1 cuando la señal es PARA. No es un fallo del test.
    }

    expect(snapshot()).toBe(before)
  })
})
