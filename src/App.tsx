import { useMemo, useState } from 'react'

type Source = 'auto' | 'builder' | 'producto' | 'cto' | 'gtm'
type SyncStatus = 'ejecutable' | 'bloqueado' | 'revision' | 'no-concluyente'

type SyncResult = {
  source: string
  front: string
  destination: string
  phase: string
  status: SyncStatus
  statusLabel: string
  now: string
  facts: string[]
  stops: string[]
  contracts: string[]
  memoryCandidates: string[]
  notMemory: string[]
  cover: string
}

const sourceLabels: Record<Source, string> = {
  auto: 'No sé',
  builder: 'Builder',
  producto: 'Producto',
  cto: 'CTO',
  gtm: 'GTM',
}

const sampleRelay = `# BRIEF C13 · rev.4 · EJECUTABLE

Fecha: 2026-08-16 · Autor: advisor de producto · Revisor: CTO adjudicado.

Ninguna cifra ni nombre de regla de este brief es dato de entrada.
Todos son afirmaciones a recomputar en el preflight.

Qué se hace:
- C13 corrige presentación del informe.
- No añade detectores.
- El foco ordena familias; no recorta ni jerarquiza.
- El formulario se nombra por dónde está, no por texto de botón.

STOP:
- Si algo exige tocar captura, admisión o carril externo: PARA y dilo.
- Si retirar una plantilla rompe un caso no cubierto: PARA y dilo.
- No se despliega: falta comprobar árbol limpio y turno de despliegue.
- Un encargo vivo a la vez hasta el 24.

Entrega:
- Veredicto.
- Evidencia.
- Tests.
- MODO_DE_FALLO_NO_PREVISTO.`

const emptyResult: SyncResult = {
  source: 'No detectado',
  front: 'No detectado',
  destination: 'No detectado',
  phase: 'NO CONCLUYENTE',
  status: 'no-concluyente',
  statusLabel: 'No concluyente',
  now: 'Falta una salida real que sincronizar.',
  facts: [],
  stops: [],
  contracts: [],
  memoryCandidates: [],
  notMemory: [],
  cover: '',
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()))
}

function inferFront(raw: string) {
  const explicit = raw.match(/\b(?:BRIEF|frente|front)\s+`?([A-Z]\d+|P\d+)`?/i)
  if (explicit) return explicit[1].toUpperCase()
  const loose = raw.match(/\b(C\d+|P\d+)\b/i)
  return loose ? loose[1].toUpperCase() : 'No detectado'
}

function inferSource(raw: string, selected: Source) {
  if (selected !== 'auto') return sourceLabels[selected]
  if (includesAny(raw, ['advisor de producto', 'producto'])) return 'Producto'
  if (includesAny(raw, ['cto', 'arquitectura'])) return 'CTO'
  if (includesAny(raw, ['gtm', 'mercado', 'demo'])) return 'GTM'
  if (includesAny(raw, ['bloqueo:', 'no se ha modificado', 'working tree', 'tests'])) return 'Builder'
  return 'No detectado'
}

function analyzeRelay(input: string, selected: Source): SyncResult {
  const trimmed = input.trim()
  if (!trimmed) return emptyResult

  const raw = trimmed.toLowerCase()
  const source = inferSource(raw, selected)
  const front = inferFront(trimmed)
  const executable = includesAny(raw, ['ejecutable', 'se puede lanzar', 'listo para builder'])
  const blocked = includesAny(raw, ['bloqueo:', 'bloqueado', 'para y dilo', 'no puedo', 'no se ha modificado'])
  const reviewedByCto = includesAny(raw, ['revisor: cto', 'cto adjudicado'])
  const noDeploy = includesAny(raw, ['no se despliega', 'no despliegues', 'railway up'])
  const readOnly = includesAny(raw, ['read only', 'diagnóstico', 'preflight'])
  const write = executable || includesAny(raw, ['write', 'ejecuta'])

  const status: SyncStatus = blocked && !executable ? 'bloqueado' : executable ? 'ejecutable' : reviewedByCto ? 'revision' : 'no-concluyente'
  const phase = readOnly && !write ? 'READ ONLY' : write ? 'WRITE con gates' : 'SINCRONIZACIÓN'
  const destination = executable ? 'Builder' : status === 'bloqueado' ? 'Checkpoint / quien desbloquea' : 'Revisión'
  const statusLabel = {
    ejecutable: 'Ejecutable, con límites',
    bloqueado: 'Bloqueado',
    revision: 'Revisión incorporada',
    'no-concluyente': 'No concluyente',
  }[status]

  const facts = [
    source !== 'No detectado' ? `Origen probable: ${source}.` : 'Origen no detectado con seguridad.',
    front !== 'No detectado' ? `Frente detectado: ${front}.` : 'No se detecta frente cerrado.',
    reviewedByCto ? 'Aparece revisión/adjudicación de CTO.' : 'No aparece revisión de CTO de forma clara.',
    executable ? 'La salida se presenta como ejecutable.' : 'No se presenta como ejecutable.',
    noDeploy ? 'Despliegue explícitamente bloqueado.' : 'No se detecta bloqueo explícito de despliegue.',
  ]

  const stops = [
    ...(includesAny(raw, ['para y dilo', 'stop']) ? ['Si aparece algo fuera del brief: STOP y reportar.'] : []),
    ...(noDeploy ? ['No desplegar: falta control de turno/árbol limpio.'] : []),
    ...(includesAny(raw, ['un encargo vivo a la vez']) ? ['Un encargo vivo a la vez hasta cerrar despliegue/reporte.'] : []),
    ...(includesAny(raw, ['captura', 'admisión', 'carril'])
      ? ['Si el trabajo exige tocar captura/admisión/carril externo fuera de alcance: STOP.']
      : []),
    ...(status === 'bloqueado' ? ['No reinterpretar el bloqueo como autorización de WRITE.'] : []),
  ]

  const contracts = [
    ...(includesAny(raw, ['ninguna cifra', 'recomputar']) ? ['Las cifras/nombres citados no son dato de entrada: se recomputan.'] : []),
    ...(includesAny(raw, ['no añade detectores', 'ningún detector']) ? ['No añadir detectores.'] : []),
    ...(includesAny(raw, ['foco ordena']) ? ['El foco ordena; no recorta ni jerarquiza.'] : []),
    ...(includesAny(raw, ['formulario se nombra', 'texto de botón']) ? ['Los formularios no se nombran por texto de botón.'] : []),
    ...(noDeploy ? ['El encargo no autoriza despliegue.'] : []),
  ]

  const memoryCandidates = [
    ...(includesAny(raw, ['un encargo vivo a la vez']) ? ['Un encargo vivo a la vez hasta el 24.'] : []),
    ...(includesAny(raw, ['foco ordena']) ? ['El foco cambia el orden, no el contenido ni la jerarquía.'] : []),
    ...(includesAny(raw, ['texto de botón']) ? ['Formulario: usar ubicación/fuente identificadora, no botón de submit.'] : []),
    ...(includesAny(raw, ['no se despliega', 'railway up']) ? ['Antes de desplegar: verificar árbol limpio y turno de despliegue.'] : []),
  ]

  const notMemory = [
    'Justificaciones retóricas del brief.',
    'Comparaciones contra generalistas que no se conviertan en regla.',
    'Diagnóstico histórico que no cambia el contrato operativo.',
  ]

  const now =
    status === 'ejecutable'
      ? `Pegar ${front} al builder con portada de control. Mantener gates y no desplegar si el brief lo bloquea.`
      : status === 'bloqueado'
        ? 'No relanzar como WRITE. Resolver el bloqueo o llevarlo a checkpoint.'
        : 'Pedir revisión acotada antes de construir.'

  const cover = `PORTADA PARA BUILDER · ${front}

Estado sincronizado por Relé:
- Origen: ${source}
- Fase: ${phase}
- Estado: ${statusLabel}
- Destino: ${destination}

Instrucción:
- Ejecuta solo lo que esté dentro del brief.
- Recalcula preflight; no tomes cifras del brief como dato de entrada.
- No abras frentes nuevos.
${noDeploy ? '- No despliegues: el relevo bloquea despliegue hasta verificar árbol/turno.\n' : ''}- Si aparece algo fuera del brief: PARA y dilo.

Entrega mínima:
- Veredicto cerrado.
- Evidencia observada.
- Tests/gates ejecutados.
- MODO_DE_FALLO_NO_PREVISTO.`

  return {
    source,
    front,
    destination,
    phase,
    status,
    statusLabel,
    now,
    facts,
    stops: stops.length ? stops : ['No se detectan STOPs explícitos. Revisar manualmente antes de ejecutar.'],
    contracts: contracts.length ? contracts : ['No se detectan contratos operativos explícitos.'],
    memoryCandidates: memoryCandidates.length ? memoryCandidates : ['Sin memoria candidata clara.'],
    notMemory,
    cover,
  }
}

function Pill({ children }: { children: string }) {
  return <span className="pill">{children}</span>
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="block">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function App() {
  const [source, setSource] = useState<Source>('auto')
  const [relay, setRelay] = useState('')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [copied, setCopied] = useState('')

  const canSync = relay.trim().length > 0
  const previewResult = useMemo(() => (result ? result : null), [result])

  const sync = () => {
    setCopied('')
    setResult(analyzeRelay(relay, source))
  }

  const copyCover = async () => {
    if (!previewResult?.cover) return
    try {
      await navigator.clipboard.writeText(previewResult.cover)
    } catch {
      // La maqueta conserva feedback aunque el navegador bloquee el portapapeles.
    }
    setCopied('Portada copiada. No se ha enviado nada a ningún modelo.')
  }

  return (
    <main className="shell">
      <header className="brand">
        <p className="brand-mark">Relé</p>
        <p className="brand-note">Maqueta · F0.2</p>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Sincronizar relevo</p>
        <h1 id="hero-title">Pega la última salida. Relé te dice dónde estás.</h1>
        <p className="intro">
          La entrada natural no es elegir un dashboard: es capturar lo último que dijo el builder,
          producto, CTO o GTM y convertirlo en estado operativo.
        </p>
      </section>

      <section className="input-card" aria-labelledby="input-title">
        <div className="input-heading">
          <div>
            <p className="eyebrow">Entrada</p>
            <h2 id="input-title">Último relevo recibido</h2>
          </div>
          <button className="text-button" type="button" onClick={() => setRelay(sampleRelay)}>
            Usar ejemplo sintético C13
          </button>
        </div>

        <div className="source-picker" aria-label="Origen declarado">
          {(Object.keys(sourceLabels) as Source[]).map((option) => (
            <button
              aria-pressed={source === option}
              className={source === option ? 'choice choice-selected' : 'choice'}
              key={option}
              onClick={() => setSource(option)}
              type="button"
            >
              {sourceLabels[option]}
            </button>
          ))}
        </div>

        <label htmlFor="relay">Pega aquí el brief, bloqueo o revisión</label>
        <textarea
          id="relay"
          onChange={(event) => setRelay(event.target.value)}
          placeholder="Ej.: BRIEF C13 rev.4 ejecutable... STOP... no se despliega..."
          rows={11}
          value={relay}
        />

        <div className="actions">
          <button className="button button-primary" disabled={!canSync} onClick={sync} type="button">
            Sincronizar
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              setRelay('')
              setResult(null)
              setCopied('')
            }}
            type="button"
          >
            Limpiar
          </button>
        </div>
      </section>

      {previewResult && (
        <section className="result" aria-labelledby="sync-title">
          <div className="result-header">
            <div>
              <p className="eyebrow">Sincronización detectada</p>
              <h2 id="sync-title">{previewResult.statusLabel}</h2>
            </div>
            <div className="pill-row" aria-label="Resumen detectado">
              <Pill>{previewResult.front}</Pill>
              <Pill>{previewResult.phase}</Pill>
              <Pill>{previewResult.destination}</Pill>
            </div>
          </div>

          <section className="next-card">
            <h3>Qué toca ahora</h3>
            <p>{previewResult.now}</p>
          </section>

          <div className="grid">
            <ListBlock title="Hechos extraídos" items={previewResult.facts} />
            <ListBlock title="STOPs / bloqueos" items={previewResult.stops} />
            <ListBlock title="Contratos del relevo" items={previewResult.contracts} />
            <ListBlock title="Memoria candidata" items={previewResult.memoryCandidates} />
            <ListBlock title="No guardar como decisión" items={previewResult.notMemory} />
          </div>

          <section className="cover-card" aria-labelledby="cover-title">
            <div className="input-heading">
              <div>
                <p className="eyebrow">Salida</p>
                <h3 id="cover-title">Portada para pegar antes del brief</h3>
              </div>
              <button className="button button-secondary" onClick={copyCover} type="button">
                Copiar portada
              </button>
            </div>
            <pre>{previewResult.cover}</pre>
            <p className="feedback" role="status" aria-live="polite">
              {copied || 'No se ha enviado nada a ningún modelo.'}
            </p>
          </section>
        </section>
      )}
    </main>
  )
}
