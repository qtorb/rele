/**
 * Extracción de afirmaciones sobre el repo, a partir de un texto.
 * Módulo puro: sin git, sin red, sin disco.
 *
 * v1 detecta exactamente cuatro tipos. No ampliar sin brief.
 */

const BRANCH_PREFIXES = [
  'feat',
  'fix',
  'chore',
  'docs',
  'refactor',
  'test',
  'perf',
  'hotfix',
  'release',
  'build',
  'ci',
  'style',
]

const BRANCH_RE = new RegExp(String.raw`\b((?:${BRANCH_PREFIXES.join('|')})\/[A-Za-z0-9._\-\/]+[A-Za-z0-9])`, 'g')
const QUOTED_SLASH_RE = /[`'"«]\s*([A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9._\-\/]+)\s*[`'"»]/g
const PR_HASH_RE = /#(\d{1,6})\b/g
const PR_URL_RE = /github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/g
const PATH_RE = /\b((?:[\w.-]+\/)*[\w-]+\.[A-Za-z][A-Za-z0-9]{0,7})\b/g
const SHA_RE = /\b([0-9a-f]{7,40})\b/g
const URL_RE = /https?:\/\/\S+/g

/**
 * Extensiones que v1 reconoce como fichero. Es una lista blanca a propósito:
 * con una lista negra, `rele.pack` o `github.com` acaban tratados como rutas y
 * el reporte se llena de contradicciones falsas. Lo que no está aquí no se
 * detecta, y no detectar es preferible a alarmar sin motivo.
 */
const FILE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'mdx', 'txt', 'css', 'scss', 'html', 'svg',
  'yml', 'yaml', 'toml', 'ini', 'env', 'lock', 'sh', 'bash', 'ps1', 'py', 'go', 'rs', 'rb', 'php',
  'java', 'kt', 'swift', 'c', 'h', 'cpp', 'sql', 'xml', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf',
  'csv', 'vue', 'svelte', 'astro', 'gradle', 'cfg', 'conf', 'properties',
])

function extensionOf(value) {
  const parts = value.split('.')
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : ''
}

const CREATE_WORDS = [
  'crear',
  'crea ',
  'creará',
  'crearé',
  'nueva rama',
  'rama nueva',
  'checkout -b',
  'new branch',
  'create',
  'abre un pr',
  'abrir un pr',
  'pr nuevo',
  'nuevo pr',
  'añadir',
  'añade',
]

const EXISTS_WORDS = ['ya existe', 'existe', 'existente', 'ya hay', 'en la rama', 'rama actual', 'parte de']

const CLOSED_WORDS = ['cerrado', 'cerrada', 'fusionado', 'fusionada', 'merged', 'closed', 'integrado', 'ya se fusionó']
const OPEN_WORDS = ['abierto', 'abierta', 'open', 'sigue abierto', 'sin fusionar', 'pendiente']

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle))
}

/**
 * Qué afirma la frase sobre la cosa: que hay que crearla, que ya está, o nada.
 * Se mira solo la línea que contiene el token, no el texto entero: el contexto
 * lejano no es prueba.
 */
function detectAssertion(quote) {
  const lower = quote.toLowerCase()
  if (includesAny(lower, CREATE_WORDS)) return 'create'
  if (includesAny(lower, EXISTS_WORDS)) return 'exists'
  return 'unknown'
}

function detectPrState(quote) {
  const lower = quote.toLowerCase()
  if (includesAny(lower, CLOSED_WORDS)) return 'closed'
  if (includesAny(lower, OPEN_WORDS)) return 'open'
  return null
}

function collect(line, regex) {
  const found = []
  regex.lastIndex = 0
  let match
  while ((match = regex.exec(line)) !== null) found.push(match[1])
  return found
}

function looksLikePath(value) {
  return FILE_EXTENSIONS.has(extensionOf(value))
}

/**
 * Un token entrecomillado con barra es una rama salvo que sea un dominio
 * (`github.com/qtorb/rele`) o una ruta de fichero (`src/App.tsx`).
 */
function looksLikeBranch(value) {
  const [first] = value.split('/')
  if (first.includes('.')) return false
  return !looksLikePath(value)
}

/**
 * @param {string} text
 * @returns {Array<{id:string,type:'branch'|'pr'|'path'|'commit',value:string,quote:string,assertion:string,prState:(string|null)}>}
 */
export function extractClaims(text) {
  if (typeof text !== 'string' || !text.trim()) return []

  const claims = []
  const seen = new Set()

  const push = (type, value, quote) => {
    const key = `${type}:${value}`
    // La cita es obligatoria y debe estar literalmente en el texto. Sin ella la
    // afirmación no se reporta, así que no la creamos siquiera.
    const trimmed = quote.trim()
    if (!trimmed || !text.includes(trimmed)) return
    if (seen.has(key)) return
    seen.add(key)
    claims.push({
      id: `${type}-${claims.length + 1}`,
      type,
      value,
      quote: trimmed,
      assertion: detectAssertion(trimmed),
      prState: type === 'pr' ? detectPrState(trimmed) : null,
    })
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) continue

    // 1 · Ramas.
    for (const value of collect(line, BRANCH_RE)) push('branch', value, line)
    for (const value of collect(line, QUOTED_SLASH_RE)) {
      if (looksLikeBranch(value)) push('branch', value, line)
    }

    // 2 · Pull requests.
    for (const value of collect(line, PR_URL_RE)) push('pr', value, line)
    for (const value of collect(line, PR_HASH_RE)) push('pr', value, line)

    // 3 · Rutas de fichero. Las URLs se retiran antes para no confundir un
    // dominio con una ruta.
    const withoutUrls = line.replace(URL_RE, ' ')
    for (const value of collect(withoutUrls, PATH_RE)) {
      if (looksLikePath(value)) push('path', value, line)
    }

    // 4 · Commits. Se exige al menos una letra hexadecimal para no confundir un
    // SHA con un número largo cualquiera.
    for (const value of collect(line, SHA_RE)) {
      if (/[a-f]/.test(value)) push('commit', value, line)
    }
  }

  return claims
}
