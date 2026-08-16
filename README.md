# Relé · F0

Maqueta clicable para validar una sola interacción: abrir un frente de trabajo
y saber qué toca ahora sin reconstruir contexto.

Esta fase usa datos simulados de UXMachine/P9. No lee repositorios, no guarda
datos ni integra modelos. La previsualización web sirve solo para probar F0;
no representa una versión de producto de Relé.

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

F0 termina después de validar la maqueta. Cualquier persistencia, Git real,
Electron o integración con LLMs requiere un brief posterior.

## Previsualización F0

La rama de F0 publica una maqueta estática en GitHub Pages para revisión en
navegador. No hay backend, datos reales, autenticación ni despliegue de
producción.
