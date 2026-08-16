# Relé · F0.2

Maqueta clicable para validar la entrada natural de Relé: pegar la última
salida de builder, producto, CTO o GTM y convertirla en estado operativo.

Esta fase usa un caso operativo sintético inspirado en UXMachine. No lee repositorios, no guarda
datos ni integra modelos. La previsualización web sirve solo para probar si la
interfaz reduce carga mental; no representa una versión de producto de Relé.

## Qué valida F0.2

- Que Relé arranque por **captura de relevo**, no por dashboard.
- Que detecte origen probable, frente, fase, estado y destino.
- Que separe `STOPs`, contratos, memoria candidata y contexto no canónico.
- Que prepare una portada para pegar antes de un brief al builder.
- Que un bloqueo del builder no se reinterprete como autorización de `WRITE`.

El ejemplo C13 incluido es sintético: conserva la forma operativa del caso real
sin publicar el brief completo en el repo.

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

F0.2 termina después de validar la maqueta. Cualquier persistencia, Git real,
Electron, IA o integración con LLMs requiere un brief posterior.

## Previsualización F0

Una rama auxiliar de GitHub Pages sirve la maqueta estática para revisión en
navegador. No hay backend, datos reales, autenticación ni despliegue de
producción.
