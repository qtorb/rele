#!/usr/bin/env node
/**
 * Entrada del enganche UserPromptSubmit.
 *
 * Lee el JSON del evento por stdin, imprime lo que haya que decir —o nada— y
 * sale SIEMPRE con código 0. Nunca escribe en stderr y nunca emite `continue`:
 * este enganche informa, no frena.
 */

import { readFileSync } from 'node:fs'
import { appendRun, defaultLogPath } from '../skills/preflight/scripts/lib/log.mjs'
import { nodeRunner } from '../skills/preflight/scripts/lib/verify.mjs'
import { runHook } from './lib/enganche.mjs'

function leerEvento() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return null
  }
}

try {
  const evento = leerEvento()
  if (evento) {
    const cwd = typeof evento.cwd === 'string' && evento.cwd ? evento.cwd : process.cwd()
    const salida = runHook({
      prompt: evento.user_prompt,
      cwd,
      run: nodeRunner(cwd),
      log: (entry) => appendRun(entry, { path: defaultLogPath() }),
    })
    if (salida) console.log(salida)
  }
} catch {
  // Silencio. Un fallo aquí no puede ensuciar ni frenar la sesión.
}

process.exit(0)
