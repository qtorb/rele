# Relé · F0.3 UXM

Relé es un **plugin de proyecto con memoria operativa versionable**. Esta fase
usa UXM como primer proyecto real de validación: no intenta gestionar todo el
proyecto, sino ayudarte a recuperar el mapa cuando cambias de sesión, rol,
modelo o brief.

F0.3 valida el gesto central:

> Pegar la última salida y obtener un waypoint operativo.

La maqueta usa un mapa UXM mínimo y un caso sintético. No lee repositorios, no
guarda datos, no integra modelos y no publica briefs reales completos.

## Qué valida F0.3

- Que Relé se comporte como waypoint, no como dashboard.
- Que compare un relevo contra un mapa mínimo del proyecto.
- Que distinga avance, bloqueo, revisión no canónica y madriguera.
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

F0.3 termina después de validar la maqueta. Persistencia `.rele/`, Git real,
Electron, IA o integración con LLMs requieren un brief posterior.

## Previsualización F0

Una rama auxiliar de GitHub Pages sirve la maqueta estática para revisión en
navegador. No hay backend, datos reales, autenticación ni despliegue de
producción.
