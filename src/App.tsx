import { useState } from 'react'

type View = 'home' | 'front' | 'builder' | 'review' | 'review-ready' | 'result'
type ResultState = 'continue' | 'review' | 'stop'

const builderBrief = `FRONTE: P9\n\nPrimero: ejecuta una captura fresca.\n\nSi tipo_contenido sigue vacío, no escribas código de P9: informa del bloqueo.\n\nNo tocar captura, admisión ni rama A en este frente.`

const frontStates: Record<ResultState, { eyebrow: string; title: string; body: string; action: string }> = {
  continue: {
    eyebrow: 'Puedes continuar',
    title: 'La captura fresca confirma que tipo_contenido se escribe.',
    body: 'El precheck ha pasado. El siguiente encargo puede prepararse sin ampliar el alcance de P9.',
    action: 'Preparar encargo para Builder',
  },
  review: {
    eyebrow: 'Necesita contraste',
    title: 'El resultado todavía no permite continuar con seguridad.',
    body: 'Prepara una revisión acotada antes de decidir si P9 continúa o debe detenerse.',
    action: 'Preparar consulta de revisión',
  },
  stop: {
    eyebrow: 'P9 no puede continuar',
    title: 'La captura fresca sigue sin escribir tipo_contenido.',
    body: 'El arreglo pertenece a captura y queda fuera del alcance de P9.',
    action: 'Preparar bloqueo para Producto',
  },
}

function BackButton({ onClick, label = 'Volver a P9' }: { onClick: () => void; label?: string }) {
  return (
    <button className="button button-secondary" type="button" onClick={onClick}>
      {label}
    </button>
  )
}

export function App() {
  const [view, setView] = useState<View>('home')
  const [copied, setCopied] = useState(false)
  const [role, setRole] = useState('Producto')
  const [question, setQuestion] = useState('')
  const [resultState, setResultState] = useState<ResultState>('continue')
  const [resultVisible, setResultVisible] = useState<ResultState | null>(null)

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(builderBrief)
    } catch {
      // La maqueta conserva feedback explícito incluso si el navegador bloquea el portapapeles.
    }
    setCopied(true)
  }

  const openP9 = () => {
    setResultVisible(null)
    setView('front')
  }

  if (view === 'home') {
    return (
      <main className="shell">
        <header className="brand">
          <p className="brand-mark">Relé</p>
          <p className="brand-note">Maqueta local · F0</p>
        </header>
        <section className="home" aria-labelledby="project-title">
          <p className="eyebrow">Proyecto abierto</p>
          <h1 id="project-title">UXMachine</h1>
          <p className="intro">Elige el frente que quieres mover.</p>
          <div className="front-list" aria-label="Frentes activos de UXMachine">
            <button className="front-row front-row-primary" type="button" aria-label="Abrir P9" onClick={openP9}>
              <span>
                <strong>P9</strong>
                <small>espera captura fresca</small>
              </span>
              <span aria-hidden="true">Abrir</span>
            </button>
            <div className="front-row" aria-label="C13: espera tus objetivos">
              <span>
                <strong>C13</strong>
                <small>espera tus objetivos</small>
              </span>
            </div>
            <div className="front-row" aria-label="Beta externa: sin stopper nuevo">
              <span>
                <strong>Beta externa</strong>
                <small>sin stopper nuevo</small>
              </span>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (view === 'builder') {
    return (
      <main className="shell">
        <header className="compact-header"><button className="text-button" type="button" onClick={() => setView('front')}>P9</button></header>
        <section className="panel" aria-labelledby="builder-title">
          <p className="eyebrow">Encargo preparado para Builder</p>
          <h1 id="builder-title">Primero, una captura fresca.</h1>
          <p className="lead">Si <code>tipo_contenido</code> sigue vacío, no escribas código de P9: informa del bloqueo.</p>
          <div className="instruction-box"><pre>{builderBrief}</pre></div>
          <div className="actions">
            <button className="button button-primary" type="button" onClick={copyBrief}>Copiar encargo</button>
            <BackButton onClick={() => setView('front')} />
          </div>
          <p className="feedback" role="status" aria-live="polite">{copied ? 'Encargo copiado. Puedes pegarlo en tu Builder.' : 'No se ha enviado nada a ningún modelo.'}</p>
        </section>
      </main>
    )
  }

  if (view === 'review') {
    return (
      <main className="shell">
        <header className="compact-header"><button className="text-button" type="button" onClick={() => setView('front')}>P9</button></header>
        <section className="panel" aria-labelledby="review-title">
          <p className="eyebrow">Pedir revisión</p>
          <h1 id="review-title">¿Qué necesitas contrastar?</h1>
          <div className="role-picker" aria-label="Rol de revisión">
            {['Producto', 'CTO', 'GTM'].map((option) => (
              <button key={option} className={role === option ? 'choice choice-selected' : 'choice'} type="button" aria-pressed={role === option} onClick={() => setRole(option)}>{option}</button>
            ))}
          </div>
          <label htmlFor="question">Describe la duda en una frase.</label>
          <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ej.: ¿Qué debe detener P9 si la captura fresca sigue vacía?" rows={4} />
          <div className="actions">
            <button className="button button-primary" type="button" onClick={() => setView('review-ready')} disabled={!question.trim()}>Preparar consulta</button>
            <BackButton onClick={() => setView('front')} />
          </div>
        </section>
      </main>
    )
  }

  if (view === 'review-ready') {
    return (
      <main className="shell">
        <header className="compact-header"><button className="text-button" type="button" onClick={() => setView('review')}>Revisión</button></header>
        <section className="panel" aria-labelledby="review-ready-title">
          <p className="eyebrow">Consulta preparada para {role}</p>
          <h1 id="review-ready-title">P9 conserva su límite.</h1>
          <p className="lead">La consulta incluye la duda y el hecho de que captura queda fuera del alcance de P9.</p>
          <div className="instruction-box"><p><strong>Pregunta:</strong> {question}</p><p><strong>Contexto:</strong> P9 requiere una captura fresca antes de cualquier WRITE. Si el campo sigue vacío, hay que parar.</p></div>
          <div className="actions">
            <button className="button button-primary" type="button" onClick={() => setView('front')}>Entendido</button>
            <BackButton onClick={() => setView('front')} />
          </div>
        </section>
      </main>
    )
  }

  if (view === 'result') {
    const current = resultVisible ? frontStates[resultVisible] : null
    return (
      <main className="shell">
        <header className="compact-header"><button className="text-button" type="button" onClick={() => setView('front')}>P9</button></header>
        <section className="panel" aria-labelledby="result-title">
          <p className="eyebrow">Incorporar resultado</p>
          <h1 id="result-title">Prueba qué haría Relé.</h1>
          <p className="lead">F0 no guarda nada. Elige uno de los tres resultados simulados.</p>
          <div className="result-picker" aria-label="Estado simulado del resultado">
            {(['continue', 'review', 'stop'] as ResultState[]).map((option) => (
              <button key={option} className={resultState === option ? 'choice choice-selected' : 'choice'} type="button" aria-pressed={resultState === option} onClick={() => setResultState(option)}>{frontStates[option].eyebrow}</button>
            ))}
          </div>
          <div className="actions">
            <button className="button button-primary" type="button" onClick={() => setResultVisible(resultState)}>Ver orientación</button>
            <BackButton onClick={() => setView('front')} />
          </div>
          {current && (
            <section className={resultVisible === 'stop' ? 'outcome outcome-stop' : 'outcome'} aria-live="polite" aria-labelledby="outcome-title">
              <p className="eyebrow">{current.eyebrow}</p>
              <h2 id="outcome-title">{current.title}</h2>
              <p>{current.body}</p>
              <button className="button button-secondary" type="button">{current.action}</button>
            </section>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="compact-header"><button className="text-button" type="button" onClick={openP9}>P9</button></header>
      <section className="panel" aria-labelledby="front-title">
        <p className="eyebrow">P9 · rev.4</p>
        <h1 id="front-title">Ahora mismo</h1>
        <p className="next-step">Ejecutar una captura fresca antes de cualquier WRITE.</p>
        <div className="reason"><h2>Por qué importa</h2><p>P9 no funcionará si <code>tipo_contenido</code> sigue vacío en una captura nueva.</p></div>
        <div className="actions actions-front">
          <button className="button button-primary" type="button" onClick={() => setView('builder')}>Preparar para Builder</button>
          <button className="button button-secondary" type="button" onClick={() => setView('review')}>Pedir revisión</button>
          <button className="button button-secondary" type="button" onClick={() => setView('result')}>Incorporar resultado</button>
        </div>
      </section>
    </main>
  )
}
