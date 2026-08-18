import { ZonesPanel } from './components/ZonesPanel'

/**
 * La pantalla sigue el proceso, de izquierda a derecha: lectura, escritura y
 * vuelta.
 *
 * El inbox, la salida del extractor y el Project Pack quedan congelados como
 * referencia F1: sus ficheros siguen en el árbol y no se editan, pero no se
 * montan. Con ellos desaparecen de la app la señal FALTA MAPA y toda frase de
 * ausencia que no venga del preflight.
 */
export function App() {
  return (
    <main className="shell">
      <header className="brand">
        <p className="brand-mark">Relé</p>
        <p className="brand-note">Comprobación previa</p>
      </header>

      <section className="hero">
        <p className="eyebrow">De izquierda a derecha</p>
        <h1>Pega el texto en la zona del proceso en la que estás.</h1>
        <p className="intro">
          Relé comprueba contra el repositorio lo que el texto afirma sobre el repositorio, y si el
          permiso que declara cuadra con lo que ordena. No escribe nada en el proyecto.
        </p>
      </section>

      <ZonesPanel />
    </main>
  )
}
