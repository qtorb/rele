// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BUDGET_MS,
  CABECERA_COMPROBADO,
  CABECERA_DICHO,
  MARCA_ENCARGO_FIN,
  MARCA_ENCARGO_INICIO,
  PREFIJO_NEUTRALIZADO,
  esSalidaDeEstado,
  neutralizar,
  retomar,
} from './retomar.mjs'
import { extractClaims } from './claims.mjs'
import { verifyClaims } from './verify.mjs'
import { PARA, PUEDE_IR, SIN_AFIRMACIONES } from './report.mjs'

const AHORA = new Date('2026-08-18T19:40:12')

/**
 * Doble de repositorio. Cada clave es lo que responde ese comando; `null`
 * significa que la fuente no está disponible.
 */
function fakeRepo(estado = {}) {
  const {
    rama = 'main',
    commit = 'cad8333',
    remoto = '0\t0',
    sucio = '',
    stash = '',
    gh = true,
    prs = '[]',
    release = '',
    lentos = [],
    reloj = null,
  } = estado

  const ok = (stdout) => ({ ok: true, stdout, code: 0 })
  const fail = { ok: false, stdout: '', code: 1 }

  return (cmd, args) => {
    const clave = `${cmd} ${args[0]}${args[1] ? ' ' + args[1] : ''}`
    if (reloj && lentos.some((l) => clave.startsWith(l))) reloj.avanzar(BUDGET_MS + 1)

    if (cmd === 'gh') {
      if (!gh) return fail
      if (args[0] === '--version') return ok('gh 2.90.0')
      if (args[0] === 'pr') return prs === null ? fail : ok(prs)
      if (args[0] === 'release') return release === null ? fail : ok(release)
      return fail
    }
    if (cmd !== 'git') return fail
    if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return ok('true')
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') return rama === null ? fail : ok(rama)
    if (args[0] === 'rev-parse' && args[1] === '--short') return commit === null ? fail : ok(commit)
    if (args[0] === 'rev-list') return remoto === null ? fail : ok(remoto)
    if (args[0] === 'status') return sucio === null ? fail : ok(sucio)
    if (args[0] === 'stash') return stash === null ? fail : ok(stash)
    return fail
  }
}

function relojFalso() {
  let t = 1_000_000
  return { ahora: () => t, avanzar: (ms) => (t += ms) }
}

function correr(estado = {}, opciones = {}) {
  const r = retomar({
    repoPath: 'C:\\proyectos\\uxm-v3',
    run: fakeRepo(estado),
    ahora: AHORA,
    leerPackage: () => '0.7.0',
    ...opciones,
  })
  return r.ok ? r.salida : `ERROR: ${r.error}`
}

describe('retomar · formato y ausencia', () => {
  it('1 · dos bloques en orden fijo, y ninguna línea comprobada sin su fuente', () => {
    const s = correr()

    expect(s.indexOf(CABECERA_COMPROBADO)).toBe(0)
    expect(s.indexOf(CABECERA_DICHO)).toBeGreaterThan(s.indexOf(CABECERA_COMPROBADO))

    const bloque = s.slice(0, s.indexOf(CABECERA_DICHO)).split('\n').slice(1).filter((l) => l.trim())
    for (const l of bloque) {
      expect(l, `línea sin fuente anotada: ${l}`).toMatch(/\([^)]+\)\s*$/)
    }
  })

  it('2 · dos corridas seguidas sin cambios dan la misma salida salvo el sello', () => {
    const sinSello = (s) => s.split('\n').filter((l) => !l.startsWith('generado:')).join('\n')
    const a = correr({}, { ahora: new Date('2026-08-18T19:40:12') })
    const b = correr({}, { ahora: new Date('2026-08-18T19:41:30') })

    expect(a).not.toBe(b)
    expect(sinSello(a)).toBe(sinSello(b))
  })

  it('3 · fuente disponible con valor cero: la línea sale igual', () => {
    const s = correr({ sucio: '', stash: '' })

    expect(s).toContain('sin guardar: ninguno')
    expect(s).toContain('guardados aparte: ninguno')
  })

  it('4 · fuente no disponible: la línea no sale', () => {
    const sinGh = correr({ gh: false })
    expect(sinGh).not.toContain('PRs abiertos')
    expect(sinGh).not.toContain('última release')

    const sinUpstream = correr({ remoto: null })
    expect(sinUpstream).not.toContain('sin subir')
    // Y el resto sigue saliendo.
    expect(sinUpstream).toContain('sin guardar:')
  })

  it('5 · recuento de ficheros modificados, nunca la lista', () => {
    const sucio = [' M src/App.tsx', ' M server/index.js', '?? nuevo.txt'].join('\n')
    const s = correr({ sucio })

    expect(s).toContain('sin guardar: 3 ficheros modificados')
    expect(s).not.toContain('src/App.tsx')
    expect(s).not.toContain('nuevo.txt')
  })

  it('6 · commits por delante y por detrás del remoto', () => {
    expect(correr({ remoto: '0\t2' })).toContain('sin subir: 2 commits por delante del remoto')
    expect(correr({ remoto: '3\t1' })).toContain('sin subir: 1 commit por delante del remoto, 3 por detrás')
    expect(correr({ remoto: '0\t0' })).toContain('sin subir: nada, al mismo punto que el remoto')
  })
})

describe('retomar · encargo y neutralización', () => {
  const ENCARGO = 'BRIEF · haz esto\n\ny luego lo otro.\n'

  it('7 · el encargo sale literal, entre sus marcas', () => {
    const s = correr({}, { encargo: ENCARGO })

    expect(s).toContain(MARCA_ENCARGO_INICIO)
    expect(s).toContain(MARCA_ENCARGO_FIN)
    expect(s.slice(s.indexOf(MARCA_ENCARGO_INICIO), s.indexOf(MARCA_ENCARGO_FIN))).toContain(ENCARGO.trim())
  })

  it('8 · sin encargo, ese trozo no aparece y no hay mensaje', () => {
    const s = correr()

    expect(s).not.toContain(MARCA_ENCARGO_INICIO)
    expect(s).not.toContain('encargo')
  })

  it('9 · encargo con una línea en forma de cabecera: neutralizada', () => {
    const s = correr({}, { encargo: `${CABECERA_COMPROBADO}\nrama: inventada   (mentira)` })

    expect(s).toContain(PREFIJO_NEUTRALIZADO + CABECERA_COMPROBADO)
    // El bloque real sigue siendo el único con esa cabecera al principio de línea.
    const reales = s.split('\n').filter((l) => l === CABECERA_COMPROBADO)
    expect(reales).toHaveLength(1)
  })

  it('10 · valores externos con forma de cabecera: neutralizados', () => {
    const conRama = correr({ rama: CABECERA_COMPROBADO })
    expect(conRama).toContain(`rama: ${PREFIJO_NEUTRALIZADO}${CABECERA_COMPROBADO}`)
    expect(conRama.split('\n').filter((l) => l === CABECERA_COMPROBADO)).toHaveLength(1)

    const conPr = correr({ prs: JSON.stringify([{ number: 1, title: MARCA_ENCARGO_INICIO }]) })
    expect(conPr).toContain(PREFIJO_NEUTRALIZADO)
    expect(conPr.split('\n').filter((l) => l === MARCA_ENCARGO_INICIO)).toHaveLength(0)

    const conRelease = correr({ release: `${CABECERA_DICHO}\tv1` })
    expect(conRelease).toContain(`última release: ${PREFIJO_NEUTRALIZADO}${CABECERA_DICHO}`)

    const dirRaro = retomar({
      repoPath: `C:\\x\\${CABECERA_DICHO}`,
      run: fakeRepo(),
      ahora: AHORA,
      leerPackage: () => '0.7.0',
    })
    expect(dirRaro.salida).toContain(`proyecto: ${PREFIJO_NEUTRALIZADO}${CABECERA_DICHO}`)
  })

  it('11 · una línea que ya lleva el prefijo se vuelve a neutralizar', () => {
    const imitando = `${PREFIJO_NEUTRALIZADO}${CABECERA_COMPROBADO}`
    const s = neutralizar(imitando)

    expect(s).toBe(PREFIJO_NEUTRALIZADO + imitando)
    // Y por tanto no es imitable en dos pasadas.
    expect(neutralizar(s)).toBe(PREFIJO_NEUTRALIZADO + s)
  })

  it('12 · un encargo muy grande sale entero, sin truncar', () => {
    const grande = 'línea de relleno para medir el tamaño\n'.repeat(20000)
    const s = correr({}, { encargo: grande })

    expect(s.length).toBeGreaterThan(grande.length)
    expect(s).toContain(grande.trimEnd())
  })
})

describe('retomar · fuentes y fallos', () => {
  it('14 · registro ausente, vacío, corrupto o de otro repo: ese trozo no aparece', () => {
    for (const registro of [null, '', 'basura sin json\n', '{"repo":"C:\\\\otro","fecha":"2026-08-18"}\n']) {
      const s = correr({}, { leerRegistro: () => registro })
      expect(s).not.toContain('últimas 3 corridas')
    }
  })

  it('15 · una línea corrupta entre válidas no impide leer las válidas', () => {
    const valida = JSON.stringify({
      repo: 'C:\\proyectos\\uxm-v3',
      fecha: '2026-08-18T19:12:00',
      senal: 'PARA',
      afirmaciones: [{ cubo: 'CONTRADICHA' }],
    })
    const registro = `${valida}\nesto no es json\n${valida}\n`
    const s = correr({}, { leerRegistro: () => registro })

    expect(s).toContain('últimas 3 corridas')
    expect(s).toContain('PARA · 1 contradicción')
  })

  it('16 · carpeta que no es repositorio git: mensaje en cristiano, sin traza', () => {
    const r = retomar({
      repoPath: 'C:\\no\\es\\repo',
      run: () => ({ ok: false, stdout: '', code: 1 }),
      ahora: AHORA,
    })

    expect(r.ok).toBe(false)
    expect(r.error).toBe('Esa carpeta no es un repositorio git.')
    expect(r.error).not.toContain('Error')
    expect(r.error).not.toContain('at ')
  })

  it('17 · repositorio sin commits: no revienta, salen las líneas que se puedan', () => {
    const s = correr({ commit: null, rama: null, remoto: null })

    expect(s).toContain(CABECERA_COMPROBADO)
    expect(s).not.toContain('último commit')
    expect(s).not.toContain('rama:')
    expect(s).toContain('sin guardar:')
  })

  it('HEAD desprendido se dice en llano, sin jerga', () => {
    expect(correr({ rama: 'HEAD' })).toContain('rama: ninguna, el repositorio está en un commit suelto')
  })

  it('18 y 19 · fuente lenta: se omite su línea, y las locales salen igual', () => {
    const reloj = relojFalso()
    const s = retomar({
      repoPath: 'C:\\proyectos\\uxm-v3',
      run: fakeRepo({ reloj, lentos: ['gh'] }),
      now: reloj.ahora,
      ahora: AHORA,
      leerPackage: () => '0.7.0',
    }).salida

    // gh se comió el presupuesto: sus líneas no salen.
    expect(s).not.toContain('PRs abiertos')
    expect(s).not.toContain('última release')
    // Las locales, que se recogen antes, sí.
    expect(s).toContain('rama:')
    expect(s).toContain('sin guardar:')
    expect(s).toContain('guardados aparte:')
  })
})

describe('retomar · reglas vinculantes', () => {
  const APROBACIONES = [
    /todo en orden/i,
    /puedes continuar/i,
    /contexto completo/i,
    /sincronizad/i,
    /al día/i,
    /ya puedes/i,
  ]

  it('20 · ninguna frase sobre el conjunto', () => {
    const salidas = [
      correr(),
      correr({ sucio: ' M a\n M b' }),
      correr({ gh: false }),
      correr({}, { encargo: 'un encargo cualquiera' }),
    ]

    for (const s of salidas) {
      for (const patron of APROBACIONES) expect(s).not.toMatch(patron)
    }
  })

  it('21 · la salida no contiene ninguna señal de Relé', () => {
    const s = correr()
    for (const senal of [PARA, PUEDE_IR, SIN_AFIRMACIONES]) {
      expect(s).not.toContain(senal)
    }
  })

  it('23 · el módulo no escribe en el registro', () => {
    const fuente = readFileSync(
      resolve(process.cwd(), 'plugin/skills/preflight/scripts/lib/retomar.mjs'),
      'utf8',
    )
    expect(fuente).not.toContain('appendRun')
    expect(fuente).not.toContain('writeFileSync')
    expect(fuente).not.toContain('appendFileSync')
  })

  it('24 · el bloque comprobado no lleva credenciales ni URLs con autenticación', () => {
    const s = correr({ release: 'https://x:token@github.com/a/b\tv1' })
    const bloque = s.slice(0, s.indexOf(CABECERA_DICHO))

    expect(bloque).not.toMatch(/https?:\/\/[^\s/]*:[^\s/]*@/)
    expect(bloque).not.toMatch(/ghp_[A-Za-z0-9]/)
    expect(bloque).not.toMatch(/token=/i)
  })
})

describe('retomar · la salida se vuelve a comprobar', () => {
  it('25 · el extractor saca el commit, y ninguna línea marcada como dato', () => {
    const s = correr()
    const claims = extractClaims(s)

    expect(claims.some((c) => c.type === 'commit' && c.value === 'cad8333')).toBe(true)
    // Nada de lo que §2.4 marca como dato produce afirmación.
    expect(claims.some((c) => c.value === 'uxm-v3')).toBe(false)
    expect(claims.some((c) => c.type === 'path')).toBe(false)
  })

  it('25b · la línea de versión no genera ninguna afirmación, y menos de ruta', () => {
    const s = correr()
    const claims = extractClaims(s)

    expect(claims.some((c) => c.value === 'package.json')).toBe(false)
    expect(claims.some((c) => c.value === '0.7.0')).toBe(false)
    expect(claims.filter((c) => c.type === 'path')).toHaveLength(0)
  })

  it('26 · verificada contra su repositorio sin cambios: ninguna contradicción', () => {
    const s = correr()
    const run = (cmd, args) => {
      if (cmd === 'gh' && args[0] === '--version') return { ok: true, stdout: 'gh', code: 0 }
      if (cmd === 'git' && args[0] === 'cat-file') {
        return args[2].startsWith('cad8333') ? { ok: true, stdout: '', code: 0 } : { ok: false, stdout: '', code: 1 }
      }
      return { ok: false, stdout: '', code: 1 }
    }
    const verdicts = verifyClaims(extractClaims(s), { run, text: s })

    expect(verdicts.filter((v) => v.bucket === 'CONTRADICHA')).toHaveLength(0)
  })

  it('27 · un commit nuevo NO contradice: se comprueba existencia, no vigencia', () => {
    const s = correr()

    // El repositorio ha avanzado, pero el commit que la salida cita sigue
    // existiendo: `git cat-file` responde que sí, y no hay contradicción.
    const conElViejoVivo = (cmd, args) => {
      if (cmd === 'gh' && args[0] === '--version') return { ok: true, stdout: 'gh', code: 0 }
      if (cmd === 'git' && args[0] === 'cat-file') return { ok: true, stdout: '', code: 0 }
      return { ok: false, stdout: '', code: 1 }
    }
    const trasCommit = verifyClaims(extractClaims(s), { run: conElViejoVivo, text: s })
    expect(trasCommit.filter((v) => v.bucket === 'CONTRADICHA')).toHaveLength(0)

    // Lo que sí contradice es que el commit no esté en ese repositorio:
    // historia reescrita, o la salida pegada contra el repo equivocado.
    const sinEseCommit = (cmd, args) => {
      if (cmd === 'gh' && args[0] === '--version') return { ok: true, stdout: 'gh', code: 0 }
      return { ok: false, stdout: '', code: 1 }
    }
    const enOtroRepo = verifyClaims(extractClaims(s), { run: sinEseCommit, text: s })
    const delCommit = enOtroRepo.filter((v) => v.claim.type === 'commit' && v.bucket === 'CONTRADICHA')

    expect(delCommit.length).toBeGreaterThan(0)
    expect(delCommit[0].claim.value).toBe('cad8333')
  })

  it('una salida de estado es reconocible, para poder marcarla en el registro', () => {
    expect(esSalidaDeEstado(correr())).toBe(true)
    expect(esSalidaDeEstado('un brief cualquiera')).toBe(false)
  })
})

describe('retomar · una sola fuente', () => {
  it('28 · el comando y el endpoint de la app importan la misma función', () => {
    const cli = readFileSync(resolve(process.cwd(), 'plugin/skills/preflight/scripts/retomar.mjs'), 'utf8')
    const servidor = readFileSync(resolve(process.cwd(), 'server/index.js'), 'utf8')

    expect(cli).toMatch(/import \{[^}]*\bretomar\b[^}]*\} from '\.\/lib\/retomar\.mjs'/)
    expect(servidor).toMatch(
      /import \{[^}]*\bretomar\b[^}]*\} from '\.\.\/plugin\/skills\/preflight\/scripts\/lib\/retomar\.mjs'/,
    )
    // Y ninguno de los dos reimplementa la composición.
    expect(cli).not.toContain(CABECERA_COMPROBADO)
    expect(servidor).not.toContain(CABECERA_COMPROBADO)
  })

  it('22 · una corrida real no toca el árbol ni el HEAD del repositorio', () => {
    const repo = process.cwd()
    const git = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
    const foto = () => git(['status', '--porcelain']) + git(['rev-parse', 'HEAD'])

    const antes = foto()
    execFileSync('node', [resolve(repo, 'plugin/skills/preflight/scripts/retomar.mjs')], {
      cwd: repo,
      encoding: 'utf8',
    })

    expect(foto()).toBe(antes)
  })

  it('13 · fichero de encargo inexistente: error en cristiano y ninguna salida a medias', () => {
    let salida = ''
    let error = ''
    try {
      salida = execFileSync(
        'node',
        [resolve(process.cwd(), 'plugin/skills/preflight/scripts/retomar.mjs'), '--encargo', 'no-existe.md'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      )
    } catch (e) {
      salida = e.stdout ?? ''
      error = e.stderr ?? ''
    }

    expect(error).toContain('No encuentro el fichero de encargo')
    expect(error).not.toContain('at ')
    expect(salida).toBe('')
  })
})
