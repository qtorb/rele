import type { Signal, Source } from '../types'

export const SIGNALS: Signal[] = [
  'EN_RUTA',
  'GATE_PRIMERO',
  'STOP',
  'BLOQUEADO',
  'MADRIGUERA',
  'FALTA_MAPA',
  'READ_ONLY',
]

type SignalCopy = {
  /** Etiqueta grande de la señal. */
  label: string
  /** Titular: la orden operativa en una frase. */
  title: string
  /** Clase de color. */
  tone: 'go' | 'hold' | 'stop'
  /** Asiento por defecto cuando el análisis no propone otro. */
  seat: string
}

export const SIGNAL_COPY: Record<Signal, SignalCopy> = {
  EN_RUTA: {
    label: 'EN RUTA',
    title: 'Puede pasar al siguiente asiento.',
    tone: 'go',
    seat: 'Builder',
  },
  GATE_PRIMERO: {
    label: 'GATE PRIMERO',
    title: 'El gate va antes que el arreglo.',
    tone: 'hold',
    seat: 'Builder',
  },
  STOP: {
    label: 'STOP',
    title: 'No pegues esto al builder.',
    tone: 'stop',
    seat: 'Producto / Founder',
  },
  BLOQUEADO: {
    label: 'BLOQUEADO',
    title: 'No relances el WRITE.',
    tone: 'stop',
    seat: 'CTO / Founder',
  },
  MADRIGUERA: {
    label: 'MADRIGUERA',
    title: 'No abras otro frente todavía.',
    tone: 'hold',
    seat: 'Founder / Producto',
  },
  FALTA_MAPA: {
    label: 'FALTA MAPA',
    title: 'Relé no tiene criterio suficiente.',
    tone: 'hold',
    seat: 'Founder',
  },
  READ_ONLY: {
    label: 'READ ONLY / NO CANÓNICO',
    title: 'Útil, pero todavía no es decisión.',
    tone: 'hold',
    seat: 'Asiento revisor',
  },
}

export const SOURCE_LABELS: Record<Source, string> = {
  auto: 'Auto',
  builder: 'Builder',
  producto: 'Producto',
  cto: 'CTO',
  gtm: 'GTM',
  founder: 'Founder',
}

export function isSignal(value: unknown): value is Signal {
  return typeof value === 'string' && (SIGNALS as string[]).includes(value)
}
