import { useState } from 'react'

type Source = 'auto' | 'builder' | 'producto' | 'cto' | 'gtm' | 'founder'
type WaypointStatus = 'en-ruta' | 'stop' | 'bloqueado' | 'revision' | 'desvio' | 'no-concluyente'

type ProjectPack = {
  project: string
  destination: string
  currentWaypoint: string
  lastStatus: string
  method: string[]
  liveContracts: string[]
  globalStops: string[]
}

type WaypointResult = {
  source: string
  front: string
  phase: string
  status: WaypointStatus
  statusLabel: string
  waypoint: string
  contextHealth: string
  nextSeat: string
  whatChanged: string[]
  contradictions: string[]
  confirms: string[]
  blocks: string[]
  distance: string[]
  rabbitHoles: string[]
  memoryCandidates: string[]
  notMemory: string[]
  handoff: string
}

const sourceLabels: Record<Source, string> = {
  auto: 'No sé',
  builder: 'Builder',
  producto: 'Producto',
  cto: 'CTO',
  gtm: 'GTM',
  founder: 'Founder',
}

const uxmPack: ProjectPack = {
  project: 'UXM v3',
  destination: 'Beta externa con informe usable, sin perder control operativo antes del hito.',
  currentWaypoint:
    'Cerrar un frente ejecutable cada vez, con READ ONLY antes de WRITE y sin despliegue si el gate no está explícito.',
  lastStatus:
    'Contexto mínimo cargado: hito beta, frente vivo C13, regla READ ONLY → WRITE, no deploy sin gate y no abrir frentes nuevos por ansiedad.',
  method: [
    'READ ONLY diagnostica; WRITE ejecuta solo lo autorizado.',
    'Un relevo no crea decisión canónica por sí solo.',
    'Builder implementa; CTO valida límites; producto encuadra; Founder resuelve trade-offs críticos.',
  ],
  liveContracts: [
    'No mezclar refactor técnico con cambio de política.',
    'No convertir bloqueo del builder en permiso para improvisar.',
    'No abrir frente nuevo si el frente vivo todavía no tiene veredicto.',
  ],
  globalStops: [
    'STOP si aparece motor/captura/admisión/carril externo fuera de alcance.',
    'STOP si el relevo pide desplegar sin gate de despliegue.',
    'STOP si una revisión intenta convertirse en contrato sin aceptación explícita.',
  ],
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
- Un encargo vivo a la vez hasta el hito.

Entrega:
- Veredicto.
- Evidencia.
- Tests.
- MODO_DE_FALLO_NO_PREVISTO.`

const sampleBuilderBlock = `Bloqueo: no puedo confirmar que el directorio abierto sea el repositorio esperado.
No se ha creado rama, commit ni push.
No se ha modificado ningún archivo.
Me detengo para no escribir en el sitio incorrecto.`

const sampleContradictionRelay = `ASIENTO REVISOR · READ ONLY · no convierto nada en decisión.

Qué confirma:
- El gate antes que el arreglo.
- n ∈ {0,1,2}, con el 0 justificado por producción.
- Comprometer ≠ publicar.
- El paso 4 pregunta qué NO cubre el gate y prohíbe arreglarlo.

Qué contradice:
1 · El paso 2 reimpone una doctrina retirada:
"Con {n} en la plantilla no queda ninguna."
Pero C13 rev.4 decía que la doctrina general —el número nunca vive en la plantilla— se cae.
El gate prueba el FIN, no el MEDIO.

2 · "Reporta y PARA" y "B sin esperarme" son órdenes incompatibles.

3 · La parada B lleva un criterio de aceptación que no está en el brief.

4 · Dos fuentes de verdad para A: el brief titula "son VEINTISÉIS"; la instrucción dice que la lista buena es la que salga del gate.

Bloqueo real:
- Si el builder ejecuta literalmente el paso 2, reescribe 26+ plantillas.
- /beta es una superficie nueva y nadie ha dicho que herede garantías.

Qué debería llegar al builder:
1. El requisito es que el gate pase con 0, 1 y 2. No que no quede ningún {n}.
2. Elegir entre PARA y seguir con B.
3. El control extra de B entra por revisión del brief o no entra.`

const emptyResult: WaypointResult = {
  source: 'No detectado',
  front: 'No detectado',
  phase: 'SINCRONIZACIÓN',
  status: 'no-concluyente',
  statusLabel: 'No concluyente',
  waypoint: 'No hay suficiente señal para ubicar el proyecto.',
  contextHealth: 'Sin mapa operativo cargado no hay criterio suficiente.',
  nextSeat: 'Founder',
  whatChanged: [],
  contradictions: [],
  confirms: [],
  blocks: [],
  distance: [],
  rabbitHoles: [],
  memoryCandidates: [],
  notMemory: [],
  handoff: '',
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()))
}

function inferFront(text: string) {
  const explicit = text.match(/\b(?:BRIEF|frente|front)\s+`?([A-Z]\d+|P\d+)`?/i)
  if (explicit) return explicit[1].toUpperCase()
  const loose = text.match(/\b(C\d+|P\d+)\b/i)
  return loose ? loose[1].toUpperCase() : 'No detectado'
}

function inferSource(raw: string, selected: Source) {
  if (selected !== 'auto') return sourceLabels[selected]
  if (includesAny(raw, ['advisor de producto', 'producto'])) return 'Producto'
  if (includesAny(raw, ['cto', 'arquitectura', 'adjudica', 'revisor: cto'])) return 'CTO'
  if (includesAny(raw, ['gtm', 'mercado', 'demo', 'go-to-market'])) return 'GTM'
  if (includesAny(raw, ['bloqueo:', 'no se ha modificado', 'no se ha creado rama', 'tests', 'commit'])) return 'Builder'
  return 'No detectado'
}

function unique(items: string[]) {
  return Array.from(new Set(items))
}

function buildHandoff(result: Omit<WaypointResult, 'handoff'>, raw: string) {
  if (result.status === 'stop') {
    return `PARA PRODUCTO / FOUNDER — CHECKPOINT BREVE

Relé detecta que este relevo NO debe llegar todavía al builder.

No es una decisión nueva.
No es un bloqueo técnico del builder.
Es una contradicción de instrucción antes de WRITE.

Contradicciones detectadas:
${result.contradictions.map((item) => `- ${item}`).join('\n')}

Corrección mínima:
1. Alinear el requisito con el contrato real: validar la salida/gate, no prescribir el medio interno.
2. Elegir una sola orden operativa: parar o seguir con la siguiente parada.
3. Meter cualquier control nuevo por revisión del brief, no como instrucción lateral.

Fuera del builder:
${result.blocks.map((item) => `- ${item}`).join('\n')}

Cuando estos puntos estén corregidos, el brief puede volver a evaluarse como candidato a WRITE.`
  }

  if (result.status === 'bloqueado') {
    return `PARA CTO / FOUNDER — READ ONLY

Relé detecta bloqueo operativo, no autorización de WRITE.

Estado:
- Frente: ${result.front}
- Origen: ${result.source}
- Fase: ${result.phase}

Bloqueo observado:
${result.blocks.map((item) => `- ${item}`).join('\n')}

Pregunta:
- ¿Es bloqueo de entorno, contradicción del brief o falta de gate?
- ¿El encargo sigue siendo ejecutable?
- ¿Qué instrucción mínima debe recibir el builder?

No propongas implementación todavía.
Devuelve causa probable, decisión pendiente si existe y siguiente pase mínimo.`
  }

  if (result.status === 'desvio') {
    return `PARA PRODUCTO / FOUNDER — CHECKPOINT

Relé detecta posible madriguera o cambio de scope.

No enviar al builder como WRITE.

Tensión detectada:
${result.rabbitHoles.map((item) => `- ${item}`).join('\n')}

Decidir:
- mantener el waypoint actual;
- aparcar el desvío;
- o sustituir explícitamente el plan activo.

Salida esperada:
- veredicto cerrado;
- si cambia el plan, nuevo waypoint;
- si no cambia, siguiente pase al asiento correcto.`
  }

  if (result.status === 'revision') {
    return `PARA ASIENTO REVISOR — READ ONLY

Revisa este relevo contra el mapa UXM.

No lo conviertas en decisión.
Declara:
- qué confirma;
- qué contradice;
- qué bloqueo real abre;
- qué debería llegar al builder, si algo.

Relevo base:
${raw.slice(0, 900)}${raw.length > 900 ? '\n[...]' : ''}`
  }

  return `PORTADA PARA BUILDER · ${result.front}

MODO: ${result.phase}

Waypoint sincronizado por Relé:
- Proyecto: ${uxmPack.project}
- Destino: ${uxmPack.destination}
- Origen del relevo: ${result.source}
- Estado: ${result.statusLabel}

Ejecuta solo el brief adjunto.

Antes de tocar código:
- Recalcula preflight; no tomes cifras del brief como verdad.
- Confirma que el trabajo sigue dentro del frente ${result.front}.
- Si aparece una condición STOP, paras y reportas.

No autorizado:
- No abrir frentes nuevos.
- No desplegar salvo gate explícito.
- No tocar captura/admisión/carril externo salvo autorización literal.
- No convertir diagnóstico histórico en nuevo alcance.

Entrega:
- Veredicto.
- Archivos tocados.
- Evidencia observada.
- Tests/gates ejecutados.
- MODO_DE_FALLO_NO_PREVISTO.`
}

function analyzeRelay(input: string, selected: Source, hasProjectContext: boolean): WaypointResult {
  const trimmed = input.trim()
  if (!trimmed) return emptyResult

  if (!hasProjectContext) {
    const baseResult: Omit<WaypointResult, 'handoff'> = {
      ...emptyResult,
      source: sourceLabels[selected],
      status: 'no-concluyente',
      statusLabel: 'Sin contexto operativo',
      contextHealth: 'Falta Project Pack / waypoint / último status. Relé no puede generar criterio fiable solo con el relevo.',
      waypoint: 'No sincronizable todavía: carga mapa/status del proyecto antes de analizar.',
      nextSeat: 'Founder',
      whatChanged: ['Hay input pegado, pero no hay mapa operativo contra el que compararlo.'],
      contradictions: [],
      confirms: ['No se debe fingir orientación cuando falta contexto.'],
      blocks: ['Falta contexto mínimo del proyecto: destino, frente vivo, contratos y STOPs.'],
      distance: ['Cargar o actualizar el Project Pack antes de decidir si el relevo avanza.'],
      rabbitHoles: ['Usar un LLM como memoria implícita y volver al mismo problema que Relé intenta resolver.'],
      memoryCandidates: ['Project Pack mínimo del proyecto.'],
      notMemory: ['El relevo pegado sin contexto no basta para crear decisión.'],
    }

    return {
      ...baseResult,
      handoff: `PARA FOUNDER — CARGAR CONTEXTO

Relé no puede ubicar este relevo con seguridad.

Falta mapa/status del proyecto:
- destino;
- frente vivo;
- contratos activos;
- STOPs globales;
- último waypoint.

No pidas recomendación ni mandes esto al builder hasta cargar ese contexto mínimo.`,
    }
  }

  const raw = trimmed.toLowerCase()
  const source = inferSource(raw, selected)
  const front = inferFront(trimmed)
  const executable = includesAny(raw, ['ejecutable', 'se puede lanzar', 'listo para builder', 'puede lanzar'])
  const hardBlock = includesAny(raw, ['bloqueo:', 'no puedo confirmar', 'me detengo', 'no se ha modificado', 'no se ha creado rama'])
  const review = includesAny(raw, ['revisor: cto', 'cto adjudicado', 'revisión', 'rev.'])
  const readOnly = includesAny(raw, ['read only', 'diagnóstico', 'preflight'])
  const noDeploy = includesAny(raw, ['no se despliega', 'no despliegues', 'sin desplegar', 'railway up'])
  const scopeRisk = includesAny(raw, ['captura', 'admisión', 'carril', 'motor de captura'])
  const newFrontRisk = includesAny(raw, ['abrir c14', 'c14', 'otro frente', 'nuevo frente'])
  const corporateRisk = includesAny(raw, ['comité', 'stakeholders', 'roadmap trimestral', 'matriz de riesgos'])
  const deployRisk = includesAny(raw, ['desplegar ahora', 'railway up', 'producción']) && !noDeploy
  const noNDoctrine =
    includesAny(raw, ['no queda ninguna', 'no quede ningún {n}', 'no quede ningun {n}', 'ningún {n}', 'ningun {n}']) ||
    (includesAny(raw, ['{n}']) && includesAny(raw, ['plantilla']) && includesAny(raw, ['no quede', 'no queda']))
  const gate012 =
    includesAny(raw, ['0, 1 y 2', '0,1,2', 'n=0', 'n ∈ {0,1,2}', 'n in {0,1,2}']) ||
    (includesAny(raw, ['0']) && includesAny(raw, ['1']) && includesAny(raw, ['2']) && includesAny(raw, ['gate']))
  const paraAndContinue =
    includesAny(raw, ['reporta y para', 'para y reporta', 'para y dilo']) &&
    includesAny(raw, ['sin esperarme', 'sigue con b', 'seguir con b', 'continúa con b', 'continua con b'])
  const lateralB = includesAny(raw, [
    'control que no está en el brief',
    'criterio de aceptación que no está en el brief',
    'requisito lateral',
    'instrucción lateral',
  ])
  const twoTruthsForScope =
    includesAny(raw, ['veintiséis', 'veintiseis', '26']) &&
    includesAny(raw, ['lista buena', 'salga del gate', 'la que salga'])
  const betaSurfaceRisk = includesAny(raw, ['/beta', 'landing']) && includesAny(raw, ['superficie nueva', 'garantías', 'garantias'])
  const instructionContradiction = noNDoctrine || paraAndContinue || lateralB || twoTruthsForScope
  const write = executable || includesAny(raw, ['write', 'ejecuta'])
  const phase = readOnly && !write ? 'READ ONLY' : write ? 'WRITE con gates' : 'SINCRONIZACIÓN'
  const status: WaypointStatus = hardBlock
    ? 'bloqueado'
    : instructionContradiction
      ? 'stop'
      : newFrontRisk || deployRisk || corporateRisk
      ? 'desvio'
      : executable
        ? 'en-ruta'
        : review
          ? 'revision'
          : 'no-concluyente'

  const statusLabel = {
    'en-ruta': 'En ruta',
    stop: 'STOP antes de builder',
    bloqueado: 'Bloqueado',
    revision: 'Revisión / no canónico',
    desvio: 'Desvío o madriguera',
    'no-concluyente': 'No concluyente',
  }[status]

  const nextSeat = {
    'en-ruta': 'Builder',
    stop: 'Producto / Founder',
    bloqueado: 'CTO / Founder',
    revision: 'Asiento revisor',
    desvio: 'Founder / Producto',
    'no-concluyente': 'Founder',
  }[status]

  const waypoint =
    status === 'en-ruta'
      ? `${front} · ${phase} · ejecutable con límites.`
      : status === 'stop'
        ? `${front} · STOP antes de builder. Hay contradicciones en la instrucción.`
      : status === 'bloqueado'
        ? `${front} · bloqueado antes de WRITE. No relanzar hasta resolver causa.`
        : status === 'desvio'
          ? `${front} · posible salida de ruta. Requiere checkpoint antes de construir.`
          : status === 'revision'
            ? `${front} · revisión útil, pero todavía no es decisión ni WRITE.`
            : `${front} · señal insuficiente. Falta contexto o gate.`

  const whatChanged = unique([
    `Origen probable: ${source}.`,
    front !== 'No detectado' ? `Frente detectado: ${front}.` : 'No se detecta frente cerrado.',
    executable ? 'El relevo se presenta como ejecutable.' : 'El relevo no se presenta como ejecutable.',
    review ? 'Aparece revisión/adjudicación previa.' : 'No aparece revisión clara.',
    noDeploy ? 'El despliegue queda bloqueado explícitamente.' : 'No hay bloqueo de despliegue suficientemente explícito.',
  ])

  const contradictions = unique([
    ...(noNDoctrine && gate012
      ? ['El relevo exige “que no quede ningún {n}”, pero también dice que el contrato real es pasar el gate con 0, 1 y 2.']
      : noNDoctrine
        ? ['El relevo prescribe cómo debe estar escrita la plantilla por dentro, no solo el resultado que debe pasar el gate.']
        : []),
    ...(paraAndContinue ? ['Hay dos órdenes incompatibles: “PARA” y continuar con B/sin esperar.'] : []),
    ...(lateralB ? ['B incorpora un control o criterio de aceptación que no entró por revisión formal del brief.'] : []),
    ...(twoTruthsForScope ? ['Hay dos fuentes de verdad para el alcance: número fijo de piezas vs lista que salga del gate.'] : []),
  ])

  const confirms = unique([
    ...(executable ? ['Puede avanzar como WRITE con gates si el preflight confirma el contexto.'] : []),
    ...(readOnly ? ['La pieza conserva la separación READ ONLY antes de WRITE.'] : []),
    ...(review ? ['Hay señal de revisión previa, pero sigue siendo relevo no canónico.'] : []),
    ...(noDeploy ? ['No hay permiso de despliegue en este relevo.'] : []),
    ...(includesAny(raw, ['no añade detectores', 'ningún detector']) ? ['No añadir detectores.'] : []),
    ...(includesAny(raw, ['foco ordena']) ? ['El foco ordena; no recorta ni jerarquiza.'] : []),
  ])

  const blocks = unique([
    ...(hardBlock ? ['El builder no pudo confirmar entorno/repo/estado seguro.'] : []),
    ...(contradictions.length ? ['El brief necesita corrección antes de llegar al builder.'] : []),
    ...(noDeploy ? ['No desplegar hasta verificar árbol limpio y turno/gate de despliegue.'] : []),
    ...(scopeRisk ? ['Si exige tocar captura/admisión/carril externo: STOP y checkpoint.'] : []),
    ...(betaSurfaceRisk ? ['/beta aparece como superficie nueva sin garantías asignadas; no es tarea implícita del builder.'] : []),
    ...(includesAny(raw, ['para y dilo', 'stop']) ? ['El propio relevo contiene STOP explícito.'] : []),
  ])

  const distance = unique([
    status === 'en-ruta'
      ? `Ejecutar ${front} sin ampliar alcance y recibir veredicto del builder.`
      : `Cerrar causa de estado ${statusLabel.toLowerCase()} antes de WRITE.`,
    'Validar evidencia/tests sin convertir diagnóstico en nuevo scope.',
    'Actualizar waypoint si el builder entrega veredicto o bloqueo nuevo.',
    'Promocionar a contrato solo lo que cambie una regla viva.',
  ])

  const rabbitHoles = unique([
    ...(newFrontRisk ? ['Abrir C14 u otro frente antes de cerrar el frente vivo.'] : []),
    ...(deployRisk ? ['Desplegar por inercia sin gate explícito.'] : []),
    ...(noNDoctrine ? ['Reescribir internals de plantillas en vez de validar la salida observable del gate.'] : []),
    ...(lateralB ? ['Colar requisitos nuevos por una instrucción lateral al builder.'] : []),
    ...(scopeRisk ? ['Investigar captura/admisión/carril externo si no bloquea el frente actual.'] : []),
    ...(corporateRisk ? ['Aplicar playbook corporativo pesado en vez de cierre startup.'] : []),
    'Reabrir decisiones antiguas porque no aparecen en el último relevo.',
    'Convertir una revisión CTO/producto en decisión aceptada sin checkpoint.',
  ])

  const memoryCandidates = unique([
    ...(includesAny(raw, ['un encargo vivo a la vez']) ? ['Un encargo vivo a la vez hasta el hito.'] : []),
    ...(includesAny(raw, ['foco ordena']) ? ['El foco cambia orden, no contenido ni jerarquía.'] : []),
    ...(noNDoctrine && gate012 ? ['Contrato C13: el gate debe pasar con 0, 1 y 2; no se prescribe el medio interno.'] : []),
    ...(includesAny(raw, ['texto de botón']) ? ['Formulario: usar ubicación/fuente identificadora, no botón de submit.'] : []),
    ...(noDeploy ? ['Antes de desplegar: verificar árbol limpio y gate de despliegue.'] : []),
    ...(scopeRisk ? ['Captura/admisión/carril externo requieren autorización separada.'] : []),
  ])

  const notMemory = [
    'Retórica o tono del brief.',
    'Diagnóstico histórico que no cambia el contrato operativo.',
    'Una recomendación de rol no aceptada como decisión.',
    'Detalles de implementación que Git ya conserva mejor que Relé.',
  ]

  const baseResult: Omit<WaypointResult, 'handoff'> = {
    source,
    front,
    phase,
    status,
    statusLabel,
    waypoint,
    contextHealth: 'Mapa UXM mínimo cargado. Relé compara el relevo contra destino, waypoint, contratos y STOPs.',
    nextSeat,
    whatChanged,
    contradictions,
    confirms: confirms.length ? confirms : ['No hay confirmaciones fuertes; tratar como contexto provisional.'],
    blocks: blocks.length ? blocks : ['No se detecta bloqueo explícito, pero revisar gates antes de ejecutar.'],
    distance,
    rabbitHoles,
    memoryCandidates: memoryCandidates.length ? memoryCandidates : ['Sin memoria candidata clara.'],
    notMemory,
  }

  return {
    ...baseResult,
    handoff: buildHandoff(baseResult, trimmed),
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
  const [contextLoaded, setContextLoaded] = useState(true)
  const [result, setResult] = useState<WaypointResult | null>(null)
  const [copied, setCopied] = useState('')

  const canSync = relay.trim().length > 0

  const sync = () => {
    setCopied('')
    setResult(analyzeRelay(relay, source, contextLoaded))
  }

  const copyHandoff = async () => {
    if (!result?.handoff) return
    try {
      await navigator.clipboard.writeText(result.handoff)
    } catch {
      // La maqueta conserva feedback aunque el navegador bloquee el portapapeles.
    }
    setCopied('Siguiente pase copiado. Relé no ha enviado nada a ningún asiento.')
  }

  return (
    <main className="shell">
      <header className="brand">
        <p className="brand-mark">Relé</p>
        <p className="brand-note">Maqueta · F0.4 UXM</p>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Inbox operativo</p>
        <h1 id="hero-title">Pega lo último. Relé debe avisar antes de que te pierdas.</h1>
        <p className="intro">
          Relé solo puede orientar si tiene dos entradas: mapa/status del proyecto y el último relevo pegado.
          Si falta contexto, no inventa. Si detecta contradicción, grita STOP antes de builder.
        </p>
      </section>

      <section className="map-card" aria-labelledby="map-title">
        <div>
          <p className="eyebrow">Mapa activo</p>
          <h2 id="map-title">{uxmPack.project}</h2>
          <p className="map-copy">{uxmPack.destination}</p>
        </div>
        <div className="map-grid">
          <ListBlock title="Status cargado" items={[uxmPack.lastStatus]} />
          <ListBlock title="Waypoint base" items={[uxmPack.currentWaypoint]} />
          <ListBlock title="Método" items={uxmPack.method} />
          <ListBlock title="Contratos vivos" items={uxmPack.liveContracts} />
          <ListBlock title="STOPs globales" items={uxmPack.globalStops} />
        </div>
      </section>

      <section className="input-card" aria-labelledby="input-title">
        <div className="input-heading">
          <div>
            <p className="eyebrow">Entrada</p>
            <h2 id="input-title">Pega lo último que tienes</h2>
          </div>
          <div className="sample-actions">
            <button className="text-button" type="button" onClick={() => setRelay(sampleRelay)}>
              Ejemplo brief UXM
            </button>
            <button className="text-button" type="button" onClick={() => setRelay(sampleBuilderBlock)}>
              Ejemplo bloqueo builder
            </button>
            <button className="text-button" type="button" onClick={() => setRelay(sampleContradictionRelay)}>
              Ejemplo contradicción
            </button>
          </div>
        </div>

        <div className="context-toggle" aria-label="Contexto operativo">
          <span>Contexto operativo:</span>
          <button
            aria-pressed={contextLoaded}
            className={contextLoaded ? 'choice choice-selected' : 'choice'}
            onClick={() => setContextLoaded(true)}
            type="button"
          >
            Cargado
          </button>
          <button
            aria-pressed={!contextLoaded}
            className={!contextLoaded ? 'choice choice-selected' : 'choice'}
            onClick={() => setContextLoaded(false)}
            type="button"
          >
            Sin contexto
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

        <label htmlFor="relay">Brief, salida del builder, revisión o bloqueo</label>
        <textarea
          id="relay"
          onChange={(event) => setRelay(event.target.value)}
          placeholder="Pega aquí la última pieza del proyecto. Relé intentará ubicarte contra el mapa UXM."
          rows={12}
          value={relay}
        />

        <div className="actions">
          <button className="button button-primary" disabled={!canSync} onClick={sync} type="button">
            Sincronizar waypoint
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              setRelay('')
              setResult(null)
              setCopied('')
              setSource('auto')
              setContextLoaded(true)
            }}
            type="button"
          >
            Limpiar
          </button>
        </div>
      </section>

      {result && (
        <section className="result" aria-labelledby="waypoint-title">
          <div className="result-header">
            <div>
              <p className="eyebrow">Waypoint UXM</p>
              <h2 id="waypoint-title">{result.waypoint}</h2>
            </div>
            <div className="pill-row" aria-label="Resumen detectado">
              <Pill>{result.statusLabel}</Pill>
              <Pill>{result.contextHealth}</Pill>
              <Pill>{result.front}</Pill>
              <Pill>{result.nextSeat}</Pill>
            </div>
          </div>

          <section className="next-card">
            <h3>Siguiente pase recomendado: {result.nextSeat}</h3>
            <p>
              {result.status === 'en-ruta'
                ? 'Pasar al builder con portada de control. Mantener gates, no abrir frentes y no desplegar sin permiso literal.'
                : result.status === 'stop'
                  ? 'No pegar al builder. Devolver al asiento que produjo el brief o llevar a checkpoint mínimo.'
                : result.status === 'bloqueado'
                  ? 'No relanzar como WRITE. Resolver bloqueo o llevarlo a CTO/Founder como READ ONLY.'
                  : result.status === 'desvio'
                    ? 'No construir todavía. Convertir en checkpoint y decidir si se aparca o cambia el plan.'
                    : 'Pedir revisión acotada antes de construir.'}
            </p>
          </section>

          <div className="grid">
            <ListBlock title="Qué cambió con este relevo" items={result.whatChanged} />
            {result.contradictions.length > 0 && <ListBlock title="Contradicciones detectadas" items={result.contradictions} />}
            <ListBlock title="Qué confirma" items={result.confirms} />
            <ListBlock title="Qué bloquea" items={result.blocks} />
            <ListBlock title="Distancia al destino" items={result.distance} />
            <ListBlock title="Madrigueras detectadas" items={result.rabbitHoles} />
            <ListBlock title="Memoria candidata" items={result.memoryCandidates} />
            <ListBlock title="No guardar como decisión" items={result.notMemory} />
          </div>

          <section className="cover-card" aria-labelledby="handoff-title">
            <div className="input-heading">
              <div>
                <p className="eyebrow">Salida</p>
                <h3 id="handoff-title">Texto listo para el siguiente asiento</h3>
              </div>
              <button className="button button-secondary" onClick={copyHandoff} type="button">
                Copiar siguiente pase
              </button>
            </div>
            <pre>{result.handoff}</pre>
            <p className="feedback" role="status" aria-live="polite">
              {copied || 'Relé no envía nada. Solo prepara texto para que tú lo pegues donde toque.'}
            </p>
          </section>
        </section>
      )}
    </main>
  )
}
