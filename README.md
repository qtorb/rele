# Relé · F0.4 UXM

Relé es un **plugin de proyecto con memoria operativa versionable**. Esta fase
usa UXM como primer proyecto real de validación: no intenta gestionar todo el
proyecto, sino ayudarte a recuperar el mapa cuando cambias de sesión, rol,
modelo o brief.

F0.4 valida el gesto central corregido:

> Pegar la última salida y recibir una alerta útil antes de perder el control.

La maqueta usa un mapa UXM mínimo y casos sintéticos. No lee repositorios, no
guarda datos, no integra modelos y no publica briefs reales completos. Si falta
mapa/status del proyecto, Relé no finge criterio: devuelve `Sin contexto
operativo`.

La lectura de repositorio/GitHub queda fuera de F0.4. Cuando exista, debe ser
una capa de evidencia puntual —rama, PR, archivos tocados, tests, commits—, no
la fuente principal de orientación. El sentido operativo vive en el Project
Pack, el waypoint y los relevos pegados.

## Qué valida F0.4

- Que Relé arranque como inbox operativo, no como dashboard.
- Que use dos entradas explícitas: mapa/status del proyecto + último relevo.
- Que compare un relevo contra un mapa mínimo del proyecto.
- Que distinga avance, `STOP` antes de builder, bloqueo, revisión no canónica y
  madriguera.
- Que detecte contradicciones de bajo nivel, como `PARA` vs `sigue con B` o
  prescribir internals cuando el contrato real es pasar un gate.
- Que muestre distancia al destino y no solo estado técnico.
- Que prepare texto para el siguiente asiento sin enviarlo automáticamente.
- Que el bloqueo del builder no se convierta en permiso de `WRITE`.

## Arquitectura conceptual

```text
qtorb/rele
  software/app de Relé

cada-proyecto/.rele/
  memoria operativa versionable del proyecto
```

Comparación guía:

```text
.git/   guarda historia técnica
.rele/  guarda mapa operativo
```

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Validar

```bash
npm run test
npm run build
```

F0.4 termina después de validar la maqueta. Persistencia `.rele/`, Git real,
Electron, IA o integración con LLMs requieren un brief posterior.

## Previsualización F0

Una rama auxiliar de GitHub Pages sirve la maqueta estática para revisión en
navegador. No hay backend, datos reales, autenticación ni despliegue de
producción.
