import { existsSync, statSync } from 'node:fs'
import express from 'express'
import dotenv from 'dotenv'
import { MODEL, extract, hasApiKey } from './extractor.js'
import { normalizeProjectPath } from './paths.js'

// Una sola fuente: la app importa exactamente los módulos que ejecuta el
// plugin. No hay copia de la lógica de comprobación; si el plugin cambia, la
// caja cambia con él.
import { extractClaims } from '../plugin/skills/preflight/scripts/lib/claims.mjs'
import { nodeRunner, verifyClaims } from '../plugin/skills/preflight/scripts/lib/verify.mjs'
import { formatReport, globalSignal } from '../plugin/skills/preflight/scripts/lib/report.mjs'
import {
  appendRun,
  buildEntry,
  countLine,
  defaultLogPath,
  readStats,
} from '../plugin/skills/preflight/scripts/lib/log.mjs'
import { PLUGIN_VERSION } from '../plugin/skills/preflight/scripts/lib/version.mjs'
import { permissionVerdicts } from '../plugin/skills/preflight/scripts/lib/permission.mjs'

// La clave vive solo aquí. El frontend nunca la ve.
dotenv.config({ path: '.env.local' })

const app = express()
app.use(express.json({ limit: '2mb' }))

const PORT = Number(process.env.RELE_PORT || 8787)

app.get('/api/health', (_req, res) => {
  res.json({ mode: hasApiKey() ? 'real' : 'demo', model: MODEL })
})

app.post('/api/extract', async (req, res) => {
  if (!hasApiKey()) {
    res.status(503).json({ ok: false, error: 'no hay ANTHROPIC_API_KEY configurada' })
    return
  }

  const { input, source, pack } = req.body ?? {}
  if (typeof input !== 'string' || !input.trim()) {
    res.status(400).json({ ok: false, error: 'falta la pieza a analizar' })
    return
  }
  if (!pack || typeof pack !== 'object') {
    res.status(400).json({ ok: false, error: 'falta el Project Pack' })
    return
  }

  try {
    const analysis = await extract({ input, source, pack })
    res.json({ ok: true, analysis })
  } catch (error) {
    console.error('[rele] extract falló:', error)
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'error desconocido' })
  }
})

/**
 * Traduce el estado de la carpeta a una frase que se entienda. La traza del
 * error no le sirve a nadie que esté pegando un brief en una caja.
 */
function checkProject(projectPath) {
  if (!existsSync(projectPath)) return 'Esa carpeta no existe.'
  if (!statSync(projectPath).isDirectory()) return 'Esa ruta es un fichero, no una carpeta.'

  const run = nodeRunner(projectPath)
  if (!run('git', ['rev-parse', '--is-inside-work-tree']).ok) {
    return 'Esa carpeta no es un repositorio git.'
  }
  return null
}

app.post('/api/preflight', (req, res) => {
  const { text, projectPath, zone, seat } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ ok: false, error: 'No hay texto que comprobar.' })
    return
  }
  // Se normaliza una sola vez, antes de tocar el disco: lo que llega de la caja
  // puede venir entrecomillado por "Copiar como ruta".
  const repo = normalizeProjectPath(projectPath)
  if (!repo) {
    res.status(400).json({ ok: false, error: 'Falta la carpeta del proyecto contra el que comprobar.' })
    return
  }

  const problem = checkProject(repo)
  if (problem) {
    res.status(400).json({ ok: false, error: problem })
    return
  }

  const run = nodeRunner(repo)

  try {
    const verdicts = [
      ...verifyClaims(extractClaims(text), { run, text, baseRef: 'HEAD' }),
      ...permissionVerdicts(text, { zone }),
    ]
    const signal = globalSignal(verdicts)

    const logPath = defaultLogPath()
    const stats = readStats(logPath)
    const cuenta = countLine(stats)
    const report = formatReport(verdicts, { countLine: cuenta })

    const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    appendRun(
      buildEntry({
        date: new Date().toISOString(),
        repo,
        branch: branch.ok ? branch.stdout.trim() : null,
        signal,
        text,
        verdicts,
        version: PLUGIN_VERSION,
        origin: 'app',
        zone: zone ?? null,
        // El asiento se graba, no se usa: no toca la señal ni el reporte.
        seat: typeof seat === 'string' && seat.trim() ? seat.trim() : null,
      }),
      { path: logPath },
    )

    res.json({
      ok: true,
      signal,
      report,
      countLine: cuenta,
      // Un aviso, no un error: sin gh los PR pasan a no comprobables y la señal
      // no empeora por ello.
      notice: run('gh', ['--version']).ok
        ? null
        : 'No encuentro gh, así que no puedo comprobar los pull requests. El resto sí.',
      claims: verdicts.map((item) => ({
        cita: item.claim.quote,
        tipo: item.claim.type,
        valor: item.claim.value,
        cubo: item.bucket,
        dice: item.repoSays,
        comando: item.command,
      })),
    })
  } catch (error) {
    console.error('[rele] preflight falló:', error)
    res.status(500).json({ ok: false, error: 'No he podido completar la comprobación en esa carpeta.' })
  }
})

app.listen(PORT, () => {
  const mode = hasApiKey() ? `real (${MODEL})` : 'demo (sin API key)'
  console.log(`[rele] backend local en http://localhost:${PORT} · modo ${mode}`)
})
