import { SIGNAL_COPY } from '../lib/signals'
import type { Analysis } from '../types'

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="block">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="block-empty">{empty}</p>
      )}
    </section>
  )
}

type Props = {
  analysis: Analysis
  copied: string
  onCopy: () => void
}

export function ResultPanel({ analysis, copied, onCopy }: Props) {
  const copy = SIGNAL_COPY[analysis.signal]

  return (
    <section className="result" aria-labelledby="signal-title">
      <section className={`signal-card signal-${copy.tone}`} aria-live="polite">
        <p className="signal-label">{copy.label}</p>
        <h2 id="signal-title">{copy.title}</h2>
        <p className="signal-explanation">{analysis.explanation}</p>
      </section>

      {analysis.engineNote && (
        <p className="degraded-note" role="status">
          {analysis.engineNote}
        </p>
      )}

      <div className="pill-row" aria-label="Resumen del análisis">
        <span className="pill">{analysis.input_type}</span>
        <span className="pill">{analysis.front.length ? analysis.front.join(' · ') : 'sin frente'}</span>
        <span className="pill">{analysis.can_advance ? 'puede avanzar' : 'no avanza'}</span>
        <span className="pill">{analysis.can_start_write ? 'WRITE permitido' : 'WRITE no permitido'}</span>
        <span className="pill">motor {analysis.engine}</span>
      </div>

      <section className="ball-card">
        <h3>Quién tiene la pelota: {analysis.next_seat}</h3>
        <p>{analysis.next_action}</p>
      </section>

      <div className="grid">
        <ListBlock
          title="Qué cambia"
          items={analysis.what_changes}
          empty="Nada que altere el waypoint actual."
        />
        <ListBlock title="Qué bloquea" items={analysis.what_blocks} empty="Sin bloqueo explícito." />
        <ListBlock
          title="Gates que deben pasar antes"
          items={analysis.blocking_gates}
          empty="Ningún gate bloqueante activo para esta pieza."
        />
        <ListBlock
          title="Contradicciones"
          items={analysis.contradictions}
          empty="No se detectan instrucciones incompatibles."
        />
        <ListBlock title="Riesgos vivos" items={analysis.risks} empty="Sin riesgos nuevos detectados." />
        <ListBlock
          title="Reglas detectadas"
          items={analysis.rules_detected}
          empty="La pieza no formula reglas nuevas."
        />
      </div>

      <section className="handoff-card" aria-labelledby="handoff-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Salida</p>
            <h3 id="handoff-title">Handoff listo para copiar</h3>
          </div>
          <button className="button button-secondary" onClick={onCopy} type="button">
            Copiar handoff
          </button>
        </div>
        <pre>{analysis.handoff}</pre>
        <p className="feedback" role="status" aria-live="polite">
          {copied || 'Relé no envía nada. Solo prepara el texto para que lo pegues tú.'}
        </p>
      </section>
    </section>
  )
}
