---
title: "ADR-001: Contrato de detección de fallos recurrentes"
last_updated: 2026-10-27
status: Proposed
idempotency_key: meta-pattern-adr-v4
---

# ADR-001: Contrato de detección de fallos recurrentes

**Estado:** Proposed (DRAFT; no aprobado).

## Contexto

El detector propuesto analiza únicamente `accepted`, el arreglo de evidencias aceptadas por `ingestBatch()`. Los registros `rejected` representan errores de ingesta y no deben convertirse en fallos de ejecución. El plan asociado permanece en estado DRAFT; esta decisión no lo aprueba.

## Decisión

Definir un detector puro `detectRecurrentFailures` que reciba las evidencias aceptadas y opciones explícitas, y devuelva resultados de fallo recurrente. Clasificar como fallo solo cuando `result` sea un objeto con `status` igual a `error` o `failure`, y contenga un código no vacío en `code` o `failureCode`. Para el tipo, aceptar `type`, `failureType` o `failure_type`.

Agrupar por harness, código y tipo. Para contar recurrencia, considerar sesiones distintas; la procedencia de las evidencias no sustituye la identidad de sesión. `minSessions` tiene valor predeterminado 2. Excluir registros sin la estructura requerida, entradas rechazadas y errores de validación: no inferir fallos a partir de campos arbitrarios. No incluir PII en grupos ni resultados.

## Consecuencias

- El contrato explícito reduce falsos positivos frente a inferir fallos desde campos libres, aunque omite fallos registrados en formatos no reconocidos.
- Mantener el detector puro facilita resultados deterministas y pruebas aisladas.
- Agrupar por harness, código y tipo separa causas distintas; exigir sesiones distintas evita que varias evidencias de una sesión aparenten recurrencia.
- El umbral predeterminado evita clasificar un fallo aislado como recurrente.
- Una alternativa más estricta exigiría exclusivamente `status: "failure"`, `failureCode` y `failureType`. La opción elegida acepta alias explícitos (`error`, `code` y `failure_type`) a cambio de un contrato de entrada algo más amplio.
- No se integrará este detector en la hoja de ruta de Meta ahora; esa integración queda para una decisión posterior.
