import { useEffect, useState } from 'react'

const PATH_KEY = 'rele.preflight.ruta'

/** Quién escribió el texto que se pega. Opcional y sin valor por defecto. */
export const ASIENTOS = [
  'producto',
  'CTO',
  'advisor GTM',
  '2º advisor producto',
  'founder',
  'builder',
] as const

export type Asiento = (typeof ASIENTOS)[number]

/** Se recuerda por zona: cada una suele recibir de un asiento distinto. */
const seatKey = (zone: ZoneId) => `rele.asiento.${zone}`

export type ZoneId = 'lectura' | 'escritura' | 'vuelta'

type ZoneSpec = {
  id: ZoneId
  titulo: string
  descripcion: string
  marcador: string
}

/**
 * El proceso, de izquierda a derecha. La zona no cambia qué se comprueba del
 * repositorio: declara qué permiso se espera, que es lo que consume el gate.
 */
const ZONAS: ZoneSpec[] = [
  {
    id: 'lectura',
    titulo: 'Lectura',
    descripcion: 'Textos que solo miran: encargos READ ONLY, exploraciones, diagnósticos.',
    marcador: 'Pega aquí un encargo de solo lectura.',
  },
  {
    id: 'escritura',
    titulo: 'Escritura',
    descripcion: 'Encargos que autorizan tocar código: briefs de WRITE.',
    marcador: 'Pega aquí un brief que autoriza escribir.',
  },
  {
    id: 'vuelta',
    titulo: 'Vuelta',
    descripcion: 'Lo que devuelve el builder: salidas, bloqueos, informes de ejecución.',
    marcador: 'Pega aquí lo que ha devuelto el builder.',
  },
]

type Resultado = {
  signal: string
  report: string
  notice: string | null
}

function loadSeat(zone: ZoneId): string {
  try {
    return window.localStorage.getItem(seatKey(zone)) ?? ''
  } catch {
    return ''
  }
}

function loadPath() {
  try {
    return window.localStorage.getItem(PATH_KEY) ?? ''
  } catch {
    return ''
  }
}

function tone(signal: string) {
  if (signal === 'PARA') return 'stop'
  if (signal === 'PUEDE IR') return 'go'
  return 'hold'
}

export function ZonesPanel() {
  const [projectPath, setProjectPath] = useState(loadPath)
  const [textos, setTextos] = useState<Record<ZoneId, string>>({
    lectura: '',
    escritura: '',
    vuelta: '',
  })
  const [asientos, setAsientos] = useState<Record<ZoneId, string>>(() => ({
    lectura: loadSeat('lectura'),
    escritura: loadSeat('escritura'),
    vuelta: loadSeat('vuelta'),
  }))
  const [resultados, setResultados] = useState<Partial<Record<ZoneId, Resultado>>>({})
  const [errores, setErrores] = useState<Partial<Record<ZoneId, string>>>({})
  const [comprobando, setComprobando] = useState<ZoneId | null>(null)

  // La ruta es una sola para las tres zonas, y se recuerda entre visitas.
  useEffect(() => {
    try {
      window.localStorage.setItem(PATH_KEY, projectPath)
    } catch {
      // Sin persistencia la ruta sigue viva en la sesión.
    }
  }, [projectPath])

  const elegirAsiento = (zone: ZoneId, asiento: string) => {
    setAsientos((previo) => ({ ...previo, [zone]: asiento }))
    try {
      window.localStorage.setItem(seatKey(zone), asiento)
    } catch {
      // Sin persistencia el asiento sigue vivo en la sesión.
    }
  }

  const comprobar = async (zone: ZoneId) => {
    setComprobando(zone)
    setErrores((previo) => ({ ...previo, [zone]: '' }))
    setResultados((previo) => ({ ...previo, [zone]: undefined }))

    try {
      const respuesta = await fetch('/api/preflight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: textos[zone],
          projectPath,
          zone,
          seat: asientos[zone] || null,
        }),
      })
      const datos = (await respuesta.json()) as { ok?: boolean; error?: string } & Resultado

      if (!respuesta.ok || !datos.ok) {
        setErrores((previo) => ({ ...previo, [zone]: datos.error ?? 'No he podido completar la comprobación.' }))
        return
      }
      setResultados((previo) => ({
        ...previo,
        [zone]: { signal: datos.signal, report: datos.report, notice: datos.notice },
      }))
    } catch {
      setErrores((previo) => ({
        ...previo,
        [zone]: 'No encuentro el backend local. Arráncalo con npm run dev.',
      }))
    } finally {
      setComprobando(null)
    }
  }

  return (
    <section className="zonas" aria-label="Comprobación por zonas">
      <div className="panel ruta-panel">
        <label htmlFor="ruta-proyecto">Carpeta del proyecto</label>
        <p className="field-hint">
          Una sola para las tres zonas. Se recuerda entre visitas. Nada se escribe en ese repositorio.
        </p>
        <textarea
          id="ruta-proyecto"
          onChange={(event) => setProjectPath(event.target.value.replace(/\n/g, ''))}
          placeholder="C:\ruta\a\tu\proyecto"
          rows={1}
          value={projectPath}
        />
      </div>

      <div className="zonas-fila">
        {ZONAS.map((zona) => {
          const resultado = resultados[zona.id]
          const error = errores[zona.id]
          const puede = textos[zona.id].trim().length > 0 && projectPath.trim().length > 0 && !comprobando

          return (
            <section className="panel zona" key={zona.id} aria-labelledby={`zona-${zona.id}`}>
              <p className="eyebrow">{zona.titulo}</p>
              <h2 id={`zona-${zona.id}`}>{zona.descripcion}</h2>

              <div className="field asiento">
                <label htmlFor={`asiento-${zona.id}`}>Asiento</label>
                <select
                  id={`asiento-${zona.id}`}
                  onChange={(event) => elegirAsiento(zona.id, event.target.value)}
                  value={asientos[zona.id]}
                >
                  <option value="">Sin declarar</option>
                  {ASIENTOS.map((asiento) => (
                    <option key={asiento} value={asiento}>
                      {asiento}
                    </option>
                  ))}
                </select>
              </div>

              <label className="visually-hidden" htmlFor={`texto-${zona.id}`}>
                Texto de {zona.titulo}
              </label>
              <textarea
                id={`texto-${zona.id}`}
                onChange={(event) =>
                  setTextos((previo) => ({ ...previo, [zona.id]: event.target.value }))
                }
                placeholder={zona.marcador}
                rows={10}
                value={textos[zona.id]}
              />

              <div className="actions">
                <button
                  className="button button-primary"
                  disabled={!puede}
                  onClick={() => void comprobar(zona.id)}
                  type="button"
                >
                  {comprobando === zona.id ? 'Comprobando…' : 'Comprobar'}
                </button>
              </div>

              {error && (
                <p className="preflight-error" role="status">
                  {error}
                </p>
              )}

              {resultado && (
                <section className="preflight-result" aria-live="polite">
                  <p className={`signal-label preflight-signal preflight-${tone(resultado.signal)}`}>
                    {resultado.signal}
                  </p>
                  {resultado.notice && (
                    <p className="preflight-notice" role="status">
                      {resultado.notice}
                    </p>
                  )}
                  <pre>{resultado.report}</pre>
                </section>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}
