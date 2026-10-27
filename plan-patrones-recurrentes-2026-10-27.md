---
title: "Plan de Detección de Patrones Recurrentes de Fallos de Ejecución (v4 DRAFT)"
date: 2026-10-27
status: DRAFT
version: v4
idempotency_key: meta-recurrent-plan-20261027-v4
---

# Plan de Detección de Patrones Recurrentes de Fallos de Ejecución (v4 DRAFT)

> **Aviso de Estado:** Este plan tiene estado **v4 DRAFT**. No constituye una aprobación general ni cerrada de planes por parte del usuario; describe la propuesta técnica para la detección de patrones de fallos recurrentes sobre la ingesta de evidencias sintéticas, pendiente de revisión formal por parte del rol Architect y confirmación del usuario. Ningún plan tiene la categoría APPROVED.

---

## 1. Causa y Contexto de la Etapa

Esta especificación corresponde a una nueva etapa de trabajo solicitada por el usuario, orientada a la identificación sistemática de fallos de ejecución que se repiten a lo largo de múltiples sesiones sintéticas.

- **No es una replanificación de objetivos pasados:** La etapa anterior (ingesta fundacional de evidencias sintéticas documentada en `plan-ingesta-evidencias-2026-10-27.md`) fue completada, probada y publicada. La instrucción reciente del usuario prevalece sobre cualquier estado anterior obsoleto registrado en episodios pasados (`session_state` ep5).
- **Aislamiento absoluto:** No se modifica ni se interactúa con instalaciones heredadas de OpenCode ni con datos de producción. El trabajo permanece confinado al repositorio sintético `meta-agent-evolution`.

---

## 2. Objetivo Inmutable

Diseñar e implementar un detector puro, determinista y sin dependencias externas en Node.js 22 que procese el subconjunto normalizado de evidencias aceptadas (`ingestBatch().accepted`) para agrupar, cuantificar y reportar patrones recurrentes de fallos de ejecución entre sesiones independientes.

### Contratos Centrales del Flujo

1. **Fuente de datos:** El detector no recibe entradas crudas sin validar ni procesa registros rechazados por esquema. Su punto de entrada obligatorio es el arreglo `accepted` generado por `ingestBatch()` de `src/evidence.mjs`, preservando la metadata de procedencia (`provenance`) y ocurrencias (`occurrences`).
2. **Definición de fallo de ejecución:** Un fallo de ejecución no es un error de formato de evidencia. Corresponde a un registro formalmente válido (`accepted`) cuyo campo `result` contiene una carga estructurada que documenta la falla de una tarea o comando sintético (por ejemplo, `{ status: "failure" | "error", failureCode: string, failureType: string, message: string }`).
3. **Agrupación y umbral de recurrencia:** Los fallos se agrupan por `harness` y código o tipo de error (`failureCode` o `failureType`). Un grupo califica como patrón recurrente si y solo si sus eventos provienen de al menos `minSessions` sesiones distintas (por defecto `minSessions = 2`, con validación estricta que exige `minSessions >= 2`).
4. **Trazabilidad:** Cada patrón consolidado mantiene referencias directas (`evidenceRefs`) a los registros de evidencia que lo originaron, incluyendo sesión, arnés, fecha y posición en el lote.
5. **Determinismo:** El resultado de la detección se ordena bajo reglas lexicográficas y cuantitativas reproducibles, eliminando cualquier discrepancia de orden entre ejecuciones consecutivas.

---

## 3. Lección Aprendida y Salvaguarda Conceptual

### Lección Registrada

En fases iniciales de planificación se produjo una confusión conceptual al equiparar los registros devueltos en `ingestBatch().rejected` (registros descartados por incumplimiento del esquema sintético de evidencia) con fallos de ejecución de agentes en tiempo de ejecución.

### Salvaguarda Técnica

- **`rejected` (Rechazos de validación):** Indican datos mal formados, campos faltantes, cadenas excesivas o tipos incompatibles con el esquema base de `src/evidence.mjs`. No representan ejecuciones de agentes; son errores de transporte o esquema.
- **`accepted` con `result` fallido (Fallos de ejecución):** Evidencias válidas emitidas por un arnés sintético donde la ejecución del agente o subproceso terminó en estado de fallo. El detector opera exclusivamente sobre estos datos.

---

## 4. Alcance Exacto

### Archivos Nuevos

1. `plan-patrones-recurrentes-2026-10-27.md` (este plan de trabajo).
2. `src/patterns.mjs` (módulo puro con la función de detección `detectRecurrentFailures(acceptedRecords, options)`).
3. `tests/patterns.test.mjs` (suite de pruebas unitarias bajo `node:test` y `node:assert` para el detector de patrones).

### Archivos Existentes a Actualizar

1. `tests/evidence.test.mjs` (incorporación de prueba explícita para validar la desduplicación y persistencia de procedencia en escenarios cross-session con múltiples sesiones sintéticas).
2. `README.md` (documentación de uso de `detectRecurrentFailures`, ejemplos de configuración de umbrales y clarificación de esquemas de `result`).
3. `docs/architecture.md` (inclusión del componente de extracción de patrones sobre la capa de ingesta, documentando el flujo de datos sintéticos y la separación entre validación de esquema y fallos de ejecución).
4. `plan-ingesta-evidencias-2026-10-27.md` (adición de nota aclaratoria puntual sobre la estructura JSON esperada en `result` para evidencias de fallo, sin modificar el código de ingesta ni alterar los compromisos ya completados).

### Archivos de Solo Lectura (Inmutables)

- `src/evidence.mjs` (permanece como lectura exclusiva; sus funciones y contratos ya probados no sufren modificaciones).

### Fuera de Alcance (Invariantes Estrictas)

- Prohibido modificar `package.json` o instalar dependencias de terceros (`dependencies: {}`).
- Prohibida la integración de modelos de lenguaje, API externas o llamadas de red.
- Prohibida la ejecución de tareas asíncronas en segundo plano (background tasks) o demonios de sondeo.
- Prohibido el uso de datos reales, telemetría de producción o credenciales.
- Prohibida la ejecución de `git push` o publicación remota.

---

## 5. Grafo Acíclico Dirigido (DAG) y Tiempos Estimados

El flujo de trabajo es estrictamente acíclico y sigue la secuencia D → A → B → T → R → C → S:

```
[D: Clarificación Previa] ──> [A: Arquitectura y Contratos] ──> [B: Construcción de Módulo] ──> [T: Pruebas Unitarias] ──> [R: Documentación] ──> [C: Conformidad y Criterios] ──> [S: Síntesis y Handoff]
```

### Detalle de Nodos, Dependencias y Presupuesto Temporal

| Nodo  | Nombre                   | Dependencias | Tiempo Máximo | Entregable Principal                                                                                                                                              |
| :---- | :----------------------- | :----------- | :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D** | Clarificación Previa     | Ninguna      | 25 min        | Clarificación del formato JSON de `result` en `docs/architecture.md`, `README.md` y nota en `plan-ingesta-evidencias-2026-10-27.md`.                              |
| **A** | Arquitectura y Contratos | Nodo D       | 40 min        | Especificación técnica formal de la función `detectRecurrentFailures`, reglas de tipado, algoritmo de agrupación y criterios de error para `options.minSessions`. |
| **B** | Construcción             | Nodo A       | 50 min        | Implementación de `src/patterns.mjs` en Node.js 22 puro, sin efectos secundarios ni librerías externas.                                                           |
| **T** | Pruebas Unitarias        | Nodo B       | 45 min        | Implementación de `tests/patterns.test.mjs` (cobertura nominal, límites y errores) y actualización de `tests/evidence.test.mjs` (test cross-session).             |
| **R** | Documentación de Uso     | Nodo T       | 30 min        | Actualización de guías y referencias en `README.md` y `docs/architecture.md` reflejando el nuevo módulo y ejemplos prácticos.                                     |
| **C** | Conformidad de Criterios | Nodo R       | 20 min        | Validación exhaustiva e independiente de los criterios de aceptación 1 al 10 en entorno limpio.                                                                   |
| **S** | Síntesis y Handoff       | Nodo C       | 15 min        | Consolidación del resultado, verificación de SHA y entrega formal a Boss mediante el canal estándar.                                                              |

---

## 6. Criterios de Aceptación (1 al 10)

1. **Entrada Normalizada desde `accepted`:** `detectRecurrentFailures` exige que `acceptedRecords` sea un arreglo (lanzando `TypeError` en caso contrario). Si se suministra `options`, debe ser un objeto plano (`TypeError` si no lo es); `options.minSessions` debe ser un número entero (`TypeError` si no lo es) mayor o igual a 2 (`RangeError` si es menor a 2). Elementos individuales que no sean objetos válidos o no cumplan el contrato de fallo se omiten silenciosamente.
2. **Discriminación Precisa de Fallos de Ejecución:** El módulo examina el objeto `result` de cada evidencia. Se consideran fallos únicamente aquellos registros donde `result` es un objeto con propiedad de estado reconocida como `status: "error"` o `status: "failure"`, ignorando ejecuciones exitosas (`status: "success"` u otros resultados informativos) y valores no admitidos como `"failed"`.
3. **Agrupación Canónica:** Las agrupaciones de fallos se indexan de manera unívoca mediante la clave de identidad `JSON.stringify([harness, code, type ?? ""])` (donde `code` se extrae de `code`/`failureCode` y `type` de `type`/`failureType`/`failure_type`), sin incluir `source` ni `session` en la clave de agrupación.
4. **Métricas Exactas de Frecuencia:** Cada patrón detectado calcula con exactitud las propiedades:
   - `eventCount`: Número de registros de evidencia directos en el lote que coinciden con el patrón.
   - `totalOccurrences`: Sumatoria total de apariciones considerando la propiedad `occurrences` de cada registro aceptado coincidente.
   - `sessionCount`: Número entero de sesiones únicas asociadas al patrón, calculadas a partir del campo `session` de las evidencias y de las entradas contenidas en `provenance`.
   - `sessions`: Arreglo de identificadores únicos de sesión ordenados lexicográficamente.
   - `evidenceRefs`: Arreglo de referencias que preserva el orden de aparición e incluye `acceptedIndex`, `session`, `harness`, `date` y `occurrences`.
5. **Umbral Configurable con Límite Inferior (`minSessions`):** El parámetro `options.minSessions` es opcional y adopta el valor 2 por defecto. La función valida que, de proporcionarse, sea un objeto plano con propiedad de dato entera mayor o igual a 2 (`minSessions >= 2`), lanzando `TypeError` si no es objeto plano o no es entero, o `RangeError` si es menor a 2.
6. **Filtrado por Umbral de Sesiones:** Únicamente se incluyen en la salida de patrones aquellos grupos cuyo valor de `sessionCount` sea mayor o igual al umbral configurado (`sessionCount >= minSessions`).
7. **Trazabilidad de Evidencias (`evidenceRefs`):** Cada patrón reportado contiene un arreglo `evidenceRefs` con referencias verificables a las evidencias que componen el grupo, conteniendo únicamente `{ acceptedIndex, session, harness, date, occurrences }`.
8. **Determinismo Estricto en la Salida:** La lista de patrones devuelta se ordena de forma determinista y reproducible mediante comparación lexicográfica ascendente de `harness`, `code` y `type ?? ""`, con el arreglo interno `sessions` ordenado alfabéticamente.
9. **Inmutabilidad de Módulos Previos:** El archivo `src/evidence.mjs` no experimenta ninguna modificación en su código ni en sus pruebas previas (`tests/evidence.test.mjs` solo incorpora la prueba cross-session requerida sin alterar las existentes).
10. **Ejecución Pura en Node.js 22:** Toda la implementación y las pruebas se ejecutan exclusivamente con el motor nativo de Node.js 22 (`node:test`, `node:assert`, `node:crypto`), manteniendo `package.json` con cero dependencias externas (`"dependencies": {}`).

---

## 7. Registro de Decisiones de Arquitectura (ADR Propuestos - Pendientes de Architect)

### ADR-006: Entrada Exclusiva desde Evidencias Aceptadas

- **Contexto:** Se requiere analizar fallos de ejecución sin duplicar la lógica de validación de esquemas ni procesar registros sintéticos corruptos.
- **Decisión:** El detector de patrones toma como entrada directa el arreglo `accepted` resultante de `ingestBatch()`. Los registros rechazados en la ingesta (`rejected`) quedan excluidos del análisis de patrones por corresponder a errores de esquema y no a fallos de ejecución.
- **Consecuencias:** Se garantiza que toda entrada procesada por el detector ya cuenta con estructura validada, procedencia rastreable y atributos tipados seguros.

### ADR-007: Identificación de Fallos por Carga Estructurada en `result`

- **Contexto:** Las evidencias válidas pueden representar ejecuciones exitosas, informativas o fallidas. Se debe evitar la clasificación arbitraria o heurística de los fallos.
- **Decisión:** Establecer un contrato explícito en el campo `result`. Un registro se clasifica como fallo de ejecución si `result` es un objeto que contiene una propiedad de estado reconocida (`status: "error"` o `status: "failure"`) y al menos un identificador de falla (`code`/`failureCode` o `type`/`failureType`/`failure_type`).
- **Consecuencias:** Se elimina la ambigüedad en la interpretación de resultados y se evita el análisis de texto libre no estructurado.

### ADR-008: Umbral Mínimo Obligatorio de Recurrencia (`minSessions >= 2`)

- **Contexto:** Un evento aislado en una única sesión no constituye un patrón recurrente. Permitir un umbral de 1 sesión desvirtuaría el propósito del detector al capturar incidentes puntuales.
- **Decisión:** Fijar `minSessions = 2` como valor por defecto e imponer una restricción programática que impida valores inferiores a 2 en la configuración.
- **Consecuencias:** El módulo filtra de manera sistemática anomalías aisladas y garantiza que todo patrón reportado refleje una recurrencia inter-sesión comprobada.

### ADR-009: Prohibición de Modelos de Inteligencia Artificial y Procesos en Segundo Plano

- **Contexto:** La extracción de patrones debe ser rápida, determinista, de costo computacional nulo y ejecutable en entornos locales desprovistos de conectividad.
- **Decisión:** La detección se realiza mediante algoritmos tradicionales de agrupamiento y conteo en memoria, sin invocar modelos de lenguaje, ni servicios de red, ni procesos en segundo plano.
- **Consecuencias:** Máxima predictibilidad, ejecución reproducible en milisegundos y compatibilidad total con pipelines de integración local sin costos asociados.

---

## 8. Radio de Impacto (Blast Radius)

- **Creación en esta fase:** Exclusivamente este documento Markdown `plan-patrones-recurrentes-2026-10-27.md` en la raíz del proyecto `meta-agent-evolution`.
- **Fases subsecuentes:** Creación de dos archivos nuevos (`src/patterns.mjs`, `tests/patterns.test.mjs`) y ediciones quirúrgicas limitadas a clarificaciones documentales y adición de un caso de prueba en archivos existentes. Cero impacto en el resto del entorno de trabajo.
