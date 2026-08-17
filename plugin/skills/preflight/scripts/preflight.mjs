#!/usr/bin/env node
/**
 * Relé · comprobación previa.
 *
 * Lee un texto y verifica contra el repo todo lo que ese texto afirma sobre el
 * repo. No escribe nada, en ningún sitio.
 *
 *   node preflight.mjs --file brief.md
 *   cat brief.md | node preflight.mjs
 *
 * Sale con código 1 si la señal es PARA, para poder encadenarlo en un gate.
 */

import { readFileSync } from 'node:fs'
import { extractClaims } from './lib/claims.mjs'
import { nodeRunner, verifyClaims } from './lib/verify.mjs'
import { PARA, formatReport, globalSignal } from './lib/report.mjs'
import { appendRun, buildEntry, countLine, defaultLogPath, readStats } from './lib/log.mjs'

const PLUGIN_VERSION = '0.3.0'

function parseArgs(argv) {
  const args = { file: null, base: 'HEAD', repo: process.cwd() }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file' && argv[i + 1]) args.file = argv[++i]
    else if (argv[i] === '--base' && argv[i + 1]) args.base = argv[++i]
    else if (argv[i] === '--repo' && argv[i + 1]) args.repo = argv[++i]
  }
  return args
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

const args = parseArgs(process.argv.slice(2))
const text = args.file ? readFileSync(args.file, 'utf8') : readStdin()

if (!text.trim()) {
  console.error('Relé: no hay texto que comprobar. Usa --file <ruta> o pásalo por stdin.')
  process.exit(2)
}

const run = nodeRunner(args.repo)
const claims = extractClaims(text)
const verdicts = verifyClaims(claims, { run, text, baseRef: args.base })
const signal = globalSignal(verdicts)

// El registro es telemetría. Nada de lo que pase de aquí abajo puede cambiar la
// señal ni romper la corrida: leer va antes de anexar, y ambas cosas degradan a
// silencio si fallan.
const logPath = defaultLogPath()
const stats = readStats(logPath)

console.log(formatReport(verdicts, { countLine: countLine(stats) }))

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
appendRun(
  buildEntry({
    date: new Date().toISOString(),
    repo: args.repo,
    branch: branch.ok ? branch.stdout.trim() : null,
    signal,
    text,
    verdicts,
    version: PLUGIN_VERSION,
    origin: 'cli',
  }),
  { path: logPath },
)

process.exit(signal === PARA ? 1 : 0)
