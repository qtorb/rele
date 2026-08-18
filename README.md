# Relé

Relé es **memoria operativa para trabajo AI-first**. El repo contiene dos cosas:

| | Qué es | Estado |
|---|---|---|
| [`plugin/`](plugin/) | **Plugin de Claude Code.** Comprobación previa por línea de comandos y por enganche automático. Sin configuración. | En desarrollo |
| `src/`, `server/` | **La app: tres zonas.** Lectura, escritura y vuelta, con la misma comprobación detrás. | En desarrollo |

**Una sola fuente:** la app y el enganche importan los módulos del plugin
(`claims`, `verify`, `report`, `log`, `permission`) desde
`plugin/skills/preflight/scripts/lib/`. No hay copia de la lógica de
comprobación. Si dos vías dieran señales distintas, sería un fallo.

---

# La app: tres zonas

```bash
npm install
```

```bash
npm run dev
```

Frontend en `http://localhost:5173`, backend en `:8787`. **No hace falta
ninguna clave para arrancar.**

La pantalla sigue el proceso, de izquierda a derecha:

1. **Lectura** — textos que solo miran: encargos READ ONLY, exploraciones, diagnósticos.
2. **Escritura** — encargos que autorizan tocar código: briefs de WRITE.
3. **Vuelta** — lo que devuelve el builder: salidas, bloqueos, informes de ejecución.

Arriba, un solo campo con la carpeta del proyecto, compartido por las tres y
recordado entre visitas. Cada zona tiene su área de texto y su botón
`Comprobar`, y la salida aparece debajo de la zona desde la que se lanzó.

Las tres ejecutan la misma verificación. La zona no cambia qué se comprueba del
repositorio: **declara qué permiso se espera**, que es lo que consume el gate
de permiso.

El endpoint es `POST /api/preflight` con `text`, `projectPath` y `zone`. El
registro guarda la zona junto al origen.

---

# F1 · congelado como referencia

El inbox, la salida del extractor y el Project Pack local quedan **congelados
como referencia F1**: sus ficheros siguen en el árbol y no se editan, pero la
app dejó de montarlos en F3-W3b. Se recuperan desde el commit `ed9f087`, junto
con sus tests, que viven sin ejecutarse en `src/App.f1.congelado.tsx`.

Lo que sigue documenta esa pantalla congelada, no la actual.

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

## Las dos puertas

Antes de pintar nada, la salida del motor —demo o real— pasa por
`src/rules/evidence.ts`, un módulo puro sin React y sin red.

**Puerta de evidencia.** El extractor debe devolver `evidencia`: un fragmento
copiado literalmente de la pieza pegada que justifique la señal.

- Sin cita → `FALTA MAPA`, motivo *señal sin prueba*.
- Cita que no aparece en el texto pegado (comparando con espacios y saltos
  normalizados) → `FALTA MAPA`, motivo *cita no verificable*.
- Respuesta malformada → `FALTA MAPA`, motivo *salida del extractor no válida*.
  Nunca una excepción.

**Puerta de caducidad.** Relé cuenta los relays analizados desde la última
actualización del Pack. A partir de 5, toda señal cae a `FALTA MAPA`, diga lo
que diga el extractor. Editar el Pack o aceptar una propuesta pone el contador
a 0; el reset está acoplado a `savePack` para que ningún camino de la app pueda
actualizar el mapa y olvidarse del contador.

**Regla de asimetría, vinculante.** Estas puertas solo pueden degradar. Ninguna
entrada posible puede producir `EN RUTA` si el motor no dijo `EN RUTA`. Hay un
test que lo recorre por fuerza bruta sobre señales, citas, textos y contadores.

La cita se muestra siempre en pantalla, entrecomillada, bajo la señal y el
motivo, antes del resumen.

## Corpus de desacuerdo

Junto a la señal hay un botón `Esto está mal`. Al pulsarlo eliges cuál era la
señal correcta y Relé guarda en `localStorage` el texto pegado, la respuesta
cruda del motor —la de antes de degradar—, la señal mostrada, tu corrección y la
fecha. `Exportar casos` los descarga todos en un `.json`.

No hay UI de lectura del corpus a propósito: es material de entrenamiento y
diagnóstico, no una bandeja de incidencias.

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

`localStorage` en el navegador, con tres claves: `rele.pack`, `rele.contador` y
`rele.casos`. Más **Exportar / Importar Project Pack** y **Exportar casos** en
JSON.

Las claves de la primera iteración (`rele.f1.projectPack`, `rele.f1.relayCount`,
`rele.f1.cases`) se migran solas la primera vez que se leen y se retiran, así
que un Pack guardado antes del renombrado no se pierde. Si por lo que sea
existen las dos, gana la nueva y la vieja se descarta.
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
