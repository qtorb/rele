import { useEffect, useMemo, useState } from 'react'
import { InboxPanel } from './components/InboxPanel'
import { MemoryPanel } from './components/MemoryPanel'
import { ProjectPackPanel } from './components/ProjectPackPanel'
import { ResultPanel } from './components/ResultPanel'
import { applyMemoryUpdate } from './lib/applyUpdate'
import { analyzeDemo } from './lib/demoEngine'
import { analyzeReal, fetchMode } from './lib/realEngine'
import { SAMPLES, type SampleKey } from './samples'
import { defaultPack } from './defaultPack'
import {
  deserializePack,
  loadPack,
  missingPackFields,
  savePack,
  serializePack,
} from './storage'
import type { Analysis, MemoryUpdate, ProjectPack, Source } from './types'

export function App() {
  const [pack, setPack] = useState<ProjectPack>(() => loadPack())
  const [inbox, setInbox] = useState('')
  const [source, setSource] = useState<Source>('auto')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [resolved, setResolved] = useState<Record<string, 'applied' | 'dismissed'>>({})
  const [mode, setMode] = useState<'real' | 'demo'>('demo')
  const [analyzing, setAnalyzing] = useState(false)
  const [packFeedback, setPackFeedback] = useState('')
  const [copied, setCopied] = useState('')

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

  /** Todo cambio del Pack sella la fecha y persiste en local. */
  const updatePack = (next: ProjectPack, feedback = '') => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    setPack(stamped)
    savePack(stamped)
    setPackFeedback(feedback)
  }

  const analyze = async () => {
    setCopied('')
    setResolved({})
    if (mode === 'demo') {
      setAnalysis(analyzeDemo(inbox, source, pack))
      return
    }
    setAnalyzing(true)
    try {
      const outcome = await analyzeReal(inbox, source, pack)
      setAnalysis(outcome.analysis)
    } finally {
      setAnalyzing(false)
    }
  }

  const exportPack = () => {
    const blob = new Blob([serializePack(pack)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'rele-project-pack.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setPackFeedback('Project Pack exportado.')
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
          visible más un handoff copiable. No envía nada y no cambia decisiones sin que las confirmes.
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
              setResolved({})
              setCopied('')
              setSource('auto')
            }}
            onSample={(key: SampleKey) => setInbox(SAMPLES[key])}
            onSourceChange={setSource}
            source={source}
            value={inbox}
          />

          {analysis && <ResultPanel analysis={analysis} copied={copied} onCopy={() => void copyHandoff()} />}

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
            feedback={packFeedback}
            missing={missing}
            onChange={(next) => updatePack(next)}
            onExport={exportPack}
            onImport={importPack}
            onReset={() => updatePack({ ...defaultPack }, 'Semilla UXM restaurada.')}
            pack={pack}
          />
        </div>
      </div>
    </main>
  )
}
