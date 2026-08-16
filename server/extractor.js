import Anthropic from '@anthropic-ai/sdk'

export const MODEL = process.env.RELE_MODEL || 'claude-opus-5'

const SIGNALS = [
  'EN_RUTA',
  'GATE_PRIMERO',
  'STOP',
  'BLOQUEADO',
  'MADRIGUERA',
  'FALTA_MAPA',
  'READ_ONLY',
]

const INPUT_TYPES = [
  'project_status',
  'brief',
  'builder_output',
  'review',
  'blocker',
  'decision_candidate',
  'unknown',
]

const PACK_FIELDS = [
  'project',
  'destination',
  'currentWaypoint',
  'nextSeat',
  'blockingGates',
  'liveRules',
  'liveRisks',
  'parked',
]

const stringList = { type: 'array', items: { type: 'string' } }

/** Contrato de salida. El extractor no puede devolver otra forma. */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'input_type',
    'signal',
    'project',
    'front',
    'next_seat',
    'can_advance',
    'can_start_write',
    'blocking_gates',
    'contradictions',
    'risks',
    'rules_detected',
    'memory_updates',
    'handoff',
    'explanation',
    'what_changes',
    'what_blocks',
    'next_action',
  ],
  properties: {
    input_type: { type: 'string', enum: INPUT_TYPES },
    signal: { type: 'string', enum: SIGNALS },
    project: { type: 'string' },
    front: stringList,
    next_seat: { type: 'string' },
    can_advance: { type: 'boolean' },
    can_start_write: { type: 'boolean' },
    blocking_gates: stringList,
    contradictions: stringList,
    risks: stringList,
    rules_detected: stringList,
    memory_updates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'action', 'value', 'reason'],
        properties: {
          field: { type: 'string', enum: PACK_FIELDS },
          action: { type: 'string', enum: ['add', 'replace', 'remove'] },
          value: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    handoff: { type: 'string' },
    explanation: { type: 'string' },
    what_changes: stringList,
    what_blocks: stringList,
    next_action: { type: 'string' },
  },
}

const SYSTEM = `Eres el extractor de Relé, un plugin de memoria operativa para trabajo AI-first.

Lee una pieza de trabajo y conviértela en JSON operativo.

Límites duros:
- No tomas decisiones de producto. No eliges alcance, no priorizas, no recomiendas estrategia.
- No inventas contexto. Si algo no está en la pieza ni en el Project Pack, no lo afirmas.
- Solo extraes estructura: tipo de pieza, estado, gates, riesgos, contradicciones,
  siguiente asiento, memoria candidata y handoff sugerido.
- Escribes en español, en el mismo registro operativo que el Project Pack.

Cómo elegir la señal:
- BLOQUEADO: quien ejecutaba se detuvo antes de escribir. No es permiso de WRITE.
- STOP: la pieza contiene instrucciones incompatibles entre sí. No debe llegar al builder.
- MADRIGUERA: la pieza empuja fuera del waypoint (frente nuevo, alcance nuevo, despliegue sin gate).
- GATE_PRIMERO: la pieza quiere avanzar pero hay gates bloqueantes vivos sin evidencia de que pasen.
- READ_ONLY: es una revisión o diagnóstico. Útil, pero no es decisión ni autorización.
- FALTA_MAPA: no hay contexto suficiente para decidir. Prefiere esta señal antes que adivinar.
- EN_RUTA: la pieza es ejecutable y no choca con gates ni con el waypoint.

Reglas de coherencia:
- can_start_write solo puede ser true si signal es EN_RUTA.
- can_advance solo puede ser true si signal es EN_RUTA.
- Si dudas entre dos señales, elige la más restrictiva.

memory_updates son propuestas, no cambios. Propón solo lo que la pieza declara de forma
explícita como norma, riesgo, gate o cambio de asiento. Nunca propongas reescribir el
destino salvo que la pieza lo declare literalmente como decisión cerrada.

handoff es el texto que la persona pegará en el siguiente asiento: autocontenido, sin
referencias a esta conversación, con qué cambia, qué bloquea y qué hacer ahora.`

let client = null

function getClient() {
  if (!client) client = new Anthropic()
  return client
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function renderPack(pack) {
  const list = (items) => (items?.length ? items.map((item) => `  - ${item}`).join('\n') : '  (vacío)')
  return [
    `Proyecto: ${pack.project || '(sin declarar)'}`,
    `Destino: ${pack.destination || '(sin declarar)'}`,
    `Waypoint actual: ${pack.currentWaypoint || '(sin declarar)'}`,
    `Siguiente asiento previsto: ${pack.nextSeat || '(sin declarar)'}`,
    'Gates bloqueantes:',
    list(pack.blockingGates),
    'Reglas vivas:',
    list(pack.liveRules),
    'Riesgos vivos:',
    list(pack.liveRisks),
    'Aparcado:',
    list(pack.parked),
  ].join('\n')
}

export async function extract({ input, source, pack }) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: `PROJECT PACK
${renderPack(pack)}

ORIGEN DECLARADO DE LA PIEZA: ${source && source !== 'auto' ? source : 'no declarado (infiérelo del contenido)'}

PIEZA A ANALIZAR
---
${input}
---

Devuelve el JSON operativo.`,
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category ?? 'sin categoría'
    throw new Error(`el modelo declinó la petición (${category})`)
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) throw new Error('respuesta sin contenido de texto')

  try {
    return JSON.parse(textBlock.text)
  } catch {
    throw new Error('la respuesta no era JSON válido')
  }
}
