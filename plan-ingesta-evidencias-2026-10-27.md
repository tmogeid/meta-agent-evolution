---
title: "Plan de Ingesta de Evidencias Sintéticas (v3 DRAFT)"
date: 2026-10-27
status: DRAFT
version: v3
idempotency_key: meta-ingest-plan-20261027-v3
---

# Plan de Ingesta de Evidencias Sintéticas (v3 DRAFT)

> **Aviso de Estado:** Este plan tiene estado **v3 DRAFT**. No constituye una aprobación general ni cerrada de planes por parte del usuario; describe la primera característica funcional concreta del repositorio conforme a los requisitos técnicos establecidos.

---

## 1. Objetivo Inmutable

Diseñar e implementar el módulo fundacional de ingesta de evidencias sintéticas en Node.js 22 sin dependencias externas (`dependencies: {}`), con soporte para validación exhaustiva de esquemas genéricos, procesamiento por lotes sintéticos, desduplicación con preservación de procedencia original y trazabilidad local de pruebas.

### Atributos Centrales de Evidencia

Cada registro de evidencia procesado debe satisfacer el contrato canónico:

- `source`: Fuente o emisor del evento.
- `harness`: Identificador del arnés de ejecución sintético.
- `session`: Identificador de sesión.
- `date`: Marca temporal ISO 8601 UTC válida.
- `type`: Categoría tipada del evento.
- `result`: Estructura o valor de resultado del evento.

---

## 2. Alcance Exacto

### Archivos Nuevos

1. `plan-ingesta-evidencias-2026-10-27.md` (este documento).
2. `src/evidence.mjs` (módulo puro con funciones de validación, procesamiento de lotes y desduplicación).
3. `tests/evidence.test.mjs` (suite de pruebas unitarias bajo `node:test` y `node:assert`).

### Archivos Existentes a Actualizar

1. `README.md` (documentación de uso de la ingesta de evidencias sintéticas y comandos de verificación).
2. `docs/architecture.md` (especificación del subsistema de ingesta de evidencias como primer componente funcional del motor sintético).

### Fuera de Alcance (Invariantes Estrictas)

- No modificar `package.json` ni añadir dependencias npm externas.
- No modificar `tests/smoke.test.mjs` salvo que el rol Architect determine un requerimiento formal bloqueante vía `STATUS: NEEDS-INPUT`.
- Prohibida la reutilización o copia de código legado, sesiones reales de OpenCode, bases de datos o memoria de producción.
- No invocar modelos de lenguaje, ni configurar llamadas de red, ni introducir heurísticas probabilísticas o sistemas de recomendación en esta fase.
- No realizar `git push`. La finalización implica únicamente commits locales estructurados.

---

## 3. Grafo Acíclico Dirigido (DAG) y Tiempos Estimados

El flujo de trabajo es estrictamente secuencial y acíclico:

```
[D1: Planificación y Docs] ──> [A1: Arquitectura y Diseño] ──> [B1: Construcción] ──> [T1: Pruebas] ──> [R1: Revisión] ──> [C1: Commit Local] ──> [S1: Resumen y Cierre]
```

### Detalle de Etapas y Presupuesto Temporal

| Etapa  | Rol                  | Tiempo Máximo | Entregable Principal                                                                                |
| ------ | -------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| **D1** | Documentation        | 30 min        | Artefacto de plan `plan-ingesta-evidencias-2026-10-27.md` redactado y verificado.                   |
| **A1** | Architect            | 1 h           | ADR y especificación técnica de contratos: funciones exportadas, esquema y regla de desduplicación. |
| **B1** | Builder              | 2 h           | Implementación completa y pura en `src/evidence.mjs`.                                               |
| **T1** | Tester               | 1 h           | Suite de pruebas en `tests/evidence.test.mjs` ejecutada exitosamente con `npm test`.                |
| **R1** | Reviewer             | 30 min        | Verificación estricta de calidad, ausencia de slop y conformidad con reglas del proyecto.           |
| **C1** | Builder / DevOps     | 15 min        | Commit Git local en rama de trabajo sin push remoto.                                                |
| **S1** | Documentation / Boss | 15 min        | Resumen final consolidado y actualización de estado.                                                |

---

## 4. Criterios de Aceptación por Etapa

### D1: Documentación del Plan

- Creación aislada de `plan-ingesta-evidencias-2026-10-27.md` sin efectos colaterales en otros archivos.
- Definición completa de roles, DAG acíclico, criterios de aceptación y decisiones arquitectónicas asociadas.
- Declaración explícita de estado `v3 DRAFT`.

### A1: Arquitectura y Diseño

- Definición de firmas formales en `src/evidence.mjs` (ej. `validateEvidence(record)`, `ingestBatch(records, options)`).
- Determinación formal de la clave de desduplicación (propuesta: hash SHA-256 o tupla normalizada `source+harness+session+date+type`) y del modelo de preservación de procedencia (mantener primera aparición o lista de orígenes).
- Especificación de categorización de errores de validación sin lanzar excepciones no controladas.

### B1: Construcción

- Código en JavaScript estándar ESM (`.mjs`) compatible exclusivamente con Node.js 22+.
- Cero dependencias añadidas en `package.json`.
- Funciones deterministas y puras para validación, ingestión por lote y desduplicación.

### T1: Pruebas Unitarias

- Suite basada en el ejecutor nativo `node:test` (`npm test`).
- Cobertura de casos:
  1. Registros válidos sintéticos.
  2. Registros con campos faltantes, tipos incorrectos o fechas ISO inválidas (errores de validación estructurados).
  3. Desduplicación de eventos idénticos preservando trazabilidad de procedencia original.
  4. Lotes sintéticos heterogéneos y eventos cruzados entre arneses (`cross-harness`).
- Todas las pruebas deben pasar con código de salida 0.

### R1: Revisión y Auditoría

- Inspección de código: ausencia de llamadas a red, APIs de terceros o módulos bloqueantes.
- Verificación anti-slop y cumplimiento de lineamientos de codificación limpia.
- Confirmación de no-regresión en `tests/smoke.test.mjs`.

### C1: Commit Local

- Metadatos de Git limpios y descriptivos (ej. `feat(evidence): implement synthetic evidence ingestion module`).
- Ninguna operación de publicación o empuje remoto (`git push` estrictamente prohibido).

### S1: Resumen y Cierre

- Notificación formal al orquestador con estatus de ejecución, evidencias y hash de artefactos producidos.

---

## 5. Aspectos Técnicos Propuestos (Propuesta Técnica HOW - Pendiente de Decisión de A1)

> **Nota:** Las siguientes propuestas técnicas corresponden al "CÓMO" y quedan sujetas a la decisión final del rol **Architect (A1)** en su respectivo ADR. No requieren escalamiento al usuario salvo ambigüedad intrínseca irresoluble.

### 5.1. Validación de Esquema

Se propone que `validateEvidence(entry)` retorne una estructura descriptiva:

```javascript
{
  valid: boolean,
  errors: Array<{ field: string, message: string }>
}
```

Campos validados:

- `source`: cadena no vacía.
- `harness`: cadena no vacía.
- `session`: cadena no vacía.
- `date`: cadena con formato ISO 8601 parseable y coherente (`new Date(date).toISOString() === date` o expresión regular equivalente).
- `type`: cadena identificadora del tipo de evento.
- `result`: valor definido (objeto, número, booleano o cadena).

### 5.2. Desduplicación y Procedencia

Para el manejo de eventos duplicados:

- Se propone calcular una clave canónica basada en los campos canónicos del registro.
- En caso de colisión de clave dentro de un lote o flujo de ingesta, el procesador retiene el primer registro detectado e incorpora en sus metadatos de procedencia (`provenance`) la referencia del duplicado observado (por ejemplo, índice original, arnés de recepción o contador de ocurrencias).

---

## 6. Registro de Decisiones Asociadas (ADRs Previos y Restricciones)

- **ADR-001 (Aislamiento de Código):** Prohibido reutilizar código o esquemas de proyectos anteriores; la implementación se formula desde cero para garantizar un diseño limpio y neutral.
- **ADR-002 (Cero Datos Reales):** No se procesan sesiones reales de OpenCode ni datos procedentes del entorno operativo. Todo lote de prueba debe ser estrictamente sintético.
- **ADR-003 (Entorno Node.js Puro):** Uso exclusivo de APIs nativas de Node.js 22 (`crypto`, `test`, `assert`). No se añaden paquetes a `node_modules`.
- **ADR-004 (Persistencia y Publicación):** Todo avance se consolida mediante commits locales. Prohibido ejecutar `git push` o configurar remotos de publicación automáticos.
- **ADR-005 (Causa de Replanificación):** La actualización a v3 DRAFT responde exclusivamente a la introducción formal de la primera funcionalidad técnica (ingesta de evidencias) en sustitución del estado documental preliminar.
