# Relé · comprobación previa

Verifica contra el repo todo lo que un texto afirma sobre el repo, antes de que
ese texto salga de la sesión que lo escribió.

No hay pack, no hay memoria, no hay configuración. Se instala y funciona.

## Instalar

Desde la raíz de este repositorio:

```bash
claude plugin marketplace add ./
```

```bash
claude plugin install rele-preflight@rele
```

La barra final de `./` es obligatoria: `claude plugin marketplace add .` a secas
se rechaza como formato inválido.

Cero campos de configuración. La skill se activa sola cuando llega un texto que
da por hecho el estado del repositorio, o pidiéndola por su nombre.

Medido de cero a primera señal útil: **3,0 s** (0,8 s el marketplace, 1,2 s la
instalación, 1,0 s la primera comprobación). Coste permanente del plugin: ~88
tokens por sesión.

## Usar sin Claude Code

El script es Node puro, sin dependencias:

```bash
node plugin/skills/preflight/scripts/preflight.mjs --file brief.md
```

```bash
cat brief.md | node plugin/skills/preflight/scripts/preflight.mjs
```

Opciones: `--base <ref>` (referencia contra la que se comprueban las rutas, por
defecto `HEAD`) y `--repo <dir>`. Sale con código 1 si la señal es `PARA`.

## Qué comprueba

Cuatro tipos de afirmación, y solo cuatro:

| Tipo | Se detecta como | Se verifica con |
|---|---|---|
| Rama | `feat/...`, `fix/...` y similares, o cualquier token entrecomillado con forma de rama | `git branch -a`, `git ls-remote` |
| Pull request | `#N` o una URL de PR | `gh pr view N --json state,headRefName,baseRefName` |
| Ruta de fichero | token con forma de ruta y extensión conocida | `git cat-file -e <base>:<ruta>`, o `git ls-files` si es un nombre suelto |
| Commit | SHA de 7 o más caracteres hexadecimales | `git cat-file -e <sha>^{commit}` |

## Los tres cubos

- **SOSTENIDA** — el repo confirma lo que el texto dice.
- **CONTRADICHA** — el repo dice lo contrario.
- **NO COMPROBABLE** — no hay forma de verificarlo con git o gh.

Y la señal global, derivada mecánicamente:

- Alguna contradicha → `PARA`.
- Ninguna contradicha y al menos una sostenida → `PUEDE IR`.
- Todo lo demás → `SIN AFIRMACIONES COMPROBABLES`.

## Dos reglas vinculantes

**Silencio ante lo desconocido.** Una afirmación no comprobable nunca produce
alarma ni empeora la señal. Un plugin que grita ante lo que no entiende se
desinstala la primera semana. Es una decisión de diseño, no una carencia.

**Sin prueba no se reporta.** Cada afirmación lleva el fragmento literal del
texto que la contiene y el comando cuya salida la sostiene o la contradice. Si
falta cualquiera de las dos, la afirmación no se reporta ni cuenta para la señal.

## Cómo distingue una propuesta de una afirmación

`Rama nueva: feat/x` y `seguimos en feat/x` afirman cosas distintas sobre el
mismo token. El plugin lee la línea que contiene el token —no el texto entero,
que no es prueba— y busca marcas de intención.

**Ramas**

- Manda **crear** algo que ya existe → contradicción.
- Dice que algo **existe** y no está → contradicción.
- Solo lo menciona y no está → no comprobable. Nombrar no es afirmar.

**Rutas de fichero**, por este orden:

1. **Marcador explícito de existencia en la misma frase** —"ya está probada",
   "modifica", "los tests pasan", "ya contiene"— → afirma que existe, y es
   verificable. Gana siempre, incluso dentro de una sección de alcance.
2. **Contexto de sección** —alcance, entregables, qué construir— → pide que se
   cree → no comprobable.
3. **Nada de lo anterior** → ambiguo → no comprobable.

Una ruta que pide crearse y ya existe **no** es contradicción en esta versión.
Podría serlo; hoy no, porque redactar "crea X" cuando X existe a medias es
demasiado frecuente para alarmar. Queda aparcado y escrito.

Verbos como "vive en" no deciden nada por sí solos: describen igual de bien el
repo de hoy que dónde irá el código mañana. Sin más señal caen en la regla 3.

### Nombre suelto contra ruta con directorios

Citar `capture.mjs` afirma que el fichero existe, no que esté en la raíz. Así que
un nombre sin directorios se busca **en todo el árbol**:

- Aparece en algún sitio → sostenida, y el comando del reporte es el de la
  búsqueda.
- No aparece en ninguna parte → contradicha.
- Aparece en varios sitios → sostenida, y el reporte dice cuántos sin elegir
  ninguno. Elegir sería inventar cuál quiso decir el texto.

Si el texto da una ruta con directorios, esa ruta es la afirmación y se
comprueba exacta.

Un matiz declarado: la búsqueda por nombre suelto usa `git ls-files`, que mira
los ficheros seguidos del árbol de trabajo, no una referencia concreta. Las
rutas con directorios sí respetan `--base`.

## Límites de v1

- Las extensiones de fichero se reconocen por lista blanca. Lo que no está en la
  lista no se detecta — preferible a tratar `rele.pack` o `github.com` como
  ficheros y llenar el reporte de contradicciones falsas.
- Los SHA exigen al menos una letra hexadecimal, para no confundir un commit con
  un número largo.
- Las afirmaciones sobre pull requests necesitan `gh` autenticado. Sin él pasan a
  no comprobables.

## Estructura

```text
plugin/
  .claude-plugin/plugin.json
  fixtures/001-brief-f1-w1.md
  skills/preflight/
    SKILL.md
    scripts/preflight.mjs           <- entrada CLI
    scripts/lib/claims.mjs          <- extracción, puro
    scripts/lib/verify.mjs          <- verificación, git/gh en una función inyectable
    scripts/lib/report.mjs          <- formato de salida, puro
    scripts/lib/preflight.test.mjs
```

`claims.mjs` y `report.mjs` son puros y se testean sin repo ni red. `verify.mjs`
aísla toda ejecución de `git` y `gh` en un único `run` inyectable, así que los
tests corren con un doble y sin tocar disco.

```bash
npm test
```

## Criterio de cierre permanente

**Todo WRITE que toque el plugin sube la versión en `.claude-plugin/plugin.json`
y verifica la caché tras reinstalar.**

La ruta de caché de instalación lleva la versión dentro. Si no se sube, una
reinstalación puede no reemplazar nada y dejar corriendo un build viejo mientras
el repo ya tiene otro. Ningún test lo detecta: los tests corren sobre el repo,
no sobre lo instalado. Un build instalado que diverge del repo es invisible
hasta que alguien se pregunta por qué una corrección no surte efecto.

Después de `claude plugin install`, comprobar cuatro cosas en la caché:

1. La ruta contiene la versión nueva.
2. Los ficheros nuevos del WRITE están ahí.
3. `SKILL.md` de la caché tiene los cambios de este WRITE, no los del anterior.
4. Una corrida real hace lo que el WRITE dice que hace.
