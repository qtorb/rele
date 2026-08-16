# Relé · F0

Maqueta clicable para validar una sola interacción: abrir un frente de trabajo
y saber qué toca ahora sin reconstruir contexto.

Esta fase usa datos simulados de UXMachine/P9. No lee repositorios, no guarda
datos, no integra modelos ni representa una versión desplegable de Relé.

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
