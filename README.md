# Relé · F0.1

Maqueta clicable para validar una interacción más precisa: convertir una duda
de proyecto en un encargo operativo usando la gramática real de trabajo:
`READ ONLY`, `WRITE`, `REVISIÓN` y `CHECKPOINT`.

Esta fase usa datos simulados de UXMachine/P9. No lee repositorios, no guarda
datos ni integra modelos. La previsualización web sirve solo para probar si la
interfaz reduce carga mental; no representa una versión de producto de Relé.

## Qué valida F0.1

- Que Relé arranque por modo de trabajo, no por dashboard de frentes.
- Que `WRITE` quede bloqueado cuando falta un `READ ONLY` previo.
- Que una revisión viaje como contexto efímero, no como decisión.
- Que un checkpoint sirva para cerrar seguir/parar/cambiar de frente.
- Que los veredictos sean cerrados: `PASA`, `STOP`, `NO CONCLUYENTE`.

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

F0.1 termina después de validar la maqueta. Cualquier persistencia, Git real,
Electron, IA o integración con LLMs requiere un brief posterior.

## Previsualización F0

Una rama auxiliar de GitHub Pages sirve la maqueta estática para revisión en
navegador. No hay backend, datos reales, autenticación ni despliegue de
producción.
