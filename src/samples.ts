export const SAMPLES = {
  avance: `BRIEF C13 · rev.4 · EJECUTABLE

Autor: advisor de producto · Revisor: CTO adjudicado.

Qué se hace:
- C13 corrige la presentación del informe.
- El foco ordena familias; no recorta ni jerarquiza.

Preflight ya recomputado:
- Árbol limpio verificado.
- Tests en verde.
- Turno de despliegue concedido para la ventana de hoy.

Esto es WRITE con gates. Ejecuta solo el brief adjunto.

Entrega: veredicto, archivos tocados, evidencia y tests ejecutados.`,

  gate: `BRIEF C14 · rev.1 · EJECUTABLE

Qué se hace:
- Ajuste de copy en la vista de resultado.
- Cambio acotado, sin tocar detectores.

Se puede lanzar al builder como WRITE en cuanto haya hueco.

Entrega: veredicto, archivos tocados y tests.`,

  bloqueo: `Bloqueo: no puedo confirmar que el directorio abierto sea el repositorio esperado.

No se ha creado rama, commit ni push.
No se ha modificado ningún archivo.

Me detengo para no escribir en el sitio incorrecto.`,

  stop: `ASIENTO REVISOR · instrucciones para el builder

Paso 1 · Ejecuta el gate del frente C13 y reporta el resultado.

Paso 2 · Reescribe las plantillas hasta que no quede ninguna marca {n} en plantilla.

Paso 3 · Si el gate falla, PARA y dilo.

Paso 4 · Arranca la parada B sin esperarme, con un criterio de aceptación
que no está en el brief: el informe debe caber en una pantalla.

Alcance: el brief titula que son veintiséis piezas, pero la lista buena
es la que salga del gate.`,
} as const

export type SampleKey = keyof typeof SAMPLES
