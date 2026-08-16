import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Relé F0.2', () => {
  it('sincroniza un relevo ejecutable y prepara portada para builder', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Pega la última salida. Relé te dice dónde estás.' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Usar ejemplo sintético C13' }))
    await user.click(screen.getByRole('button', { name: 'Sincronizar' }))

    expect(screen.getByRole('heading', { name: 'Ejecutable, con límites' })).toBeInTheDocument()
    expect(screen.getByText('Origen probable: Producto.')).toBeInTheDocument()
    expect(screen.getByText('Pegar C13 al builder con portada de control. Mantener gates y no desplegar si el brief lo bloquea.')).toBeInTheDocument()
    expect(screen.getByText('No desplegar: falta control de turno/árbol limpio.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Portada para pegar antes del brief' })).toBeInTheDocument()
  })

  it('detecta un bloqueo del builder sin convertirlo en WRITE', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Builder' }))
    await user.type(
      screen.getByLabelText('Pega aquí el brief, bloqueo o revisión'),
      'Bloqueo: no puedo confirmar el remoto. No se ha modificado nada. No se ha creado rama ni commit.',
    )
    await user.click(screen.getByRole('button', { name: 'Sincronizar' }))

    expect(screen.getByRole('heading', { name: 'Bloqueado' })).toBeInTheDocument()
    expect(screen.getByText('No relanzar como WRITE. Resolver el bloqueo o llevarlo a checkpoint.')).toBeInTheDocument()
    expect(screen.getByText('No reinterpretar el bloqueo como autorización de WRITE.')).toBeInTheDocument()
  })
})
