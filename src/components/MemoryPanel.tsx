import { useState } from 'react'
import { PACK_FIELD_LABELS } from '../types'
import type { MemoryUpdate } from '../types'

const ACTION_LABELS: Record<MemoryUpdate['action'], string> = {
  add: 'Añadir a',
  replace: 'Sustituir',
  remove: 'Quitar de',
}

type Props = {
  updates: MemoryUpdate[]
  resolved: Record<string, 'applied' | 'dismissed'>
  onApply: (update: MemoryUpdate) => void
  onDismiss: (id: string) => void
}

export function MemoryPanel({ updates, resolved, onApply, onDismiss }: Props) {
  // Las propuestas críticas exigen un segundo clic explícito antes de escribir.
  const [armed, setArmed] = useState<string | null>(null)

  const pending = updates.filter((update) => !resolved[update.id])
  const appliedCount = updates.filter((update) => resolved[update.id] === 'applied').length
  const dismissedCount = updates.filter((update) => resolved[update.id] === 'dismissed').length

  return (
    <section className="panel memory-panel" aria-labelledby="memory-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Memoria propuesta</p>
          <h2 id="memory-title">Lo que Relé propone actualizar</h2>
        </div>
      </div>

      <p className="field-hint">
        Nada de esto se escribe solo. Las propuestas marcadas como decisión piden una confirmación extra.
      </p>

      {!updates.length && <p className="block-empty">Esta pieza no propone cambios en el Project Pack.</p>}

      {pending.length > 0 && (
        <ul className="memory-list">
          {pending.map((update) => {
            const isArmed = armed === update.id
            return (
              <li className={update.critical ? 'memory-item memory-critical' : 'memory-item'} key={update.id}>
                <div className="memory-head">
                  <span className="pill">
                    {ACTION_LABELS[update.action]} · {PACK_FIELD_LABELS[update.field]}
                  </span>
                  {update.critical && <span className="pill pill-warn">Decisión</span>}
                </div>
                <p className="memory-value">{update.value}</p>
                <p className="field-hint">{update.reason}</p>
                <div className="memory-actions">
                  {update.critical && !isArmed ? (
                    <button className="button button-secondary" type="button" onClick={() => setArmed(update.id)}>
                      Aplicar…
                    </button>
                  ) : (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => {
                        onApply(update)
                        setArmed(null)
                      }}
                    >
                      {update.critical ? 'Confirmar cambio de decisión' : 'Aplicar'}
                    </button>
                  )}
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      onDismiss(update.id)
                      setArmed(null)
                    }}
                  >
                    Descartar
                  </button>
                </div>
                {update.critical && isArmed && (
                  <p className="memory-warning" role="status">
                    Esto cambia una decisión viva del proyecto ({PACK_FIELD_LABELS[update.field]}). Confirma solo si ya
                    está acordado.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {(appliedCount > 0 || dismissedCount > 0) && (
        <p className="feedback" role="status" aria-live="polite">
          {appliedCount} aplicada(s) · {dismissedCount} descartada(s).
        </p>
      )}
    </section>
  )
}
