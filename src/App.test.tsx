import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Relé F0.1', () => {
  it('prepara un encargo READ ONLY antes de permitir cualquier WRITE', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Primero el modo. Después el encargo.' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /READ ONLY/i })[0]).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Preparar encargo READ ONLY' }))

    expect(screen.getByRole('heading', { name: 'P9 necesita diagnóstico, no WRITE.' })).toBeInTheDocument()
    expect(screen.getByText(/No modificar código/)).toBeInTheDocument()
    expect(screen.getByLabelText('Qué debe devolver el READ ONLY')).toHaveTextContent('NO CONCLUYENTE')
  })

  it('bloquea WRITE cuando no existe el gate previo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /WRITE/i }))
    await user.click(screen.getByRole('button', { name: 'Ver bloqueo de WRITE' }))

    expect(screen.getByRole('heading', { name: 'Todavía no hay WRITE.' })).toBeInTheDocument()
    expect(screen.getByText(/No hay WRITE autorizado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar bloqueo' })).toBeInTheDocument()
  })

  it('incorpora un STOP sin convertirlo en autorización', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Preparar encargo READ ONLY' }))
    await user.click(screen.getByRole('button', { name: 'Incorporar veredicto' }))

    expect(screen.getByRole('heading', { name: 'Incorporar salida sin perder el gate.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'STOP' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'P9 no continúa.' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'NO CONCLUYENTE' }))

    expect(screen.getByRole('heading', { name: 'No hay autorización para escribir.' })).toBeInTheDocument()
  })
})
