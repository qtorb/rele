/**
 * Normaliza la ruta de carpeta que llega desde la caja.
 *
 * "Copiar como ruta" del Explorador de Windows envuelve la ruta en comillas
 * dobles, y algunos shells lo hacen en simples. Pegarla tal cual producía "Esa
 * carpeta no existe": un mensaje correcto y desconcertante, porque la carpeta
 * sí estaba. Aquí se quitan antes de tocar el disco.
 */
export function normalizeProjectPath(value) {
  if (typeof value !== 'string') return ''

  let path = value.trim()

  // En bucle, por si viene envuelta más de una vez o con espacios por dentro
  // de las comillas.
  while (
    path.length >= 2 &&
    ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'")))
  ) {
    path = path.slice(1, -1).trim()
  }

  return path
}
