import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const RUTA = 'C:\\Users\\albert\\proyectos\\uxm-v3'

const REPORTE = [
  'PARA',
  '',
  '1. «Rama nueva: `feat/x`.»',
  '   El repo dice: La rama feat/x ya existe.',
  '   Comprobado con: git branch -a --list feat/x',
  '',
  'Sostenidas (1):',
  '- ruta src/App.tsx existe en HEAD',
  '',
  '1 sostenidas · 0 no comprobables',
  '',
  'corridas: 4 · última contradicción: hace 2 corridas',
].join('\n')

/** Controles que §3 retira de la vista. Ninguno puede volver a aparecer. */
const CONTROLES_RETIRADOS = [
  'Pega aquí lo último',
  'Analizar',
  'MODO DEMO',
  'Modo demo',
  'Modo real',
  'Project Pack UXM',
  'Exportar Project Pack',
  'Importar Project Pack',
  'Restaurar semilla',
  'Exportar casos',
  'Esto está mal',
  'Quién tiene la pelota',
  'Handoff listo para copiar',
  'Copiar handoff',
  'Memoria propuesta',
  'Lo que Relé propone actualizar',
  'Qué cambia',
  'Qué bloquea',
  'Gates que deben pasar antes',
  'Riesgos vivos',
  'Reglas detectadas',
  'relays desde la última actualización',
  'Waypoint actual',
  'Gates bloqueantes',
  'Reglas vivas',
  'Aparcado',
]

/** Las siete señales del extractor. Ninguna sobrevive en la app. */
const SENALES_DEL_EXTRACTOR = [
  'EN RUTA',
  'GATE PRIMERO',
  'MADRIGUERA',
  'FALTA MAPA',
  'READ ONLY / NO CANÓNICO',
  'BLOQUEADO',
]

function mockFetch() {
  const espia = vi.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true, signal: 'PARA', report: REPORTE, notice: null, claims: [] }),
  }))
  vi.stubGlobal('fetch', espia)
  return espia
}

beforeEach(() => {
  window.localStorage.clear()
  mockFetch()
})

describe('Relé · tres zonas', () => {
  it('1 · monta tres zonas y un solo campo de ruta, y ningún control retirado', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Pega el texto en la zona del proceso en la que estás.',
    )

    // Las tres zonas, en orden.
    const zonas = screen.getAllByText(/^(Lectura|Escritura|Vuelta)$/)
    expect(zonas.map((z) => z.textContent)).toEqual(['Lectura', 'Escritura', 'Vuelta'])

    // Un solo campo de ruta, compartido.
    expect(screen.getAllByLabelText('Carpeta del proyecto')).toHaveLength(1)

    // Un Comprobar y un Limpiar por zona, y ninguno más.
    expect(screen.getAllByRole('button', { name: 'Comprobar' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Limpiar' })).toHaveLength(3)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Retomar',
      'Comprobar',
      'Limpiar',
      'Comprobar',
      'Limpiar',
      'Comprobar',
      'Limpiar',
    ])

    for (const control of CONTROLES_RETIRADOS) {
      expect(screen.queryByText(control)).toBeNull()
    }
  })

  it('2 · la salida trae los cuatro bloques del preflight y ninguna señal del extractor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Escritura'), 'Rama nueva: `feat/x`.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[1])

    const salida = await screen.findByText(/El repo dice/)

    // 1 señal · 2 contradicción con cita y comando · 3 sostenidas · 4 recuento y cuenta.
    expect(salida).toHaveTextContent('PARA')
    expect(salida).toHaveTextContent('«Rama nueva: `feat/x`.»')
    expect(salida).toHaveTextContent('Comprobado con: git branch -a --list feat/x')
    expect(salida).toHaveTextContent('Sostenidas (1):')
    expect(salida).toHaveTextContent('1 sostenidas · 0 no comprobables')
    expect(salida).toHaveTextContent('corridas: 4 · última contradicción: hace 2 corridas')

    for (const senal of SENALES_DEL_EXTRACTOR) {
      expect(screen.queryByText(senal)).toBeNull()
    }
  })

  it('3 · ninguna ruta, enlace ni atajo alcanza el pack o el inbox', () => {
    const { container } = render(<App />)

    expect(container.querySelectorAll('a')).toHaveLength(0)
    // Ningún campo del Project Pack ni del inbox queda montado.
    for (const id of [
      'inbox',
      'pack-project',
      'pack-destination',
      'pack-currentWaypoint',
      'pack-nextSeat',
      'pack-blockingGates',
      'pack-liveRules',
      'pack-liveRisks',
      'pack-parked',
    ]) {
      expect(container.querySelector(`#${id}`)).toBeNull()
    }
    // Cinco áreas de texto: la ruta, el encargo de Retomar y las tres zonas.
    expect([...container.querySelectorAll('textarea')].map((t) => t.id)).toEqual([
      'ruta-proyecto',
      'encargo',
      'texto-lectura',
      'texto-escritura',
      'texto-vuelta',
    ])
  })

  it('4 · las claves de localStorage de F1 quedan idénticas tras una corrida completa', async () => {
    const claves = {
      'rele.pack': JSON.stringify({ project: 'UXM v3', destination: 'beta' }),
      'rele.contador': '3',
      'rele.casos': JSON.stringify([{ id: 'uno' }]),
      'rele.ultimos5': JSON.stringify(['a', 'b']),
    }
    for (const [k, v] of Object.entries(claves)) window.localStorage.setItem(k, v)

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Repasa el estado del frente.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])
    await screen.findByText(/El repo dice/)

    for (const [k, v] of Object.entries(claves)) {
      expect(window.localStorage.getItem(k)).toBe(v)
    }
  })

  it('5 · la corrida manda la zona, para que el registro la reciba', async () => {
    const espia = mockFetch()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Vuelta'), 'El builder devuelve un bloqueo.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[2])

    await waitFor(() => expect(espia).toHaveBeenCalled())
    const [, init] = espia.mock.calls[0] as unknown as [string, { body: string }]
    const cuerpo = JSON.parse(init.body)
    expect(cuerpo.zone).toBe('vuelta')
    expect(cuerpo.projectPath).toBe(RUTA)
  })

  it('la salida aparece bajo la zona desde la que se lanzó, y solo esa', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Repasa el frente.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])
    await screen.findByText(/El repo dice/)

    expect(screen.getAllByText(/El repo dice/)).toHaveLength(1)
    const zonaLectura = screen.getByLabelText('Texto de Lectura').closest('section')
    expect(zonaLectura?.textContent).toContain('El repo dice')
  })

  it('la ruta se recuerda entre visitas y es la misma para las tres zonas', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    expect(window.localStorage.getItem('rele.preflight.ruta')).toBe(RUTA)

    unmount()
    render(<App />)
    expect(screen.getByLabelText('Carpeta del proyecto')).toHaveValue(RUTA)
  })

  it('W4 · 1 y 2 · Limpiar vacía el texto y retira la salida de su zona', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Rama nueva: `feat/x`.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])
    await screen.findByText(/El repo dice/)

    await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[0])

    expect(screen.getByLabelText('Texto de Lectura')).toHaveValue('')
    // Ni señal, ni contradicciones, ni sostenidas, ni recuento, ni línea de cuenta.
    expect(screen.queryByText(/El repo dice/)).toBeNull()
    expect(screen.queryByText(/Comprobado con/)).toBeNull()
    expect(screen.queryByText(/Sostenidas/)).toBeNull()
    expect(screen.queryByText(/no comprobables/)).toBeNull()
    expect(screen.queryByText(/corridas:/)).toBeNull()
  })

  it('W4 · 3 · limpiar una zona no toca las otras dos', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'texto de lectura')
    await user.type(screen.getByLabelText('Texto de Escritura'), 'texto de escritura')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[1])
    await screen.findByText(/El repo dice/)

    await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[0])

    expect(screen.getByLabelText('Texto de Lectura')).toHaveValue('')
    expect(screen.getByLabelText('Texto de Escritura')).toHaveValue('texto de escritura')
    // La salida de escritura sigue donde estaba.
    expect(screen.getByText(/El repo dice/)).toBeInTheDocument()
  })

  it('W4 · 4 y 5 · Limpiar conserva la ruta y el asiento', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.selectOptions(screen.getByLabelText('Asiento', { selector: '#asiento-vuelta' }), 'builder')
    await user.type(screen.getByLabelText('Texto de Vuelta'), 'algo que borrar')

    await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[2])

    expect(screen.getByLabelText('Carpeta del proyecto')).toHaveValue(RUTA)
    expect(screen.getByLabelText('Asiento', { selector: '#asiento-vuelta' })).toHaveValue('builder')
    expect(screen.getByLabelText('Texto de Vuelta')).toHaveValue('')
  })

  it('W4 · 6 · Limpiar no llama al backend, así que no escribe en el registro', async () => {
    const espia = mockFetch()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'algo')
    await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[0])

    expect(espia).not.toHaveBeenCalled()
  })

  it('W4 · 7 · limpiar una zona vacía y sin salida no rompe nada', async () => {
    const user = userEvent.setup()
    render(<App />)

    for (const i of [0, 1, 2]) {
      await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[i])
      await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[i])
    }

    expect(screen.getByLabelText('Texto de Lectura')).toHaveValue('')
    expect(screen.getAllByRole('button', { name: 'Comprobar' })).toHaveLength(3)
  })

  it('W4 · 8 · comprobar después de limpiar da la misma señal que en frío', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Rama nueva: `feat/x`.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])
    const enFrio = (await screen.findByText(/El repo dice/)).textContent

    await user.click(screen.getAllByRole('button', { name: 'Limpiar' })[0])
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Rama nueva: `feat/x`.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])

    expect((await screen.findByText(/El repo dice/)).textContent).toBe(enFrio)
  })
})

  it('5 · la corrida manda la zona y el asiento elegido', async () => {
    const espia = mockFetch()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.selectOptions(screen.getByLabelText('Asiento', { selector: '#asiento-escritura' }), 'CTO')
    await user.type(screen.getByLabelText('Texto de Escritura'), 'Rama nueva: `feat/x`.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[1])

    await waitFor(() => expect(espia).toHaveBeenCalled())
    const [, init] = espia.mock.calls[0] as unknown as [string, { body: string }]
    const cuerpo = JSON.parse(init.body)
    expect(cuerpo.zone).toBe('escritura')
    expect(cuerpo.seat).toBe('CTO')
  })

  it('6 · sin asiento elegido la corrida funciona igual y el campo va vacío', async () => {
    const espia = mockFetch()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Repasa el frente.')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])

    // Misma señal, sin haber tocado el selector.
    expect(await screen.findByText(/El repo dice/)).toBeInTheDocument()
    const [, init] = espia.mock.calls[0] as unknown as [string, { body: string }]
    expect(JSON.parse(init.body).seat).toBeNull()
  })

  it('7 · el asiento no sale en el reporte, y cambiarlo no altera la verificación', async () => {
    const espia = mockFetch()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Carpeta del proyecto'), RUTA)
    await user.type(screen.getByLabelText('Texto de Lectura'), 'Repasa el frente.')

    const selector = screen.getByLabelText('Asiento', { selector: '#asiento-lectura' })
    await user.selectOptions(selector, 'producto')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])
    const primero = (await screen.findByText(/El repo dice/)).textContent

    await user.selectOptions(selector, 'builder')
    await user.click(screen.getAllByRole('button', { name: 'Comprobar' })[0])
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2))
    const segundo = (await screen.findByText(/El repo dice/)).textContent

    // Mismo texto, distinto asiento: misma verificación palabra por palabra.
    expect(segundo).toBe(primero)

    // Y el asiento no aparece por ninguna parte del reporte.
    const reporte = screen.getByText(/El repo dice/).textContent ?? ''
    for (const asiento of ['producto', 'CTO', 'advisor GTM', 'founder', 'builder']) {
      expect(reporte).not.toContain(asiento)
    }
  })

  it('el asiento se recuerda por zona entre visitas', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.selectOptions(screen.getByLabelText('Asiento', { selector: '#asiento-lectura' }), 'founder')
    await user.selectOptions(screen.getByLabelText('Asiento', { selector: '#asiento-vuelta' }), 'builder')

    unmount()
    render(<App />)

    expect(screen.getByLabelText('Asiento', { selector: '#asiento-lectura' })).toHaveValue('founder')
    expect(screen.getByLabelText('Asiento', { selector: '#asiento-vuelta' })).toHaveValue('builder')
    // La zona que no se tocó sigue sin declarar.
    expect(screen.getByLabelText('Asiento', { selector: '#asiento-escritura' })).toHaveValue('')
  })
