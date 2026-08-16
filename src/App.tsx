import { useMemo, useState } from 'react'

type Mode = 'read' | 'write' | 'review' | 'checkpoint'
type View = 'home' | 'brief' | 'review' | 'checkpoint' | 'result'
type Verdict = 'pasa' | 'stop' | 'no-concluyente'

const modeCopy: Record<Mode, { label: string; eyebrow: string; title: string; body: string; action: string }> = {
  read: {
    label: 'READ ONLY',
    eyebrow: 'Diagnóstico',
    title: 'Diagnosticar sin tocar nada.',
    body: 'Úsalo cuando todavía no sabes si se puede escribir. En P9: comprobar una captura fresca antes de cualquier WRITE.',
    action: 'Preparar encargo READ ONLY',
  },
  write: {
    label: 'WRITE',
    eyebrow: 'Ejecución',
    title: 'Ejecutar solo si ya está autorizado.',
    body: 'En P9 todavía no hay WRITE: falta saber si tipo_contenido se escribe en una captura nueva.',
    action: 'Ver bloqueo de WRITE',
  },
  review: {
    label: 'REVISIÓN',
    eyebrow: 'Asiento',
    title: 'Pedir criterio sin convertirlo en decisión.',
    body: 'Úsalo cuando Producto, CTO o GTM deben revisar una tensión. La salida no es canónica hasta que se registre.',
    action: 'Preparar revisión',
  },
  checkpoint: {
    label: 'CHECKPOINT',
    eyebrow: 'Parada',
    title: 'Decidir si se sigue, se para o se cambia de frente.',
    body: 'Úsalo cuando la duda ya no es técnica: hay que cerrar una autorización, un bloqueo o una prioridad.',
    action: 'Preparar checkpoint',
  },
}

const readOnlyBrief = `ENCARGO · READ ONLY · P9

PREFLIGHT
- No trates ninguna cifra o estado citado como dato de entrada.
- Recomprueba el estado real antes de concluir.

ALCANCE
- Ejecutar una captura fresca.
- Comprobar si tipo_contenido se escribe en artefactos nuevos.
- Reportar evidencia mínima: fecha/corrida, muestra revisada y valor observado.

PROHIBIDO
- No modificar código.
- No tocar captura, admisión ni rama A.
- No convertir incertidumbre en autorización de WRITE.

GATES
- PASA: tipo_contenido aparece en la captura fresca con valor útil.
- STOP: tipo_contenido sigue vacío y P9 no puede funcionar dentro de su alcance.
- NO CONCLUYENTE: no hay captura fresca o la muestra no permite decidir.

ENTREGA
- Veredicto cerrado: PASA / STOP / NO_CONCLUYENTE.
- Evidencia observada.
- MODO_DE_FALLO_NO_PREVISTO.`

const writeBlockedBrief = `BLOQUEO · WRITE · P9

No hay WRITE autorizado.

Motivo:
- P9 depende de que tipo_contenido exista en artefactos nuevos.
- Si el campo sigue vacío, escribir P9 sería arreglar el sitio equivocado.

Siguiente movimiento:
- Volver a READ ONLY.
- Solo preparar WRITE si el gate de captura fresca devuelve PASA.`

const checkpointBrief = `CHECKPOINT · P9

Decisión a cerrar:
- ¿P9 sigue dentro de su alcance o se detiene porque el problema pertenece a captura/admisión?

Estados válidos:
- SEGUIR: hay evidencia fresca y el WRITE queda autorizado en alcance cerrado.
- PARAR: P9 no puede resolver el bloqueo sin tocar zona prohibida.
- CAMBIAR FRENTE: el bloqueo real vive en captura/admisión/rama A.

Salida:
- Veredicto.
- Motivo.
- Qué queda explícitamente NO autorizado.`

const verdictCopy: Record<Verdict, { label: string; title: string; body: string; next: string }> = {
  pasa: {
    label: 'PASA',
    title: 'Ahora sí puede nacer un WRITE, pero como otro encargo.',
    body: 'El READ ONLY ha demostrado que tipo_contenido aparece en una captura fresca.',
    next: 'Preparar un WRITE cerrado para P9.',
  },
  stop: {
    label: 'STOP',
    title: 'P9 no continúa.',
    body: 'Si tipo_contenido sigue vacío, el problema no está en P9: vive en captura/admisión.',
    next: 'Registrar bloqueo y no tocar P9.',
  },
  'no-concluyente': {
    label: 'NO CONCLUYENTE',
    title: 'No hay autorización para escribir.',
    body: 'La incertidumbre no se convierte en permiso. Falta una captura fresca válida o evidencia suficiente.',
    next: 'Repetir READ ONLY o parar en checkpoint.',
  },
}

function StageBadge({ children }: { children: string }) {
  return <span className="stage-badge">{children}</span>
}

function BackButton({ onClick, label = 'Volver' }: { onClick: () => void; label?: string }) {
  return (
    <button className="button button-secondary" type="button" onClick={onClick}>
      {label}
    </button>
  )
}

export function App() {
  const [mode, setMode] = useState<Mode>('read')
  const [view, setView] = useState<View>('home')
  const [role, setRole] = useState('Producto')
  const [question, setQuestion] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('stop')

  const activeMode = modeCopy[mode]

  const reviewBrief = useMemo(
    () => `REVISIÓN · ${role.toUpperCase()} · P9

Contexto efímero. No es una decisión.

Pregunta:
${question.trim() || '[escribe la duda antes de copiar]'}

Memoria operativa:
- P9 exige READ ONLY previo.
- No hay WRITE autorizado mientras tipo_contenido no esté comprobado en captura fresca.
- Captura, admisión y rama A están fuera del alcance de P9.

Salida requerida:
- Tensiones con decisiones activas.
- Recomendación no canónica.
- Veredicto sugerido: seguir / parar / pedir checkpoint.`,
    [question, role],
  )

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // La maqueta mantiene feedback aunque el navegador bloquee el portapapeles.
    }
    setCopied(label)
  }

  const startMode = () => {
    setCopied(null)
    if (mode === 'review') {
      setView('review')
      return
    }
    if (mode === 'checkpoint') {
      setView('checkpoint')
      return
    }
    setView('brief')
  }

  if (view === 'home') {
    return (
      <main className="shell">
        <header className="brand">
          <p className="brand-mark">Relé</p>
          <p className="brand-note">Maqueta · F0.1</p>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Sistema de encargo</p>
          <h1 id="hero-title">Primero el modo. Después el encargo.</h1>
          <p className="intro">
            Relé no es otro dashboard: convierte una duda de proyecto en un encargo con fase, límites,
            gates y salida cerrada.
          </p>
        </section>

        <section className="case-card" aria-labelledby="case-title">
          <div>
            <p className="eyebrow">Caso de prueba</p>
            <h2 id="case-title">P9 · tipo_contenido y captura fresca</h2>
            <p>
              La situación todavía no autoriza WRITE. Primero hay que saber si el campo se escribe en
              artefactos nuevos.
            </p>
          </div>
          <StageBadge>WRITE bloqueado</StageBadge>
        </section>

        <section className="mode-section" aria-labelledby="mode-title">
          <h2 id="mode-title">¿Qué necesitas preparar?</h2>
          <div className="mode-grid" role="list" aria-label="Modos de trabajo">
            {(Object.keys(modeCopy) as Mode[]).map((option) => (
              <button
                aria-pressed={mode === option}
                className={mode === option ? 'mode-card mode-card-selected' : 'mode-card'}
                key={option}
                onClick={() => setMode(option)}
                type="button"
              >
                <span>{modeCopy[option].label}</span>
                <small>{modeCopy[option].eyebrow}</small>
              </button>
            ))}
          </div>

          <article className="mode-detail" aria-live="polite">
            <StageBadge>{activeMode.label}</StageBadge>
            <h3>{activeMode.title}</h3>
            <p>{activeMode.body}</p>
            <button className="button button-primary" type="button" onClick={startMode}>
              {activeMode.action}
            </button>
          </article>
        </section>
      </main>
    )
  }

  if (view === 'brief') {
    const isRead = mode === 'read'
    const brief = isRead ? readOnlyBrief : writeBlockedBrief

    return (
      <main className="shell">
        <header className="compact-header">
          <button className="text-button" type="button" onClick={() => setView('home')}>
            Relé
          </button>
        </header>

        <section className="panel" aria-labelledby="brief-title">
          <StageBadge>{isRead ? 'READ ONLY' : 'WRITE bloqueado'}</StageBadge>
          <h1 id="brief-title">{isRead ? 'P9 necesita diagnóstico, no WRITE.' : 'Todavía no hay WRITE.'}</h1>
          <p className="lead">
            {isRead
              ? 'El encargo fuerza una comprobación observable antes de tocar código.'
              : 'Relé no prepara ejecución cuando falta el gate previo.'}
          </p>

          <div className="instruction-box">
            <pre>{brief}</pre>
          </div>

          {isRead && (
            <section className="verdict-strip" aria-label="Qué debe devolver el READ ONLY">
              <span>PASA</span>
              <span>STOP</span>
              <span>NO CONCLUYENTE</span>
            </section>
          )}

          <div className="actions">
            <button className="button button-primary" type="button" onClick={() => copyText(brief, 'encargo')}>
              {isRead ? 'Copiar encargo READ ONLY' : 'Copiar bloqueo'}
            </button>
            {isRead && (
              <button className="button button-secondary" type="button" onClick={() => setView('result')}>
                Incorporar veredicto
              </button>
            )}
            <BackButton label="Volver al modo" onClick={() => setView('home')} />
          </div>

          <p className="feedback" role="status" aria-live="polite">
            {copied ? `${copied} copiado. No se ha enviado nada a ningún modelo.` : 'No se ha enviado nada a ningún modelo.'}
          </p>
        </section>
      </main>
    )
  }

  if (view === 'review') {
    return (
      <main className="shell">
        <header className="compact-header">
          <button className="text-button" type="button" onClick={() => setView('home')}>
            Relé
          </button>
        </header>

        <section className="panel" aria-labelledby="review-title">
          <StageBadge>REVISIÓN</StageBadge>
          <h1 id="review-title">Pedir criterio sin mezclar autoridad.</h1>
          <p className="lead">La consulta viaja marcada como efímera: no es memoria, no es decisión y no autoriza WRITE.</p>

          <div className="role-picker" aria-label="Asiento de revisión">
            {['Producto', 'CTO', 'GTM'].map((option) => (
              <button
                aria-pressed={role === option}
                className={role === option ? 'choice choice-selected' : 'choice'}
                key={option}
                onClick={() => setRole(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>

          <label htmlFor="question">Duda concreta</label>
          <textarea
            id="question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ej.: ¿P9 debe parar si tipo_contenido sigue vacío en captura fresca?"
            rows={4}
            value={question}
          />

          <div className="instruction-box">
            <pre>{reviewBrief}</pre>
          </div>

          <div className="actions">
            <button
              className="button button-primary"
              disabled={!question.trim()}
              onClick={() => copyText(reviewBrief, 'consulta')}
              type="button"
            >
              Copiar consulta
            </button>
            <BackButton label="Volver al modo" onClick={() => setView('home')} />
          </div>

          <p className="feedback" role="status" aria-live="polite">
            {copied ? `${copied} copiada. Sigue siendo no canónica.` : 'No se ha enviado nada a ningún modelo.'}
          </p>
        </section>
      </main>
    )
  }

  if (view === 'checkpoint') {
    return (
      <main className="shell">
        <header className="compact-header">
          <button className="text-button" type="button" onClick={() => setView('home')}>
            Relé
          </button>
        </header>

        <section className="panel" aria-labelledby="checkpoint-title">
          <StageBadge>CHECKPOINT</StageBadge>
          <h1 id="checkpoint-title">Cerrar si P9 sigue, se para o cambia de frente.</h1>
          <p className="lead">Checkpoint no produce. Su función es evitar que una duda operativa se convierta en deriva.</p>

          <div className="instruction-box">
            <pre>{checkpointBrief}</pre>
          </div>

          <div className="actions">
            <button className="button button-primary" type="button" onClick={() => copyText(checkpointBrief, 'checkpoint')}>
              Copiar checkpoint
            </button>
            <BackButton label="Volver al modo" onClick={() => setView('home')} />
          </div>

          <p className="feedback" role="status" aria-live="polite">
            {copied ? `${copied} copiado.` : 'No se ha enviado nada a ningún modelo.'}
          </p>
        </section>
      </main>
    )
  }

  const currentVerdict = verdictCopy[verdict]

  return (
    <main className="shell">
      <header className="compact-header">
        <button className="text-button" type="button" onClick={() => setView('brief')}>
          READ ONLY
        </button>
      </header>

      <section className="panel" aria-labelledby="result-title">
        <StageBadge>Veredicto del READ</StageBadge>
        <h1 id="result-title">Incorporar salida sin perder el gate.</h1>
        <p className="lead">F0.1 simula qué pasa cuando el builder devuelve un veredicto cerrado.</p>

        <div className="result-picker" aria-label="Veredicto recibido">
          {(Object.keys(verdictCopy) as Verdict[]).map((option) => (
            <button
              aria-pressed={verdict === option}
              className={verdict === option ? 'choice choice-selected' : 'choice'}
              key={option}
              onClick={() => setVerdict(option)}
              type="button"
            >
              {verdictCopy[option].label}
            </button>
          ))}
        </div>

        <section className={verdict === 'stop' ? 'outcome outcome-stop' : 'outcome'} aria-live="polite">
          <p className="eyebrow">{currentVerdict.label}</p>
          <h2>{currentVerdict.title}</h2>
          <p>{currentVerdict.body}</p>
          <strong>{currentVerdict.next}</strong>
        </section>

        <div className="actions">
          <BackButton label="Volver al encargo" onClick={() => setView('brief')} />
          <BackButton label="Volver al inicio" onClick={() => setView('home')} />
        </div>
      </section>
    </main>
  )
}
