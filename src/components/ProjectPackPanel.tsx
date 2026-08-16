import { useRef } from 'react'
import { PACK_FIELD_LABELS, PACK_LIST_FIELDS, PACK_TEXT_FIELDS } from '../types'
import type { PackListField, PackTextField, ProjectPack } from '../types'

const TEXT_HINTS: Record<PackTextField, string> = {
  project: 'Nombre corto del proyecto.',
  destination: 'A dónde vamos. El criterio último de si algo acerca o aleja.',
  currentWaypoint: 'Dónde estamos ahora y qué se está cerrando.',
  nextSeat: 'Quién debería tener la pelota si nada se rompe.',
}

const LIST_HINTS: Record<PackListField, string> = {
  blockingGates: 'Condiciones que deben pasar antes de escribir o desplegar.',
  liveRules: 'Normas vigentes del proyecto. Cambiarlas es una decisión.',
  liveRisks: 'Formas conocidas de perder el hilo.',
  parked: 'Fuera de alcance por ahora, pero no olvidado.',
}

function listToText(items: string[]) {
  return items.join('\n')
}

function textToList(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatUpdatedAt(value: string) {
  if (!value) return 'Nunca guardado en esta máquina.'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

type Props = {
  pack: ProjectPack
  missing: string[]
  onChange: (pack: ProjectPack) => void
  onExport: () => void
  onImport: (text: string) => void
  onReset: () => void
  feedback: string
}

export function ProjectPackPanel({ pack, missing, onChange, onExport, onImport, onReset, feedback }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    onImport(await file.text())
  }

  return (
    <section className="panel pack-panel" aria-labelledby="pack-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Memoria operativa</p>
          <h2 id="pack-title">Project Pack UXM</h2>
        </div>
        <div className="panel-actions">
          <button className="text-button" type="button" onClick={onExport}>
            Exportar Project Pack
          </button>
          <button className="text-button" type="button" onClick={() => fileInput.current?.click()}>
            Importar Project Pack
          </button>
          <button className="text-button" type="button" onClick={onReset}>
            Restaurar semilla
          </button>
          <input
            accept="application/json,.json"
            aria-label="Archivo de Project Pack"
            className="visually-hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0])
              event.target.value = ''
            }}
            ref={fileInput}
            type="file"
          />
        </div>
      </div>

      {missing.length > 0 && (
        <p className="pack-warning" role="status">
          Faltan campos mínimos ({missing.join(', ')}). Relé devolverá <strong>FALTA MAPA</strong> hasta completarlos.
        </p>
      )}

      <div className="pack-grid">
        {PACK_TEXT_FIELDS.map((field) => (
          <div className="field" key={field}>
            <label htmlFor={`pack-${field}`}>{PACK_FIELD_LABELS[field]}</label>
            <p className="field-hint">{TEXT_HINTS[field]}</p>
            <textarea
              id={`pack-${field}`}
              onChange={(event) => onChange({ ...pack, [field]: event.target.value })}
              rows={field === 'project' || field === 'nextSeat' ? 1 : 3}
              value={pack[field]}
            />
          </div>
        ))}

        {PACK_LIST_FIELDS.map((field) => (
          <div className="field" key={field}>
            <label htmlFor={`pack-${field}`}>{PACK_FIELD_LABELS[field]}</label>
            <p className="field-hint">{LIST_HINTS[field]} Una línea por entrada.</p>
            <textarea
              id={`pack-${field}`}
              onChange={(event) => onChange({ ...pack, [field]: textToList(event.target.value) })}
              rows={4}
              value={listToText(pack[field])}
            />
          </div>
        ))}
      </div>

      <p className="field-hint pack-footer">
        Última actualización: {formatUpdatedAt(pack.updatedAt)} · Guardado local en este navegador.
      </p>
      <p className="feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </section>
  )
}
