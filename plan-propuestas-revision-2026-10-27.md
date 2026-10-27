---
title: "Plan de Propuestas Estructuradas desde Patrones Recurrentes (v5 DRAFT)"
date: 2026-10-27
status: DRAFT
version: v5
idempotency_key: meta-proposals-plan-v5-20261027
---

# Plan de Propuestas Estructuradas desde Patrones Recurrentes (v5 DRAFT)

> **Aviso de Estado:** Este plan tiene estado **v5 DRAFT**. No constituye aprobación. Ningún plan de este repositorio tiene categoría APPROVED. La acción de revisión descrita aquí (aprobar/rechazar) solo cambia un campo de estado en un objeto nuevo; no aplica cambios, no ejecuta nada, no toca archivos ni configuración.

---

## 1. Objetivo Inmutable

Construir un módulo puro, determinista y sin dependencias en Node.js 22 que convierta los patrones devueltos por `detectRecurrentFailures` (etapa v4) en propuestas estructuradas revisables por humanos, con id estable, campos copiados del patrón (harness/code/type, conteos, sesiones, refs de evidencia), diagnóstico estrictamente factual, estado explícito pendiente/aprobada/rechazada, origen registrado y destino tipado extensible (agente/promesa de prompt/skill futura) sin contenido de corrección inventado y sin efectos sobre archivos o configuración.

Datos de trabajo: solo sintéticos. Pruebas locales con `node --test`. Documentación actualizada en el mismo cambio. Commit local, sin push.

---

## 2. Alcance Exacto

### Archivos nuevos

1. `plan-propuestas-revision-2026-10-27.md` (este documento, raíz del proyecto).
2. `src/proposals.mjs` (módulo puro: construir propuestas + acción de revisión).
3. `tests/proposals.test.mjs` (suite bajo `node:test` y `node:assert`, solo datos sintéticos).

### Archivos existentes alcanzados

1. `README.md` (añadir sección de propuestas: flujo datos → patrones → propuesta → aprobación humana → evaluación; la aprobación no se presume).
2. `docs/architecture.md` (registrar el módulo de propuestas como implementado cuando el código exista; hasta entonces este plan es la única fuente).

### Solo lectura (no modificar)

- `src/evidence.mjs` (`validateEvidence`, `ingestBatch`, contrato de 6 campos, `provenance`, `occurrences`).
- `src/patterns.mjs` (`detectRecurrentFailures`, agrupación por `JSON.stringify([harness, code, type ?? ""])`, `minSessions >= 2`, `evidenceRefs` con `acceptedIndex/session/harness/date/occurrences`, sesiones ordenadas).
- `tests/evidence.test.mjs`, `tests/patterns.test.mjs`, `tests/smoke.test.mjs`, `package.json` (motor `node >= 22`, script `test`), planes `plan-ingesta-evidencias-2026-10-27.md` y `plan-patrones-recurrentes-2026-10-27.md`.

### Prohibido en esta etapa

- Inferencia de modelo, llamadas a proveedores, datos reales o secretos, dependencias npm.
- Contenido de corrección inventado (el módulo no propone parches, textos de prompt ni código de skill; solo reserva el campo tipado de destino).
- Efectos de filesystem o configuración desde el módulo o sus pruebas.
- Replanificar etapas cerradas (ingesta v3, patrones v4): este plan es etapa nueva, no replanificación.

---

## 3. Subtareas y DAG

Orden obligatorio: `D → A → B → T → R → C → S`. Cada fase cierra antes de abrir la siguiente. Las letras son identificadores de fase de la delegación; su contenido se define abajo.

| Fase | Contenido                                                                                      | Cierre                                                       |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| D    | Definir el contrato de propuesta (sección 4 de este plan) sin escribir código.                 | Contrato escrito y revisado contra `src/patterns.mjs` leído. |
| A    | Andamiaje de `src/proposals.mjs` con las dos funciones de la sección 4.                        | Archivo creado, sin E/S, sin dependencias.                   |
| B    | Base de `tests/proposals.test.mjs`: casos sintéticos de construcción válida.                   | Casos verdes en local.                                       |
| T    | Casos negativos, privacidad y ausencia de efectos (sección 7).                                 | Todos los criterios 1–10 verificados.                        |
| R    | Actualizar `README.md` y `docs/architecture.md` desde el código leído, sin deriva docs-código. | Docs leídas antes de editar; ejemplos verificados.           |
| C    | Commit local del conjunto (código + pruebas + docs + este plan). Sin push.                     | Commit creado en la máquina local.                           |
| S    | Síntesis: ruta del artefacto y hash si disponible, reporte de cierre.                          | Reporte entregado.                                           |

### Presupuestos de tiempo

| Fase      | Presupuesto |
| --------- | ----------- |
| D         | 20 min      |
| A         | 40 min      |
| B         | 30 min      |
| T         | 40 min      |
| R         | 30 min      |
| C         | 15 min      |
| S         | 15 min      |
| **Total** | **190 min** |

Si una fase agota su presupuesto sin cerrar, se detiene y se reporta; no se recorta verificación para compensar.

---

## 4. Contrato de Propuesta (QUÉ; el CÓMO queda pendiente según sección 5)

### 4.1 Entrada

Arreglo de patrones tal como los devuelve `detectRecurrentFailures`: objetos con `harness`, `code`, `type`, `eventCount`, `totalOccurrences`, `sessionCount`, `sessions` (ordenadas), `evidenceRefs`. El módulo no acepta evidencias crudas ni registros rechazados. Elementos que no cumplan el contrato de patrón se omiten sin lanzar. Entrada no arreglo → `TypeError`.

### 4.2 Salida: objeto propuesta

Cada propuesta contiene exactamente:

- `id`: identificador estable y determinista derivado de la identidad del patrón (`harness`, `code`, `type`). Misma entrada → mismo `id` en cualquier ejecución. Sin marcas de tiempo, sin aleatoriedad, sin contadores globales.
- `harness`, `code`, `type`: copiados del patrón, sin reinterpretar.
- `eventCount`, `totalOccurrences`, `sessionCount`, `sessions`: copiados del patrón.
- `evidenceRefs`: copia de las referencias del patrón (sesión, arnés, fecha, posición en lote, ocurrencias).
- `diagnosis`: texto factual construido solo con los campos del patrón (qué arnés, qué código/tipo, cuántos eventos, en cuántas sesiones). Sin atribución de causa, sin severidad inferida, sin recomendación.
- `status`: uno de `pending` | `approved` | `rejected`. Toda propuesta nace `pending`.
- `origin`: `{ source: "detectRecurrentFailures", patternKey: "<clave canónica del patrón>" }`.
- `target`: `{ kind: "agent" | "prompt" | "skill" }` más campo `detail: null` reservado. En v5 `detail` siempre es `null`: el tipo existe para extensión futura, el contenido no se inventa.

### 4.3 Acción de revisión

Función separada que recibe una propuesta y una acción (`approve` | `reject`) y devuelve un objeto nuevo con `status` actualizado. No muta la entrada. No ejecuta, no escribe archivos, no cambia configuración, no dispara evaluación. La evaluación queda detenida hasta aprobación humana explícita fuera de este módulo.

### 4.4 Pureza

Sin E/S, sin `fs`/`process`/`env`, sin reloj, sin aleatoriedad, sin red, sin dependencias. No congela la entrada del llamante pero tampoco la muta; trabaja sobre copias.

---

## 5. Aspectos Técnicos Pendientes (CÓMO — decide Architect, no este plan)

> Las siguientes cuestiones quedan sujetas a decisión del rol Architect en su ADR. Este plan fija restricciones, no soluciones.

1. Algoritmo exacto del `id` estable (canonización y función de derivación sobre `[harness, code, type]`).
2. **Lección registrada:** un resultado previo de planificación incluyó un campo especulativo `createdAt` en la propuesta, lo que rompe la estabilidad del `id` y el determinismo entre ejecuciones. `createdAt` queda marcado como CÓMO pendiente de Architect; por defecto prohibido en v5 salvo decisión explícita con justificación de determinismo.
3. Forma exacta de `patternKey` dentro de `origin` (reutilizar la clave canónica de agrupación u otra derivación aprobada).
4. Formato del registro de acción de revisión (campos mínimos de la acción además del nuevo estado).
5. Contenido futuro de `target.detail` por cada `kind` (fuera de v5; solo se reserva el tipo).

---

## 6. Decisiones y ADRs

Propuestos en este plan, ninguno aprobado:

- **DEC-PROP-01 (id determinista):** el `id` deriva solo de la identidad del patrón; prohibidos tiempo, azar y estado global. Origen: lección del `createdAt` especulativo.
- **DEC-PROP-02 (diagnóstico factual):** `diagnosis` solo reformula campos del patrón; prohibida la inferencia de causa. Origen: salvaguarda conceptual v4 (no confundir niveles de evidencia).
- **DEC-PROP-03 (revisión sin efectos):** aprobar/rechazar solo cambia `status` en un objeto nuevo. Origen: flujo previsto (la aprobación no se presume ni se automatiza).
- **DEC-PROP-04 (destino tipado vacío):** `target.kind` obligatorio, `target.detail` siempre `null` en v5. Origen: extensibilidad futura sin inventar correcciones.
- **DEC-PROP-05 (sin modelo, sin datos reales, sin push):** sin llamadas a modelos, sin datos reales o secretos, commit local sin push. Origen: restricciones de arquitectura y alcance.

ADRs existentes que aplican: ADR-001 de aislamiento (código formulado desde cero) y salvaguarda v4 (fallo de ejecución ≠ registro rechazado).

---

## 7. Criterios de Aceptación (1–10)

1. **Artefacto:** existe `plan-propuestas-revision-2026-10-27.md` en la raíz del proyecto, completo y en estado DRAFT.
2. **Construcción válida:** con patrones sintéticos de al menos 2 sesiones, el módulo devuelve una propuesta por patrón con todos los campos de 4.2 y `status: "pending"`.
3. **Id estable:** dos construcciones con la misma entrada devuelven el mismo `id`; entradas con distinta identidad devuelven distinto `id`.
4. **Casos negativos:** entrada no arreglo → `TypeError`; opciones no objeto plano → `TypeError`; elementos inválidos se omiten sin lanzar; `detail` distinto de `null` en entrada se rechaza o normaliza según decida Architect (documentado en pruebas).
5. **Diagnóstico factual:** `diagnosis` contiene solo valores presentes en el patrón; prueba que rechaza texto con causa inventada.
6. **Revisión explícita:** `approve` → copia con `status: "approved"`; `reject` → copia con `status: "rejected"`; la entrada original conserva `pending`; ninguna acción ejecuta ni escribe.
7. **Origen y destino:** toda propuesta trae `origin.source === "detectRecurrentFailures"` con su clave, y `target.kind` válido con `detail: null`.
8. **Privacidad:** ninguna prueba usa datos reales, secretos, rutas de usuario ni red; todo el fixture es sintético y autocontenido.
9. **Sin efectos:** las pruebas verifican que la entrada no fue mutada y que no se creó ni modificó ningún archivo fuera del reporte de `node --test`.
10. **Docs y cierre:** `README.md` y `docs/architecture.md` describen el módulo desde el código leído (sin deriva), las pruebas corren en Node 22 con `npm test`, y el conjunto queda en commit local sin push.

---

## 8. Reglas de Parada, Privacidad y Cierre

- **STOP:** si `src/evidence.mjs`, `src/patterns.mjs`, las pruebas existentes, `package.json` o los planes previos no están disponibles, el trabajo se detiene y se reporta la evidencia. Sin sustitutos ni reconstrucción desde memoria.
- **Deriva docs-código:** antes de editar `README.md` o `docs/architecture.md`, leer el código real y el archivo a editar; cada afirmación debe corresponder a símbolos y firmas verificados. Lo no verificable se marca `[UNVERIFIED]`; no se inventa.
- **Cierre:** commit local con código + pruebas + docs + este plan. Sin push. Reporte final con ruta del artefacto y hash si disponible.

---

## 9. Blasto y Trazabilidad

- **BLAST RADIUS:** solo Markdown (este plan; luego `README.md`, `docs/architecture.md`) más los dos archivos nuevos de la etapa (`src/proposals.mjs`, `tests/proposals.test.mjs`). Ningún otro archivo del árbol se toca.
- **Trazabilidad:** patrón → propuesta (`origin.patternKey`) → `evidenceRefs` → `acceptedIndex` del lote → `provenance` con `batchIndex`. Cadena completa de lote a propuesta sin rupturas.
