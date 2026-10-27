---
title: "Plan de Propuestas Estructuradas desde Patrones Recurrentes (v6 DRAFT)"
date: 2026-10-27
status: DRAFT
version: v6
idempotency_key: meta-proposals-v6-doc-20261027
supersedes: plan-propuestas-revision-2026-10-27.md (v5 DRAFT)
---

# Plan de Propuestas Estructuradas desde Patrones Recurrentes (v6 DRAFT)

> **Aviso de Estado:** Este plan tiene estado **v6 DRAFT** y sustituye formalmente a la versión v5 sin sobreescribirla ni alterarla. No constituye aprobación. Ningún plan de este repositorio tiene categoría APPROVED. La acción de revisión descrita aquí (aprobar/rechazar) solo cambia un campo de estado en un objeto nuevo en memoria; no aplica cambios, no ejecuta nada, no toca archivos ni configuración externa. La aprobación humana en la API del módulo representa una acción explícita dentro del flujo y no constituye prueba ni certificación de autenticación externa de usuario (integraciones futuras quedan fuera de este alcance).

---

## 1. Causa del Relevo v6 y Delta Aprobado por el Usuario

### 1.1 Causa del relevo (v5:94-95, 140)

En el plan previo (v5, líneas 94-95 y criterio de aceptación 2 en línea 140), el contrato de propuesta exigía la copia directa de `sessions` (identificadores crudos de sesión) y de `evidenceRefs` conteniendo campos potencialmente sensibles o no saneados (como identificadores de sesión crudos, marcas de tiempo o arnés de fuentes no confiables). Esto presentaba riesgo de exposición de información personal o interna (PII) procedente del arnés y de fechas no confiables.

### 1.2 Delta aprobado por el usuario

1. **Sin identificadores crudos de sesión:** Se elimina el campo crudo `sessions` del objeto de propuesta. La propuesta conserva únicamente los agregados numéricos y conteos: `sessionCount`, `eventCount` y `totalOccurrences`.
2. **Referencias seguras y posicionales únicamente:** En lugar de replicar texto o IDs de sesión directos, las referencias a evidencias se limitan a referencias seguras posicionales (por ejemplo `{ acceptedIndex, occurrences }` u orden ordinal).
3. **Delegación técnica al Architect (CÓMO):** El plan no declara ejemplos con arnés o fechas sin procesar como automáticamente seguros ni realiza copias ciegas. Corresponde al rol Architect definir en su ADR el esquema técnico exacto de referencias seguras (`safe references`) para garantizar que no se filtre PII ni datos de fuentes no confiables.
4. **Clarificación conceptual de aprobación:** La acción de revisión humana en la interfaz del módulo es una invocación explícita sobre el estado de la propuesta; no valida identidad ni asume esquemas externos de autenticación de usuario.

---

## 2. Objetivo Inmutable

Construir un módulo puro, determinista y sin dependencias en Node.js 22 que convierta los patrones devueltos por `detectRecurrentFailures` (etapa v4) en propuestas estructuradas revisables por humanos, con id estable, campos copiados del patrón (harness/code/type, conteos numéricos `sessionCount`/`eventCount`/`totalOccurrences`, referencias posicionales seguras de evidencia), diagnóstico estrictamente factual, estado explícito pendiente/aprobada/rechazada, origen registrado y destino tipado extensible (agente/promesa de prompt/skill futura) sin contenido de corrección inventado y sin efectos sobre archivos o configuración.

Datos de trabajo: solo sintéticos. Pruebas locales con `node --test`. Documentación actualizada en el mismo cambio. Commit local, sin push.

---

## 3. Alcance Exacto

### Archivos nuevos

1. `plan-propuestas-revision-2026-10-27-v6.md` (este documento, raíz del proyecto, versión v6 DRAFT).
2. `src/proposals.mjs` (módulo puro: construir propuestas + acción de revisión).
3. `tests/proposals.test.mjs` (suite bajo `node:test` y `node:assert`, solo datos sintéticos).

### Archivos existentes alcanzados

1. `README.md` (añadir sección de propuestas: flujo datos → patrones → propuesta → aprobación humana → evaluación; la aprobación no se presume).
2. `docs/architecture.md` (registrar el módulo de propuestas como implementado cuando el código exista; hasta entonces este plan es la única fuente).

### Solo lectura (no modificar)

- `plan-propuestas-revision-2026-10-27.md` (artefacto v5 DRAFT previo, inmutable).
- `src/evidence.mjs` (`validateEvidence`, `ingestBatch`, contrato de 6 campos, `provenance`, `occurrences`).
- `src/patterns.mjs` (`detectRecurrentFailures`, agrupación por `JSON.stringify([harness, code, type ?? ""])`, `minSessions >= 2`, `evidenceRefs` con `acceptedIndex/session/harness/date/occurrences`, sesiones ordenadas).
- `tests/evidence.test.mjs`, `tests/patterns.test.mjs`, `tests/smoke.test.mjs`, `package.json` (motor `node >= 22`, script `test`), planes `plan-ingesta-evidencias-2026-10-27.md` y `plan-patrones-recurrentes-2026-10-27.md`.

### Prohibido en esta etapa

- Inferencia de modelo, llamadas a proveedores, datos reales o secretos, dependencias npm.
- Exposición de identificadores crudos de sesión o textos no saneados en propuestas.
- Reclamos o suposiciones sobre autenticación externa de usuarios.
- Contenido de corrección inventado (el módulo no propone parches, textos de prompt ni código de skill; solo reserva el campo tipado de destino).
- Efectos de filesystem o configuración desde el módulo o sus pruebas.
- Replanificar etapas cerradas (ingesta v3, patrones v4).

---

## 4. Subtareas y DAG

Orden obligatorio: `D → A → B → T → R → C → S`. Cada fase cierra antes de abrir la siguiente. Las letras son identificadores de fase de la delegación; su contenido se define abajo.

| Fase | Contenido                                                                                                          | Cierre                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| D    | Definir el contrato de propuesta (sección 5 de este plan) sin escribir código, adaptado al delta de privacidad v6. | Contrato escrito y validado contra `src/patterns.mjs` leído. |
| A    | Andamiaje de `src/proposals.mjs` con las funciones de contrato y revisión.                                         | Archivo creado, sin E/S, sin dependencias.                   |
| B    | Base de `tests/proposals.test.mjs`: casos sintéticos de construcción válida sin IDs crudos.                        | Casos verdes en local con `node --test`.                     |
| T    | Casos negativos, verificación de privacidad (ausencia de sesiones crudas) y ausencia de efectos.                   | Todos los criterios de aceptación 1–10 verificados.          |
| R    | Actualizar `README.md` y `docs/architecture.md` desde el código leído, sin deriva docs-código.                     | Documentación leída antes de editar; ejemplos verificados.   |
| C    | Commit local del conjunto (código + pruebas + docs + este plan v6). Sin push.                                      | Commit creado en la máquina local.                           |
| S    | Síntesis: ruta del artefacto v6 y hash si disponible, reporte de cierre.                                           | Reporte entregado a la orquestación.                         |

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

## 5. Contrato de Propuesta v6 (QUÉ; el CÓMO queda pendiente según sección 6)

### 5.1 Entrada

Arreglo de patrones tal como los devuelve `detectRecurrentFailures`: objetos con `harness`, `code`, `type`, `eventCount`, `totalOccurrences`, `sessionCount`, `sessions` (ordenadas), `evidenceRefs`. El módulo no acepta evidencias crudas ni registros rechazados. Elementos que no cumplan el contrato de patrón se omiten sin lanzar. Entrada no arreglo → `TypeError`.

### 5.2 Salida: objeto propuesta v6

Cada propuesta contiene exactamente:

- `id`: identificador estable y determinista derivado de la identidad del patrón (`harness`, `code`, `type`). Misma identidad → mismo `id` en cualquier ejecución. Sin marcas de tiempo, sin aleatoriedad, sin contadores globales.
- `harness`, `code`, `type`: copiados del patrón, sin reinterpretar.
- `eventCount`, `totalOccurrences`, `sessionCount`: conteos numéricos agregados del patrón.
- **Sin campo `sessions`:** Queda excluido todo arreglo o cadena de identificadores de sesión crudos.
- `evidenceRefs`: colección de referencias seguras posicionales (p. ej. `{ acceptedIndex, occurrences }` o posición ordinal en lote), desprovistas de identificadores crudos de sesión y sin volcado directo de campos no confiables.
- `diagnosis`: texto factual construido únicamente con los agregados del patrón (`harness`, código/tipo, conteo de eventos y conteo de sesiones). Sin atribución causal, sin severidad inferida, sin texto prescriptivo.
- `status`: uno de `pending` | `approved` | `rejected`. Toda propuesta nace `pending`.
- `origin`: `{ source: "detectRecurrentFailures", patternKey: "<clave canónica del patrón>" }`.
- `target`: `{ kind: "agent" | "prompt" | "skill", detail: null }`. En esta etapa `detail` siempre es `null`: se reserva la estructura para extensibilidad sin generar contenido artificial.

### 5.3 Acción de revisión

Función pura que recibe una propuesta y una acción (`approve` | `reject`) y devuelve un nuevo objeto con `status` actualizado. No muta la propuesta original. No ejecuta acciones subordinadas, no escribe en disco ni red, no altera configuraciones y no asume autenticación externa de usuario.

### 5.4 Pureza

Sin E/S, sin acceso a `fs`, `process.env`, red ni temporizadores. Determinismo absoluto.

---

## 6. Aspectos Técnicos Pendientes (CÓMO — decide Architect, no este plan)

> Las siguientes cuestiones quedan reservadas para decisión del rol Architect en su ADR correspondiente:

1. Algoritmo exacto del `id` determinista (normalización y función hash/clave sobre `[harness, code, type]`).
2. Esquema exacto de `safe references` en `evidenceRefs` para vincular posicionalmente las evidencias sin exponer identificadores de sesión ni confiar ciegamente en fechas o metadatos de fuentes no saneadas.
3. Formato y canonización de `patternKey` dentro del objeto `origin`.
4. Estructura interna mínima del resultado retornado por la función de revisión (metadatos del cambio de estado sin persistencia externa).
5. Estructura futura de `target.detail` según cada `kind` (fuera del alcance v6).

---

## 7. Decisiones Registradas y Lecciones

### 7.1 Decisiones

- **[DECISION] Aprobación de usuario para privacidad v6:**
  - **Título:** Exclusión de sesiones crudas y uso de referencias posicionales seguras.
  - **Contexto:** v5 incluía `sessions` y copias directas de referencias de evidencias con posibles identificadores internos y fechas no confiables.
  - **Opciones consideradas:** (A) Mantener sesiones crudas y campos directos; (B) Hashear IDs de sesión; (C) Preservar solo conteos agregados (`sessionCount`, etc.) y referencias posicionales seguras.
  - **Decisión:** Opción C. Se eliminan IDs crudos de sesión y se emplean únicamente conteos y referencias posicionales seguras delegando al Architect el diseño del esquema seguro.
  - **Racional:** Garantiza privacidad estricta (anti-PII), respeta el modelo puramente factual y evita propagar datos de fuentes no verificadas.
  - **Consecuencias:** No hay exposición de sesiones en propuestas. Las referencias son puramente posicionales.
  - **Confianza:** Alta.
- **Clarificación de Aprobación Humana:** La acción de aprobación/rechazo en la API del módulo es una operación formal de transición de estado en memoria; no constituye mecanismo ni prueba de autenticación de usuario.
- **Decisiones v5 conservadas:** Determinismo de ID (DEC-PROP-01), diagnóstico factual sin inferencia causal (DEC-PROP-02), revisión funcional sin efectos colaterales (DEC-PROP-03), destino tipado con detalle nulo (DEC-PROP-04) y restricción estricta de entorno sin llamadas a modelos ni push (DEC-PROP-05).

### 7.2 Lecciones aprendidas

- **Lección v4 (deriva docs-código):** Toda documentación debe generarse tras leer e inspeccionar el código real y las suites existentes, marcando como `[UNVERIFIED]` lo que no esté soportado por código ejecutable.
- **Lección v5 (exposición de sesiones y campos no saneados):** Replicar estructuras de bajo nivel directamente en capas superiores introduce filtración de identificadores de sesión y dependencias de campos externos no verificados. El diseño debe basarse en agregados seguros y referencias posicionales abstractas.
- **Lección de completitud de respuesta:** Proceder de manera directa a la generación del artefacto completo sin truncamientos ni suspensiones intermedias de estado.

---

## 8. Criterios de Aceptación v6 (1–10)

1. **Artefacto:** Existe el archivo `plan-propuestas-revision-2026-10-27-v6.md` en la raíz del proyecto, completo, en estado DRAFT, coexistiendo con `plan-propuestas-revision-2026-10-27.md` sin haberlo modificado ni sobreescrito.
2. **Construcción válida y delta de privacidad:** Con patrones sintéticos válidos, el módulo devuelve una propuesta por patrón con los campos de 5.2, `status: "pending"`, conteos agregados `sessionCount`, `eventCount`, `totalOccurrences`, referencias posicionales seguras en `evidenceRefs` y **sin campo `sessions` ni IDs crudos**.
3. **Id determinista:** Dos llamadas idénticas producen el mismo `id`; entradas con distinta tupla `[harness, code, type]` producen `id` diferente.
4. **Casos negativos:** Entrada no arreglo → `TypeError`; patrones malformados se omiten sin lanzar excepciones; objetos no estándar no corrompen el flujo.
5. **Diagnóstico factual:** El campo `diagnosis` refleja únicamente cifras y campos del patrón, sin formular hipótesis causales ni recomendaciones de corrección.
6. **Revisión explícita sin efectos:** `approve` produce un objeto clonado con `status: "approved"`; `reject` produce copia con `status: "rejected"`; la propuesta original permanece intacta en `pending`; cero operaciones de E/S o mutación.
7. **Origen y destino tipado:** Propuestas contienen `origin.source === "detectRecurrentFailures"` y `target.kind` válido (`agent` | `prompt` | `skill`) con `target.detail === null`.
8. **Privacidad integral:** Ninguna prueba ni fixture utiliza datos reales, rutas personales o llamadas externas. Todos los datos son sintéticos.
9. **Ausencia de efectos colaterales:** Verificación de inmutabilidad en argumentos de entrada y ausencia de creación o alteración de archivos durante la ejecución del módulo.
10. **Trazabilidad y verificación documental:** Documentación consistente con la implementación, verificación con `node --test` y registro en commit local sin push.

---

## 9. Reglas de Parada, Privacidad y Cierre

- **STOP:** Si `src/evidence.mjs`, `src/patterns.mjs`, las pruebas existentes, `package.json` o los planes previos no están disponibles, el trabajo se detiene y se reporta la evidencia inmediatamente. Prohibido sustituir o inventar contenido.
- **Inmutabilidad de versiones previas:** `plan-propuestas-revision-2026-10-27.md` (v5) se mantiene intacto como registro histórico de decisiones de diseño.
- **Cierre:** Commit local que agrupe código, pruebas, actualización documental y este plan v6. Sin push. Reporte final con ruta del artefacto generado y hash si disponible.

---

## 10. Blasto y Trazabilidad

- **BLAST RADIUS:** Exclusivamente Markdown para este artefacto (`plan-propuestas-revision-2026-10-27-v6.md`). En fases subsiguientes abarcará `src/proposals.mjs`, `tests/proposals.test.mjs`, `README.md` y `docs/architecture.md`. Ningún otro componente del repositorio se modifica.
- **Trazabilidad:** Patrón → propuesta (`origin.patternKey`) → `evidenceRefs` seguras (`acceptedIndex`, posición ordinal) → evidencia aceptada en lote. La cadena de auditoría permanece íntegra sin exponer datos privados de sesión.
