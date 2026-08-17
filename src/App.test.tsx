import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { CASES_KEY, COUNTER_KEY, STORAGE_KEY } from './storage'

function pasteInbox(text: string) {
  fireEvent.change(screen.getByLabelText('Última salida del proyecto'), { target: { value: text } })
}

beforeEach(() => {
  window.localStorage.clear()
  // Sin backend local, Relé debe arrancar en modo demo.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ mode: 'demo' }) })),
  )
})

describe('Relé F1 · señales', () => {
  it('marca EN RUTA un brief ejecutable con los gates ya declarados como pasados', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'Puede pasar al siguiente asiento.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quién tiene la pelota: Builder' })).toBeInTheDocument()
    expect(screen.getByText('WRITE permitido')).toBeInTheDocument()
    expect(screen.getByText(/PARA BUILDER — EN RUTA/)).toBeInTheDocument()
  })

  it('exige GATE PRIMERO cuando la pieza quiere avanzar y hay gates vivos sin declarar superados', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Gate primero' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'El gate va antes que el arreglo.' })).toBeInTheDocument()
    expect(screen.getByText('WRITE no permitido')).toBeInTheDocument()
    expect(
      screen.getByText('Hay gates bloqueantes vivos en el Project Pack sin evidencia de que pasen.'),
    ).toBeInTheDocument()
  })

  it('trata el bloqueo del builder como BLOQUEADO y no como permiso de WRITE', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Bloqueo' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'No relances el WRITE.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quién tiene la pelota: CTO / Founder' })).toBeInTheDocument()
    expect(screen.getByText('El builder no pudo confirmar una condición segura de ejecución.')).toBeInTheDocument()
  })

  it('emite STOP cuando la pieza contiene instrucciones incompatibles', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'STOP' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'No pegues esto al builder.' })).toBeInTheDocument()
    expect(
      screen.getByText('Hay dos órdenes incompatibles: parar y, a la vez, continuar sin esperar.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Entra un criterio de aceptación que no pasó por revisión del brief.')).toBeInTheDocument()
  })

  it('devuelve FALTA MAPA en vez de fingir criterio si el Project Pack está incompleto', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByLabelText('Destino'))
    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'Relé no tiene criterio suficiente.' })).toBeInTheDocument()
    expect(screen.getByText('Faltan campos del Project Pack: destino.')).toBeInTheDocument()
  })
})

describe('Relé F1 · memoria', () => {
  it('no aplica una propuesta crítica sin una segunda confirmación explícita', async () => {
    const user = userEvent.setup()
    render(<App />)

    pasteInbox(
      [
        'BRIEF C15 · EJECUTABLE',
        'Árbol limpio verificado y tests en verde.',
        'No desplegar sin turno explícito de despliegue.',
        'Ejecuta solo el brief adjunto como WRITE.',
      ].join('\n'),
    )
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    const rule = 'No desplegar sin turno explícito de despliegue.'
    const liveRules = () => (screen.getByLabelText('Reglas vivas') as HTMLTextAreaElement).value

    expect(screen.getAllByText(rule).length).toBeGreaterThan(0)
    expect(screen.getByText('Decisión')).toBeInTheDocument()
    expect(liveRules()).not.toContain(rule)

    // Primer clic solo arma la confirmación: la regla todavía no entra en el Pack.
    await user.click(screen.getByRole('button', { name: 'Aplicar…' }))
    expect(screen.getByText(/Esto cambia una decisión viva del proyecto/)).toBeInTheDocument()
    expect(liveRules()).not.toContain(rule)

    await user.click(screen.getByRole('button', { name: 'Confirmar cambio de decisión' }))
    expect(liveRules()).toContain(rule)
  })

  it('persiste el Project Pack editado en localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByLabelText('Proyecto'))
    await user.type(screen.getByLabelText('Proyecto'), 'UXM v4')

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.project).toBe('UXM v4')
    expect(stored.updatedAt).toBeTruthy()
  })
})

describe('Relé F1 · puerta de evidencia en pantalla', () => {
  it('toda señal visible lleva su cita literal debajo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    const quote = screen.getByText(/«.+»/)
    expect(quote).toBeInTheDocument()
    // La cita tiene que estar literalmente en el texto pegado.
    const pasted = (screen.getByLabelText('Última salida del proyecto') as HTMLTextAreaElement).value
    expect(pasted).toContain(quote.textContent!.replace(/^«|»$/g, ''))
  })

  it('una cita inventada por el extractor se muestra como FALTA MAPA, nunca como señal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        if (String(url).includes('/api/health')) {
          return { ok: true, json: async () => ({ mode: 'real' }) }
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            analysis: {
              signal: 'EN_RUTA',
              input_type: 'brief',
              can_advance: true,
              can_start_write: true,
              evidencia: 'El CTO autorizó el despliegue en la reunión del martes.',
              explanation: 'Todo listo para lanzar.',
              next_action: 'Pásalo al builder.',
            },
          }),
        }
      }),
    )

    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Modo real')

    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(
      await screen.findByRole('heading', { name: 'Relé no tiene criterio suficiente.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Motivo: cita no verificable')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Puede pasar al siguiente asiento.' })).toBeNull()
    expect(screen.getByText('WRITE no permitido')).toBeInTheDocument()
  })

  it('con el mapa caducado toda señal cae a FALTA MAPA', async () => {
    window.localStorage.setItem(COUNTER_KEY, '5')
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/el mapa ha caducado/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'Relé no tiene criterio suficiente.' })).toBeInTheDocument()
    expect(screen.getByText('Motivo: el mapa lleva 5 relays sin actualizarse')).toBeInTheDocument()
  })

  it('editar el pack resetea el contador y devuelve la señal', async () => {
    window.localStorage.setItem(COUNTER_KEY, '5')
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Waypoint actual'), ' (revisado)')
    expect(screen.getByText(/relays desde la última actualización/)).toHaveTextContent('0')

    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(screen.getByRole('heading', { name: 'Puede pasar al siguiente asiento.' })).toBeInTheDocument()
  })

  it('registrar un desacuerdo guarda exactamente un caso con la respuesta cruda', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Avance' }))
    await user.click(screen.getByRole('button', { name: 'Analizar' }))
    await user.click(screen.getByRole('button', { name: 'Esto está mal' }))
    await user.click(screen.getByRole('button', { name: 'BLOQUEADO' }))

    const cases = JSON.parse(window.localStorage.getItem(CASES_KEY) ?? '[]')
    expect(cases).toHaveLength(1)
    expect(cases[0].shownSignal).toBe('EN_RUTA')
    expect(cases[0].correctSignal).toBe('BLOQUEADO')
    expect(cases[0].rawResponse).toContain('EN_RUTA')
    expect(screen.getByText('Desacuerdo guardado en el corpus local.')).toBeInTheDocument()
  })
})
