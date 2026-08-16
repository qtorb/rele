import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Relé F0', () => {
  it('abre P9 y prepara un encargo para Builder', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Abrir P9' }))
    expect(screen.getByRole('heading', { name: 'Ahora mismo' })).toBeInTheDocument()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Preparar para Builder' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Preparar para Builder' }))
    expect(screen.getByRole('heading', { name: 'Primero, una captura fresca.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar encargo' })).toBeInTheDocument()
  })

  it('muestra una parada explícita cuando falla el precheck simulado', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Abrir P9' }))
    await user.click(screen.getByRole('button', { name: 'Incorporar resultado' }))
    await user.click(screen.getByRole('button', { name: 'P9 no puede continuar' }))
    await user.click(screen.getByRole('button', { name: 'Ver orientación' }))

    expect(screen.getByRole('heading', { name: 'La captura fresca sigue sin escribir tipo_contenido.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preparar bloqueo para Producto' })).toBeInTheDocument()
  })
})
