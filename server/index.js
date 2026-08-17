import express from 'express'
import dotenv from 'dotenv'
import { MODEL, extract, hasApiKey } from './extractor.js'

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

app.listen(PORT, () => {
  const mode = hasApiKey() ? `real (${MODEL})` : 'demo (sin API key)'
  console.log(`[rele] backend local en http://localhost:${PORT} · modo ${mode}`)
})
