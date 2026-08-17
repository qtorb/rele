import { useEffect, useState } from 'react'

const PATH_KEY = 'rele.preflight.ruta'

type PreflightResult = {
  signal: string
  report: string
  notice: string | null
}

function loadPath() {
  try {
    return window.localStorage.getItem(PATH_KEY) ?? ''
  } catch {
    return ''
  }
}

function tone(signal: string) {
  if (signal === 'PARA') return 'stop'
  if (signal === 'PUEDE IR') return 'go'
  return 'hold'
}

export function PreflightPanel() {
  const [projectPath, setProjectPath] = useState(loadPath)
  const [text, setText] = useState('')
  const [result, setResult] = useState<PreflightResult | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  // La ruta se recuerda entre visitas: casi siempre es la misma carpeta.
  useEffect(() => {
    try {
      window.localStorage.setItem(PATH_KEY, projectPath)
    } catch {
      // Sin persistencia la ruta sigue viva en la sesión.
    }
  }, [projectPath])

  const check = async () => {
    setChecking(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/preflight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, projectPath }),
      })
      const data = (await response.json()) as { ok?: boolean; error?: string } & PreflightResult

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'No he podido completar la comprobación.')
        return
      }
      setResult({ signal: data.signal, report: data.report, notice: data.notice })
    } catch {
      setError('No encuentro el backend local. Arráncalo con npm run dev.')
    } finally {
      setChecking(false)
    }
  }

  const canCheck = text.trim().length > 0 && projectPath.trim().length > 0 && !checking

  return (
    <section className="panel preflight-panel" aria-labelledby="preflight-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Comprobación previa</p>
          <h2 id="preflight-title">Pega un brief y compruébalo contra el repo</h2>
        </div>
      </div>

      <p className="field-hint">
        Verifica lo que el texto afirma sobre el repositorio: ramas, pull requests, rutas de fichero y
        commits. No escribe nada en el proyecto.
      </p>

      <div className="field">
        <label htmlFor="preflight-path">Carpeta del proyecto</label>
        <textarea
          id="preflight-path"
          onChange={(event) => setProjectPath(event.target.value.replace(/\n/g, ''))}
          placeholder="C:\ruta\a\tu\proyecto"
          rows={1}
          value={projectPath}
        />
      </div>

      <div className="field">
        <label htmlFor="preflight-text">Texto a comprobar</label>
        <textarea
          id="preflight-text"
          onChange={(event) => setText(event.target.value)}
          placeholder="Pega aquí el brief, el plan o la propuesta."
          rows={12}
          value={text}
        />
      </div>

      <div className="actions">
        <button className="button button-primary" disabled={!canCheck} onClick={() => void check()} type="button">
          {checking ? 'Comprobando…' : 'Comprobar'}
        </button>
      </div>

      {error && (
        <p className="preflight-error" role="status">
          {error}
        </p>
      )}

      {result && (
        <section className="preflight-result" aria-live="polite">
          <p className={`signal-label preflight-signal preflight-${tone(result.signal)}`}>{result.signal}</p>
          {result.notice && (
            <p className="preflight-notice" role="status">
              {result.notice}
            </p>
          )}
          <pre>{result.report}</pre>
        </section>
      )}
    </section>
  )
}
