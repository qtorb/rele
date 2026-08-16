import { useEffect, useMemo, useState } from 'react'
import { InboxPanel } from './components/InboxPanel'
import { MemoryPanel } from './components/MemoryPanel'
import { ProjectPackPanel } from './components/ProjectPackPanel'
import { ResultPanel } from './components/ResultPanel'
import { applyMemoryUpdate } from './lib/applyUpdate'
import { analyzeDemo } from './lib/demoEngine'
import { gateAnalysis } from './lib/gate'
import { analyzeReal, fetchMode } from './lib/realEngine'
import { SAMPLES, type SampleKey } from './samples'
import { defaultPack } from './defaultPack'
import {
  addCase,
  bumpRelayCount,
  deserializePack,
  loadCases,
  loadPack,
  loadRelayCount,
  missingPackFields,
  savePack,
  serializeCases,
  serializePack,
} from './storage'
import type { Analysis, DisagreementCase, MemoryUpdate, ProjectPack, Signal, Source } from './types'

function download(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function App() {
  const [pack, setPack] = useState<ProjectPack>(() => loadPack())
  const [relayCount, setRelayCount] = useState<number>(() => loadRelayCount())
  const [cases, setCases] = useState<DisagreementCase[]>(() => loadCases())
  const [inbox, setInbox] = useState('')
  const [source, setSource] = useState<Source>('auto')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzedText, setAnalyzedText] = useState('')
  const [resolved, setResolved] = useState<Record<string, 'applied' | 'dismissed'>>({})
  const [mode, setMode] = useState<'real' | 'demo'>('demo')
  const [analyzing, setAnalyzing] = useState(false)
  const [packFeedback, setPackFeedback] = useState('')
  const [copied, setCopied] = useState('')
  const [disagreementFeedback, setDisagreementFeedback] = useState('')

  useEffect(() => {
    let active = true
    void fetchMode().then((detected) => {
      if (active) setMode(detected)
    })
    return () => {
      active = false
    }
  }, [])

  const missing = useMemo(() => missingPackFields(pack), [pack])

  /** Todo cambio del Pack sella la fecha, persiste y resetea el contador de caducidad. */
  const updatePack = (next: ProjectPack, feedback = '') => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    setPack(stamped)
    savePack(stamped)
    setRelayCount(0)
    setPackFeedback(feedback)
  }

  const analyze = async () => {
    setCopied('')
    setDisagreementFeedback('')
    setResolved({})

    const pastedText = inbox
    let raw: Analysis
    if (mode === 'demo') {
      raw = analyzeDemo(pastedText, source, pack)
    } else {
      setAnalyzing(true)
      try {
        raw = (await analyzeReal(pastedText, source, pack)).analysis
      } finally {
        setAnalyzing(false)
      }
    }

    // Las puertas corren con el contador ANTERIOR a este relay, y antes de pintar nada.
    setAnalysis(gateAnalysis(raw, pastedText, relayCount, pack))
    setAnalyzedText(pastedText)
    setRelayCount(bumpRelayCount())
  }

  const exportPack = () => {
    download(serializePack(pack), 'rele-project-pack.json')
    setPackFeedback('Project Pack exportado.')
  }

  const exportCases = () => {
    download(serializeCases(cases), 'rele-casos.json')
    setPackFeedback(`${cases.length} caso(s) exportado(s).`)
  }

  const importPack = (text: string) => {
    try {
      updatePack(deserializePack(text), 'Project Pack importado.')
    } catch {
      setPackFeedback('No se pudo leer ese archivo: no es un Project Pack válido.')
    }
  }

  const applyUpdate = (update: MemoryUpdate) => {
    updatePack(applyMemoryUpdate(pack, update), 'Memoria actualizada.')
    setResolved((current) => ({ ...current, [update.id]: 'applied' }))
  }

  const dismissUpdate = (id: string) => {
    setResolved((current) => ({ ...current, [id]: 'dismissed' }))
  }

  const registerDisagreement = (correctSignal: Signal) => {
    if (!analysis) return
    setCases(
      addCase({
        pastedText: analyzedText,
        rawResponse: analysis.rawResponse,
        shownSignal: analysis.signal,
        correctSignal,
      }),
    )
    setDisagreementFeedback('Desacuerdo guardado en el corpus local.')
  }

  const copyHandoff = async () => {
    if (!analysis?.handoff) return
    try {
      await navigator.clipboard.writeText(analysis.handoff)
      setCopied('Handoff copiado. Relé no lo ha enviado a ningún sitio.')
    } catch {
      setCopied('El navegador bloqueó el portapapeles. Selecciona el texto y cópialo a mano.')
    }
  }

  return (
    <main className="shell">
      <header className="brand">
        <p className="brand-mark">Relé</p>
        <p className="brand-note">F1 · app local UXM</p>
      </header>

      <section className="hero">
        <p className="eyebrow">Memoria operativa activa</p>
        <h1>Pega lo último y recupera el siguiente paso.</h1>
        <p className="intro">
          Relé guarda el Project Pack, lo compara con la última salida del proyecto y devuelve una señal
          con su cita literal. Sin prueba en el texto pegado no hay señal, y con el mapa caducado tampoco.
        </p>
      </section>

      <div className="layout">
        <div className="column column-left">
          <InboxPanel
            analyzing={analyzing}
            mode={mode}
            onAnalyze={() => void analyze()}
            onChange={setInbox}
            onClear={() => {
              setInbox('')
              setAnalysis(null)
              setAnalyzedText('')
              setResolved({})
              setCopied('')
              setDisagreementFeedback('')
              setSource('auto')
            }}
            onSample={(key: SampleKey) => setInbox(SAMPLES[key])}
            onSourceChange={setSource}
            source={source}
            value={inbox}
          />

          {analysis && (
            <ResultPanel
              analysis={analysis}
              copied={copied}
              disagreementFeedback={disagreementFeedback}
              onCopy={() => void copyHandoff()}
              onDisagree={registerDisagreement}
            />
          )}

          {analysis && (
            <MemoryPanel
              onApply={applyUpdate}
              onDismiss={dismissUpdate}
              resolved={resolved}
              updates={analysis.memory_updates}
            />
          )}
        </div>

        <div className="column column-right">
          <ProjectPackPanel
            caseCount={cases.length}
            feedback={packFeedback}
            missing={missing}
            onChange={(next) => updatePack(next)}
            onExport={exportPack}
            onExportCases={exportCases}
            onImport={importPack}
            onReset={() => updatePack({ ...defaultPack }, 'Semilla UXM restaurada.')}
            pack={pack}
            relayCount={relayCount}
          />
        </div>
      </div>
    </main>
  )
}
