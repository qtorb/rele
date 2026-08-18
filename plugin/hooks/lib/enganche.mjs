/**
 * Comprobación automática al enviar un mensaje.
 *
 * Este código corre en TODAS las sesiones del usuario, no solo cuando alguien
 * se acuerda de Relé. De ahí las tres reglas que lo gobiernan:
 *
 *   - No bloquea nunca. Informa y deja seguir. Quien decide parar es la persona.
 *   - Falla en silencio. Cualquier error se traga sin mensaje: un fallo aquí
 *     degradaría todo el trabajo del usuario, no solo Relé.
 *   - Tiene presupuesto de tiempo duro. Si se pasa, abandona y calla.
 *
 * Y es mucho más callado que el modo manual: en la app el usuario ha pedido el
 * informe; aquí no ha pedido nada.
 */

import { extractClaims } from '../../skills/preflight/scripts/lib/claims.mjs'
import { CONTRADICHA, verifyClaims } from '../../skills/preflight/scripts/lib/verify.mjs'
import { counts, formatReport, globalSignal, plural } from '../../skills/preflight/scripts/lib/report.mjs'
import { buildEntry } from '../../skills/preflight/scripts/lib/log.mjs'
import { permissionVerdicts } from '../../skills/preflight/scripts/lib/permission.mjs'
import { PLUGIN_VERSION } from '../../skills/preflight/scripts/lib/version.mjs'

export const BUDGET_MS = 2000
export const DISABLE_ENV = 'RELE_NO_HOOK'

const ABANDONED = Symbol('presupuesto agotado')

export function hookDisabled(env = process.env) {
  const value = env[DISABLE_ENV]
  if (!value) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false'
}

/**
 * Envuelve el runner con un plazo. Se mira antes y después de cada llamada:
 * antes para no empezar lo que no da tiempo, después para cazar una sola
 * llamada que se eternice.
 */
function withDeadline(run, now, deadline) {
  return (cmd, args) => {
    if (now() > deadline) throw ABANDONED
    const result = run(cmd, args)
    if (now() > deadline) throw ABANDONED
    return result
  }
}

/**
 * Devuelve el texto a mostrar, o cadena vacía para no decir nada.
 * Nunca lanza y nunca devuelve algo que pueda frenar la sesión.
 */
export function runHook({
  prompt,
  cwd,
  run,
  now = Date.now,
  env = process.env,
  log = () => {},
} = {}) {
  try {
    if (hookDisabled(env)) return ''
    if (typeof prompt !== 'string' || !prompt.trim()) return ''
    if (typeof run !== 'function') return ''

    // Barato y sin red: son patrones. Si no hay nada que comprobar, ni
    // siquiera se toca el repositorio.
    const claims = extractClaims(prompt)
    const permisos = permissionVerdicts(prompt)
    if (!claims.length && !permisos.length) return ''

    const deadline = now() + BUDGET_MS
    const guarded = withDeadline(run, now, deadline)

    // El gate de permiso no necesita repositorio: solo lee el texto. Las
    // afirmaciones sobre el repo sí, y fuera de un repo no hay nada contra
    // qué compararlas.
    let repoVerdicts = []
    if (claims.length) {
      const enRepo = guarded('git', ['rev-parse', '--is-inside-work-tree']).ok
      if (enRepo) repoVerdicts = verifyClaims(claims, { run: guarded, text: prompt })
    }

    const verdicts = [...repoVerdicts, ...permisos]
    if (!verdicts.length) return ''
    const { contradichas, sostenidas } = counts(verdicts)

    log(
      buildEntry({
        date: new Date().toISOString(),
        repo: cwd ?? null,
        branch: null,
        signal: globalSignal(verdicts),
        text: prompt,
        verdicts,
        version: PLUGIN_VERSION,
        origin: 'enganche',
      }),
    )

    if (contradichas > 0) {
      // Aquí sí hace falta el detalle: hay algo que decidir. Es el mismo
      // formato que dan la app y el comando.
      return `Relé:\n\n${formatReport(verdicts)}`
    }

    // Sin nada comprobado no hay recibo que dar: una línea con denominador
    // cero no afirma nada, y un recibo de cero no es un aprobado.
    if (sostenidas === 0) return ''

    return `Relé: ${plural(sostenidas, 'afirmación comprobada', 'afirmaciones comprobadas')}, ninguna contradicha.`
  } catch {
    // Presupuesto agotado, git que no responde, módulo que revienta: da igual.
    // El enganche calla y la sesión sigue como si no existiera.
    return ''
  }
}

export { CONTRADICHA }
