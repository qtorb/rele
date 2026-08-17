// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { BUDGET_MS, DISABLE_ENV, runHook } from './enganche.mjs'

/** Doble de repo. Ninguna llamada real a git ni a gh. */
function fakeRepo({ branches = [], paths = [], gh = true, esRepo = true } = {}) {
  const fail = { ok: false, stdout: '', stderr: '', code: 1 }
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
      return esRepo ? { ok: true, stdout: 'true\n', code: 0 } : fail
    }
    if (cmd === 'gh') {
      if (!gh) return fail
      if (args[0] === '--version') return { ok: true, stdout: 'gh 2.90.0', code: 0 }
      return fail
    }
    if (cmd === 'git') {
      const name = args[args.length - 1]
      if (args[0] === 'branch' || args[0] === 'ls-remote') {
        return { ok: true, stdout: branches.includes(name) ? `  ${name}\n` : '', code: 0 }
      }
      if (args[0] === 'ls-files') {
        const bare = args[args.length - 1]
        const hits = paths.filter((p) => p === bare || p.endsWith(`/${bare}`))
        return { ok: true, stdout: hits.join('\n'), code: 0 }
      }
      if (args[0] === 'cat-file') {
        const spec = args[2]
        const path = spec.slice(spec.indexOf(':') + 1)
        return paths.includes(path) ? { ok: true, stdout: '', code: 0 } : fail
      }
    }
    return fail
  }
}

/** Reloj falso que avanza los milisegundos que le digas por llamada. */
function reloj(pasoMs = 0) {
  let t = 1_000_000
  return () => {
    const ahora = t
    t += pasoMs
    return ahora
  }
}

const SOSTENIDO = 'Seguimos en la rama `feat/rele-f3-enganche` y el fichero `src/App.tsx` ya existe.'
const CONTRADICHO = 'Rama nueva: `feat/ya-existe`. Trabajamos ahí.'

describe('enganche · cuándo calla', () => {
  it('1 · un mensaje sin ninguna afirmación no produce salida', () => {
    const run = vi.fn(fakeRepo())
    const salida = runHook({
      prompt: 'Deberíamos centrarnos en que el producto se entienda a la primera.',
      run,
      env: {},
    })

    expect(salida).toBe('')
    // Ni siquiera toca el repositorio: la extracción es de patrones.
    expect(run).not.toHaveBeenCalled()
  })

  it('2 · un mensaje corto y trivial no produce salida', () => {
    for (const prompt of ['ok', 'sí', 'gracias', 'sigue', '', '   ']) {
      expect(runHook({ prompt, run: fakeRepo(), env: {} })).toBe('')
    }
  })

  it('7 · fuera de un repositorio git, silencio', () => {
    const salida = runHook({ prompt: SOSTENIDO, run: fakeRepo({ esRepo: false }), env: {} })

    expect(salida).toBe('')
  })

  it('6 · git que devuelve error se traga sin excepción', () => {
    const runQueRevienta = () => {
      throw new Error('git ha explotado')
    }

    expect(() => runHook({ prompt: SOSTENIDO, run: runQueRevienta, env: {} })).not.toThrow()
    expect(runHook({ prompt: SOSTENIDO, run: runQueRevienta, env: {} })).toBe('')
  })

  it('8 · la variable de desactivación lo apaga entero', () => {
    const run = vi.fn(fakeRepo({ branches: ['feat/ya-existe'] }))
    const salida = runHook({ prompt: CONTRADICHO, run, env: { [DISABLE_ENV]: '1' } })

    expect(salida).toBe('')
    expect(run).not.toHaveBeenCalled()
  })

  it('5 · si la verificación pasa del presupuesto, abandona y calla', () => {
    // Cada llamada al reloj avanza más que el presupuesto entero.
    const salida = runHook({
      prompt: CONTRADICHO,
      run: fakeRepo({ branches: ['feat/ya-existe'] }),
      now: reloj(BUDGET_MS + 1),
      env: {},
    })

    expect(salida).toBe('')
  })

  it('dentro del presupuesto sí habla', () => {
    const salida = runHook({
      prompt: CONTRADICHO,
      run: fakeRepo({ branches: ['feat/ya-existe'] }),
      now: reloj(1),
      env: {},
    })

    expect(salida).not.toBe('')
  })
})

describe('enganche · qué dice', () => {
  it('3 · todo sostenido produce exactamente una línea, sin recibo', () => {
    const salida = runHook({
      prompt: SOSTENIDO,
      run: fakeRepo({ branches: ['feat/rele-f3-enganche'], paths: ['src/App.tsx'] }),
      env: {},
    })

    expect(salida).toBe('Relé: 2 afirmaciones comprobadas, ninguna contradicha.')
    expect(salida.split('\n')).toHaveLength(1)
    expect(salida).not.toContain('Sostenidas')
    expect(salida).not.toContain('corridas:')
    expect(salida).not.toContain('Comprobado con:')
  })

  it('la línea concuerda el singular', () => {
    const salida = runHook({
      prompt: 'El fichero `src/App.tsx` ya existe.',
      run: fakeRepo({ paths: ['src/App.tsx'] }),
      env: {},
    })

    expect(salida).toBe('Relé: 1 afirmación comprobada, ninguna contradicha.')
  })

  it('4 · una contradicción produce el bloque completo, con cita y comando', () => {
    const salida = runHook({
      prompt: CONTRADICHO,
      run: fakeRepo({ branches: ['feat/ya-existe'] }),
      env: {},
    })

    expect(salida).toContain('PARA')
    expect(salida).toContain('«Rama nueva: `feat/ya-existe`. Trabajamos ahí.»')
    expect(salida).toContain('Comprobado con: git')
    expect(salida).toContain('ya existe')
  })

  it('si nada resultó comprobable, calla en vez de dar un recibo de cero', () => {
    // Rama mencionada de pasada y que no existe: no comprobable.
    const salida = runHook({ prompt: 'Quizá toquemos feat/algo-futuro.', run: fakeRepo(), env: {} })

    expect(salida).toBe('')
  })
})

describe('enganche · registro y no bloqueo', () => {
  it('9 · el registro recibe origen "enganche"', () => {
    const log = vi.fn()
    runHook({
      prompt: SOSTENIDO,
      cwd: '/repo/de/la/sesion',
      run: fakeRepo({ branches: ['feat/rele-f3-enganche'], paths: ['src/App.tsx'] }),
      env: {},
      log,
    })

    expect(log).toHaveBeenCalledTimes(1)
    const entrada = log.mock.calls[0][0]
    expect(entrada.origen).toBe('enganche')
    expect(entrada.repo).toBe('/repo/de/la/sesion')
    expect(entrada.afirmaciones).toHaveLength(2)
  })

  it('10 · nunca devuelve nada que pueda impedir seguir a la sesión', () => {
    const casos = [
      { prompt: 'nada que ver aquí', run: fakeRepo() },
      { prompt: SOSTENIDO, run: fakeRepo({ branches: ['feat/rele-f3-enganche'], paths: ['src/App.tsx'] }) },
      { prompt: CONTRADICHO, run: fakeRepo({ branches: ['feat/ya-existe'] }) },
      { prompt: SOSTENIDO, run: fakeRepo({ esRepo: false }) },
      {
        prompt: CONTRADICHO,
        run: () => {
          throw new Error('boom')
        },
      },
    ]

    for (const caso of casos) {
      const salida = runHook({ ...caso, env: {} })
      // Siempre una cadena. Nunca un objeto con `continue`, `decision` o similar.
      expect(typeof salida).toBe('string')
      expect(salida).not.toContain('"continue"')
      expect(salida).not.toContain('"decision"')
      expect(salida).not.toContain('permissionDecision')
    }
  })
})

describe('enganche · la entrada real, de punta a punta', () => {
  const temp = mkdtempSync(join(tmpdir(), 'rele-hook-'))
  afterAll(() => rmSync(temp, { recursive: true, force: true }))

  const entrada = resolve(process.cwd(), 'plugin/hooks/rele-enganche.mjs')

  function lanzar(evento, extraEnv = {}) {
    const logPath = join(temp, `log-${Math.abs(JSON.stringify(evento).length)}.jsonl`)
    const salida = execFileSync('node', [entrada], {
      input: JSON.stringify(evento),
      encoding: 'utf8',
      env: { ...process.env, RELE_LOG_PATH: logPath, ...extraEnv },
    })
    return { salida, logPath }
  }

  it('sale con código 0 y sin ruido ante un mensaje conversacional', () => {
    const { salida } = lanzar({
      hook_event_name: 'UserPromptSubmit',
      cwd: process.cwd(),
      user_prompt: 'Gracias, seguimos mañana.',
    })

    expect(salida).toBe('')
  })

  it('avisa, escribe el registro con origen enganche y no falla', () => {
    const { salida, logPath } = lanzar({
      hook_event_name: 'UserPromptSubmit',
      cwd: process.cwd(),
      user_prompt: 'Rama nueva: `feat/rele-f3-enganche`. Empezamos ahí.',
    })

    expect(salida).toContain('Relé:')
    expect(salida).toContain('PARA')

    const linea = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).pop()
    expect(JSON.parse(linea).origen).toBe('enganche')
  })

  it('un JSON de evento ilegible no rompe nada', () => {
    const salida = execFileSync('node', [entrada], { input: 'esto no es json', encoding: 'utf8' })

    expect(salida).toBe('')
  })
})
