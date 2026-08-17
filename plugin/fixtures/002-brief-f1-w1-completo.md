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
Zona PACK (colapsable, arriba o a la izquierda):

* Tres campos duros de texto: `destino`, `waypoint`, `siguiente_asiento`.
* Un `textarea` markdown libre: `cuerpo` (gates, reglas vivas, riesgos, aparcado, dueños).
* Un campo `proyecto` (texto, por defecto `UXM v3`).
* Botones: `Exportar pack` (descarga `.json`), `Importar pack` (sube `.json`).
* Indicador siempre visible: `relays desde la última actualización del pack: N`.

Zona INBOX:

* `textarea` grande: "Pega aquí lo último".
* Botón `Copiar prompt` (ver 3.2).
* `textarea`: "Pega aquí la respuesta JSON".
* Botón `Analizar`.

3.2 Extractor en modo manual (sin API, sin clave)
No hay llamada de red en este WRITE.
`Copiar prompt` compone y copia al portapapeles: prompt del extractor + pack completo serializado + el texto pegado.
El prompt del extractor vive en `src/extractor/prompt.ts` como constante exportada, no incrustado en el JSX.
Reglas que el prompt debe imponer explícitamente al LLM:

* Salida: solo JSON, sin texto alrededor.
* Ante duda, `PARA`. Nunca `PUEDE_IR`.
* Prohibido inventar contexto que no esté en el pack o en el texto pegado.
* `evidencia` debe ser un fragmento copiado literalmente del texto pegado.

3.3 Validación local (esto es el núcleo, no la UI)
Módulo `src/rules/validate.ts`, puro, sin dependencias de React, con tests propios.
Se aplica después de parsear el JSON y antes de pintar nada.
Regla de asimetría: cualquier degradación va siempre hacia `FALTA_MAPA` o `PARA`.
3.4 Salida en pantalla
Orden fijo, de arriba abajo: la señal, el motivo, la cita literal, el resumen, el handoff.
3.5 Botón de desacuerdo
Junto a la señal, un botón `Esto está mal`.
3.6 Persistencia

* `localStorage`, autoguardado en cada cambio.
* Claves: `rele.pack`, `rele.contador`, `rele.casos`, `rele.ultimos5`.
* El `.json` de export lleva dentro el campo `proyecto`.

4. QUÉ NO SE TOCA EN ESTE WRITE
Nada de: llamada a API o clave de ningún proveedor; backend; login; multiproyecto o selector de packs; lectura del repo; escritura de `.rele/`.
5. TESTS OBLIGATORIOS (Vitest, deben pasar para dar W1 por cerrado)
Sobre `src/rules/validate.ts`, sin renderizar.
6. CRITERIO DE CIERRE
W1 está cerrado cuando, con el pack de UXM v1 importado, Albert pega un texto y ve señal y cita en menos de tres clics.
7. ENTREGA
Un PR nuevo contra `main`, con resumen, salida de `npm test` y una captura.
