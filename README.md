# Relé · F1 UXM

Relé es un **plugin de proyecto con memoria operativa activa y versionable**. F1 lo
convierte de maqueta en app local útil: una sola pantalla que guarda un Project
Pack, recibe la última salida del proyecto, la analiza y devuelve una señal
visible más un handoff copiable.

> F1 no coordina todo el sistema. F1 evita que pierdas el siguiente paso.

## La pantalla

1. **Project Pack UXM** — editable y persistente en local. Campos: proyecto,
   destino, waypoint actual, siguiente asiento, gates bloqueantes, reglas vivas,
   riesgos vivos, aparcado y última actualización.
2. **Inbox** — pega la última pieza y, opcionalmente, declara el origen
   (auto, builder, producto, CTO, GTM, founder).
3. **Analizar** — la acción principal, no escondida entre controles secundarios.
4. **Resultado** — señal grande arriba, explicación corta, qué cambia, qué
   bloquea, quién tiene la pelota, qué hacer ahora y handoff listo para copiar.
5. **Memoria propuesta** — lo que Relé propone actualizar en el Pack. Nada se
   escribe solo; los campos que son decisión piden confirmación reforzada.

## Señales

`EN RUTA` · `GATE PRIMERO` · `STOP` · `BLOQUEADO` · `MADRIGUERA` · `FALTA MAPA` ·
`READ ONLY / NO CANÓNICO`

Reglas de coherencia que Relé no deja romper, venga la señal de donde venga:

- Solo `EN RUTA` puede autorizar avance o WRITE.
- Sin Project Pack mínimo (proyecto, destino, waypoint) la respuesta es
  `FALTA MAPA`. Relé no finge criterio.
- Ante duda entre dos señales, gana la más restrictiva.

## Ejecutar

```bash
npm install
npm run dev
```

`npm run dev` levanta las dos piezas a la vez: el frontend Vite (`:5173`) y el
backend local (`:8787`). Vite hace proxy de `/api` al backend, así que el
frontend nunca habla con ninguna API externa.

Para levantarlas por separado:

```bash
npm run dev:web
```

```bash
npm run dev:api
```

## Modo demo y modo real

**Modo demo (por defecto).** Sin API key, Relé analiza con reglas deterministas
y ejemplos sintéticos. Funciona entero: señales, handoff y memoria propuesta.

**Modo real.** Copia `.env.local.example` a `.env.local` y pon tu clave:

```bash
cp .env.local.example .env.local
```

```
ANTHROPIC_API_KEY=sk-ant-...
```

Reinicia `npm run dev:api`. El badge del Inbox pasa a `MODO REAL`.
Para desactivarlo, borra la clave o el archivo y reinicia el backend.

Variables opcionales: `RELE_MODEL` (por defecto `claude-opus-5`) y `RELE_PORT`
(por defecto `8787`).

### Qué hace y qué no hace el LLM

El LLM **no decide**. Solo extrae estructura operativa a un JSON con contrato
fijo (`server/extractor.js`): tipo de pieza, señal, gates, contradicciones,
riesgos, reglas, siguiente asiento, memoria candidata y handoff.

Al volver al frontend, esa salida se normaliza: los campos fuera de dominio caen
a valores seguros y la coherencia dura se reimpone en código, no se confía al
modelo. Si el backend no responde, devuelve algo ilegible o el modelo declina,
Relé **degrada al motor determinista y lo dice en pantalla**.

### Seguridad de la clave

- La clave vive solo en `.env.local`, que está en `.gitignore`.
- Solo la lee el backend (`server/`). Nunca se expone al frontend ni al bundle.
- No hay claves hardcodeadas en el repo.

## Persistencia

`localStorage` en el navegador, más **Exportar / Importar Project Pack** en JSON.
El importador acepta tanto el sobre exportado por Relé como un Pack pelado, y
tolera campos ausentes sin romper.

## Validar

```bash
npm run test
```

```bash
npm run build
```

## Fuera de alcance en F1

No se escribe en `.rele/`, no hay Git real y no se lee el repositorio. Cuando la
lectura de repo/GitHub llegue, será una capa de **evidencia puntual** —rama, PR,
archivos tocados, commits, tests—, no la fuente principal de orientación. El
sentido operativo vive en el Project Pack, el waypoint y las piezas pegadas.

## Arquitectura conceptual

```text
qtorb/rele
  software/app de Relé

cada-proyecto/.rele/
  memoria operativa versionable del proyecto (todavía no implementado)
```

```text
.git/   guarda historia técnica
.rele/  guarda mapa operativo
```
