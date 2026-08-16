import { SOURCE_LABELS } from '../lib/signals'
import type { Source } from '../types'

type Props = {
  value: string
  source: Source
  mode: 'real' | 'demo'
  analyzing: boolean
  onChange: (value: string) => void
  onSourceChange: (source: Source) => void
  onAnalyze: () => void
  onClear: () => void
  onSample: (key: 'avance' | 'bloqueo' | 'stop' | 'gate') => void
}

export function InboxPanel({
  value,
  source,
  mode,
  analyzing,
  onChange,
  onSourceChange,
  onAnalyze,
  onClear,
  onSample,
}: Props) {
  const canAnalyze = value.trim().length > 0 && !analyzing

  return (
    <section className="panel inbox-panel" aria-labelledby="inbox-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2 id="inbox-title">Pega aquí lo último</h2>
        </div>
        <span className={`mode-badge mode-${mode}`}>{mode === 'real' ? 'Modo real' : 'Modo demo'}</span>
      </div>

      <div className="source-picker" role="group" aria-label="Origen de la pieza">
        <span className="field-hint source-label">Origen (opcional):</span>
        {(Object.keys(SOURCE_LABELS) as Source[]).map((option) => (
          <button
            aria-pressed={source === option}
            className={source === option ? 'choice choice-selected' : 'choice'}
            key={option}
            onClick={() => onSourceChange(option)}
            type="button"
          >
            {SOURCE_LABELS[option]}
          </button>
        ))}
      </div>

      <label htmlFor="inbox">Última salida del proyecto</label>
      <textarea
        id="inbox"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Brief, salida del builder, revisión, bloqueo o estado. Relé lo compara contra el Project Pack."
        rows={14}
        value={value}
      />

      <div className="actions">
        <button className="button button-primary" disabled={!canAnalyze} onClick={onAnalyze} type="button">
          {analyzing ? 'Analizando…' : 'Analizar'}
        </button>
        <button className="button button-secondary" onClick={onClear} type="button">
          Limpiar
        </button>
      </div>

      <div className="sample-actions">
        <span className="field-hint">Ejemplos:</span>
        <button className="text-button" type="button" onClick={() => onSample('avance')}>
          Avance
        </button>
        <button className="text-button" type="button" onClick={() => onSample('gate')}>
          Gate primero
        </button>
        <button className="text-button" type="button" onClick={() => onSample('bloqueo')}>
          Bloqueo
        </button>
        <button className="text-button" type="button" onClick={() => onSample('stop')}>
          STOP
        </button>
      </div>
    </section>
  )
}
