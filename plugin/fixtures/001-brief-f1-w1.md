BUILDER · WRITE · RELÉ F1-W1 · Pantalla única, pack local, extractor manual
Un solo brief. No encadenar con otros. No abrir frentes fuera del alcance.
0. BASE Y RAMA

* Repo: `github.com/qtorb/rele`.
* Partir de la rama de la maqueta F0.5 (la del PR #1), para reutilizar el andamiaje React + TS + Vite + Vitest ya existente.
* Rama nueva: `feat/rele-f1-uxm-app`.
* No empujar nada al PR #1. PR nuevo cuando W1 esté verde.
* Si la rama de F0.5 no es alcanzable, PARAR y reportar. No rehacer el andamiaje por tu cuenta.

1. READ ONLY PREVIO (obligatorio, antes de tocar código)
Reporta en tres líneas antes del primer commit:

1. Nombre exacto de la rama base y su HEAD.
2. Qué hay hoy en `src/App.tsx` (componentes, estado, si la lógica de señales es real o mock).
3. Si `npm test` pasa en limpio.

Si algo de esto no se puede confirmar, PARAR.
2. OBJETIVO DEL WRITE
Que Albert pueda, sin claves, sin backend y sin terminal:
pegar un texto → ver una señal con su prueba → copiar el handoff → aceptar o rechazar una actualización del pack.
Nada más.
3. ALCANCE
3.1 Pantalla única
Dos zonas en una sola vista. Sin router, sin pestañas, sin navegación.
3.2 Extractor en modo manual (sin API, sin clave)
El prompt del extractor vive en `src/extractor/prompt.ts` como constante exportada, no incrustado en el JSX.
3.3 Validación local (esto es el núcleo, no la UI)
Módulo `src/rules/validate.ts`, puro, sin dependencias de React, con tests propios.
3.6 Persistencia

* `localStorage`, autoguardado en cada cambio.
* Claves: `rele.pack`, `rele.contador`, `rele.casos`, `rele.ultimos5`.

7. ENTREGA
Un PR nuevo contra `main`, con resumen, salida de `npm test` y captura.
