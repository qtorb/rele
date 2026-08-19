#!/usr/bin/env node
/**
 * Entrada de línea de comandos de `retomar`.
 *
 *   node retomar.mjs [ruta] [--encargo <fichero>]
 *
 * Sin ruta, el directorio actual. No escribe nada: ni en el repositorio, ni en
 * el registro. Código de salida 0 salvo error de invocación.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { nodeRunner } from './lib/verify.mjs'
import { retomar } from './lib/retomar.mjs'

function parseArgs(argv) {
  const args = { repoPath: null, encargoPath: null }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--encargo' && argv[i + 1]) args.encargoPath = argv[++i]
    else if (!argv[i].startsWith('--') && !args.repoPath) args.repoPath = argv[i]
  }
  return args
}

function fallar(mensaje) {
  console.error(mensaje)
  process.exit(2)
}

const args = parseArgs(process.argv.slice(2))
const repoPath = args.repoPath ?? process.cwd()

if (!existsSync(repoPath)) fallar('Esa carpeta no existe.')
if (!statSync(repoPath).isDirectory()) fallar('Esa ruta es un fichero, no una carpeta.')

let encargo = null
if (args.encargoPath) {
  // Se lee antes de recoger nada: si falta el fichero, no se produce salida a
  // medias.
  if (!existsSync(args.encargoPath)) fallar('No encuentro el fichero de encargo que has indicado.')
  try {
    encargo = readFileSync(args.encargoPath, 'utf8')
  } catch {
    fallar('No he podido leer el fichero de encargo.')
  }
}

const resultado = retomar({
  repoPath,
  encargo,
  run: nodeRunner(repoPath),
  leerRegistro: () => {
    try {
      return readFileSync(process.env.RELE_LOG_PATH ?? join(homedir(), '.rele', 'preflight-log.jsonl'), 'utf8')
    } catch {
      return null
    }
  },
})

if (!resultado.ok) fallar(resultado.error)

console.log(resultado.salida)
process.exit(0)
