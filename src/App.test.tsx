import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Relé F0.4 UXM inbox', () => {
  it('sincroniza un brief UXM ejecutable como waypoint y prepara pase al builder', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Pega lo último. Relé debe avisar antes de que te pierdas.' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ejemplo brief UXM' }))
    await user.click(screen.getByRole('button', { name: 'Sincronizar waypoint' }))

    expect(screen.getByRole('heading', { name: 'C13 · WRITE con gates · ejecutable con límites.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Siguiente pase recomendado: Builder' })).toBeInTheDocument()
    expect(screen.getByText('No desplegar hasta verificar árbol limpio y turno/gate de despliegue.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Distancia al destino' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Madrigueras detectadas' })).toBeInTheDocument()
    expect(screen.getByText(/PORTADA PARA BUILDER · C13/)).toBeInTheDocument()
  })

  it('declara que no puede orientar si falta el contexto operativo del proyecto', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Sin contexto' }))
    await user.click(screen.getByRole('button', { name: 'Ejemplo brief UXM' }))
    await user.click(screen.getByRole('button', { name: 'Sincronizar waypoint' }))

    expect(screen.getByRole('heading', { name: 'No sincronizable todavía: carga mapa/status del proyecto antes de analizar.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Siguiente pase recomendado: Founder' })).toBeInTheDocument()
    expect(screen.getByText('Falta contexto mínimo del proyecto: destino, frente vivo, contratos y STOPs.')).toBeInTheDocument()
    expect(screen.getByText(/PARA FOUNDER — CARGAR CONTEXTO/)).toBeInTheDocument()
  })

  it('detecta un bloqueo del builder como waypoint bloqueado, no como WRITE', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ejemplo bloqueo builder' }))
    await user.click(screen.getByRole('button', { name: 'Sincronizar waypoint' }))

    expect(screen.getByRole('heading', { name: 'No detectado · bloqueado antes de WRITE. No relanzar hasta resolver causa.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Siguiente pase recomendado: CTO / Founder' })).toBeInTheDocument()
    expect(screen.getByText('El builder no pudo confirmar entorno/repo/estado seguro.')).toBeInTheDocument()
    expect(screen.getByText(/PARA CTO \/ FOUNDER — READ ONLY/)).toBeInTheDocument()
  })

  it('emite STOP antes de builder cuando detecta contradicciones internas de instrucción', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ejemplo contradicción' }))
    await user.click(screen.getByRole('button', { name: 'Sincronizar waypoint' }))

    expect(screen.getByRole('heading', { name: 'C13 · STOP antes de builder. Hay contradicciones en la instrucción.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Siguiente pase recomendado: Producto / Founder' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contradicciones detectadas' })).toBeInTheDocument()
    expect(screen.getByText('Hay dos órdenes incompatibles: “PARA” y continuar con B/sin esperar.')).toBeInTheDocument()
    expect(screen.getByText('Reescribir internals de plantillas en vez de validar la salida observable del gate.')).toBeInTheDocument()
    expect(screen.getByText(/PARA PRODUCTO \/ FOUNDER — CHECKPOINT BREVE/)).toBeInTheDocument()
  })

  it('detecta una madriguera si el relevo intenta abrir otro frente o desplegar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByLabelText('Brief, salida del builder, revisión o bloqueo'),
      'Propongo abrir C14 ahora y desplegar ahora en producción para no perder tiempo.',
    )
    await user.click(screen.getByRole('button', { name: 'Sincronizar waypoint' }))

    expect(screen.getByRole('heading', { name: 'C14 · posible salida de ruta. Requiere checkpoint antes de construir.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Siguiente pase recomendado: Founder / Producto' })).toBeInTheDocument()
    expect(screen.getByText('Abrir C14 u otro frente antes de cerrar el frente vivo.')).toBeInTheDocument()
    expect(screen.getByText('Desplegar por inercia sin gate explícito.')).toBeInTheDocument()
    expect(screen.getByText(/PARA PRODUCTO \/ FOUNDER — CHECKPOINT/)).toBeInTheDocument()
  })
})
