---
name: preflight
description: Comprueba contra el repo lo que un texto afirma sobre el repo — ramas, pull requests, rutas de fichero y commits — antes de actuar sobre él. Úsala cuando llegue un brief, un plan, una propuesta o un encargo que dé por hecho el estado del repositorio, o cuando el usuario pida verificar, contrastar o hacer preflight de un texto.
---

# Comprobación previa

Un texto llega afirmando cosas sobre el repo: que hay que crear tal rama, que
tal PR está cerrado, que tal fichero existe, que tal commit es el bueno. Algunas
de esas afirmaciones son falsas, y el coste de descubrirlo a mitad de la
ejecución es alto.

Esta skill las comprueba antes.

## Cómo se usa

Guarda el texto en un fichero y pásaselo al script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/preflight/scripts/preflight.mjs" --file <ruta-al-texto>
```

O por stdin:

```bash
cat <ruta-al-texto> | node "${CLAUDE_PLUGIN_ROOT}/skills/preflight/scripts/preflight.mjs"
```

Opciones: `--base <ref>` para comprobar las rutas contra otra referencia
(por defecto `HEAD`) y `--repo <dir>` para apuntar a otro repositorio.

Ejecútalo desde el repositorio sobre el que el texto afirma cosas. Sale con
código 1 si la señal es `PARA`, para poder encadenarlo.

## Qué devuelve

Tres señales, y solo tres:

- `PARA` — hay al menos una afirmación que el repo contradice.
- `PUEDE IR` — nada contradicho y al menos una afirmación confirmada.
- `SIN AFIRMACIONES COMPROBABLES` — no hay nada que git o gh puedan verificar.

Debajo de la señal salen **solo las contradicciones**, cada una con la cita
literal del texto, lo que el repo dice y el comando que lo demuestra. El resto
se resume en una línea de recuento.

## Cómo interpretarlo

Si sale `PARA`, no sigas con el texto tal cual: corrige la afirmación falsa en
origen y vuelve a comprobar. Lee la cita y el comando antes de decidir; el
reporte te da las dos cosas precisamente para que no tengas que fiarte.

`SIN AFIRMACIONES COMPROBABLES` no es un fallo ni una advertencia. Significa que
el texto no dice nada verificable sobre el repo, lo cual es perfectamente normal
en un texto de estrategia o de producto.

Lo que la comprobación no encuentra, no lo menciona. No hay alarma ante lo
desconocido.

## Propuestas y afirmaciones no son lo mismo

Un brief que dice "crea `src/x.ts`" no está afirmando que `src/x.ts` exista.
Solo se comprueban las rutas que el texto afirma existentes: las que llevan un
marcador explícito de estado en la misma frase ("modifica", "ya contiene", "los
tests pasan"). Una ruta bajo una sección de alcance o entregables se lee como
trabajo por hacer, y una mención suelta no afirma nada.

Ante la duda, no comprobable. Nunca contradicción.

## Registro

Cada corrida se anexa a `~/.rele/preflight-log.jsonl`, fuera del repo analizado. Para desactivarlo, `RELE_NO_LOG=1`; para cambiar la ruta, `RELE_LOG_PATH`.

## Retomar: ¿por dónde iba?

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/preflight/scripts/retomar.mjs" [ruta] [--encargo <fichero>]
```

Calcula el estado del proyecto ahora mismo y lo enseña en dos bloques: lo comprobado, con la fuente de cada línea, y lo que alguien dijo y nadie ha verificado. No guarda nada, no escribe en el repositorio y no anota la corrida en el registro.

Todo valor que viene de fuera —el encargo, el nombre del directorio, el de la rama, los títulos de PR— se neutraliza con el prefijo `! ` si puede hacerse pasar por una cabecera de bloque o por una marca de encargo.

El bloque comprobado no lleva credenciales, tokens ni URLs con autenticación; el encargo es texto tuyo, va literal entre sus marcas y no se filtra, así que lo que metas ahí es cosa tuya.

De toda la salida, lo único que se puede volver a verificar pegándola es la línea del commit, y la de rama solo si el nombre lleva prefijo. La versión no se verifica.

## Comprobación automática

Un enganche `UserPromptSubmit` comprueba cada mensaje enviado y solo habla si hay algo que decir; para apagarlo entero, `RELE_NO_HOOK=1`.

## Límites

- Solo comprueba ramas, pull requests, rutas de fichero y commits.
- No lee ningún fichero de memoria ni de configuración. No hay nada que rellenar.
- No escribe nada en el repo analizado.
- Las afirmaciones sobre pull requests necesitan `gh` autenticado. Sin él pasan
  a no comprobables y la señal no empeora por ello.
