# Meta Agent Evolution

Repositorio independiente para experimentar con la evolución futura de agentes a partir de evidencia sintética. Implementa 4 etapas en ESM puro (Node.js 22+, sin dependencias): ingesta, detección de patrones, propuestas revisables y adaptador Meta desacoplado. No incluye motor evolutivo ni adaptadores ejecutables contra sistemas reales.

## Qué es

- Entrada exclusivamente sintética; sin datos reales, sin PII y sin red por defecto.
- Módulos en `src/`: `evidence.mjs`, `patterns.mjs`, `proposals.mjs`, `meta-adapter.mjs`.
- Demo integral en `examples/meta-synthetic.mjs` con cliente simulado en memoria.
- Diseño en `docs/architecture.md`; decisiones en `docs/adr-001-recurrent-failure-contract.md` y `docs/adr-003-omniroute-muse-spark-open.md`.
- Procedencia en `docs/prior-work.md` y `docs/attributions.md`.

## Las 4 etapas implementadas

1. **Ingesta (`src/evidence.mjs`)** — `validateEvidence(record)` e `ingestBatch(records, options)`. Cada evidencia contiene exactamente `source`, `harness`, `session`, `date`, `type` y `result`, con identificadores recortados y fecha UTC ISO 8601 canonizada. `result` admite solo JSON seguro, finito y acíclico, con límites de tamaño, profundidad y nodos. Sin campos adicionales.
2. **Detección (`src/patterns.mjs`)** — `detectRecurrentFailures(acceptedRecords, options)`. Agrupa fallos con igual arnés, código y tipo en dos o más sesiones distintas. Solo acepta `status` igual a `error` o `failure`; omite registros ambiguos o malformados sin copiar su contenido.
3. **Propuestas (`src/proposals.mjs`)** — `buildProposals(patterns, options)` y `reviewProposal(proposal, action)`. Exige `targetKind` explícito (`agent`, `prompt` o `skill`). Cada propuesta nace `pending` con identificador estable SHA-256 y referencias mínimas. Solo admite `approve` o `reject` humanos; prohíbe la autoaprobación.
4. **Adaptador Meta (`src/meta-adapter.mjs`)** — `createMetaAdapter(config)` desacoplado y configurable vía OmniRoute. Transforma patrón y hechos observados en consulta estructurada, valida la respuesta con esquema local estricto y exige biyección de identificadores de evidencia.

## Instalación y verificación

Requiere Node.js 22 o posterior. Sin dependencias externas.

```sh
npm test
```

El workflow de CI ejecuta la misma prueba en Windows, Ubuntu y macOS.

## Demo sintética

```sh
node examples/meta-synthetic.mjs
```

La demo ingiere dos evidencias sintéticas (fallo `E_TIMEOUT` en `node-test`, sesiones distintas), detecta el patrón recurrente, construye una propuesta `pending` y la resuelve con una recomendación simulada en memoria. No realiza tráfico de red.

## Configuración OmniRoute

Valores por omisión de `createMetaAdapter(config)`:

- **Endpoint:** `http://127.0.0.1:20129/v1` (solo `127.0.0.1`, `localhost` o `[::1]`; rechaza hosts externos).
- **Modelo:** `baseten/meta-models/muse-spark-open-1026`.
- **Modo seguro:** `offline: true` y `enabled: false` por omisión; sin llamadas de red salvo activación explícita.
- **Credenciales:** `OMNIROUTE_API_KEY` leída solo desde `process.env`. Nunca en archivos ni en el repositorio. La plantilla `.env.example` la deja vacía.
- **Variables (ver `.env.example`):** `OMNIROUTE_BASE_URL`, `OMNIROUTE_MODEL`, `OMNIROUTE_API_KEY`.
- **Límites:** `OMNIROUTE_MAX_REQUESTS` (1 por ciclo), `OMNIROUTE_MAX_OUTPUT_TOKENS` (512), `OMNIROUTE_MAX_INPUT_CHARACTERS` (16000), `OMNIROUTE_MAX_RESPONSE_BYTES` (256000).
- **Presupuesto opcional:** `OMNIROUTE_MAX_COST`, `OMNIROUTE_INPUT_COST_PER_MILLION`, `OMNIROUTE_OUTPUT_COST_PER_MILLION`. El exceso aborta antes de emitir.

## Qué NO está implementado

- Inferencia real contra un endpoint: el opt-in en vivo está desactivado. Toda ejecución real queda pendiente de autorización explícita de modelo, credenciales y presupuesto.
- Motor evolutivo independiente: solo diseño futuro, no implementado.
- Adaptador OpenCode ejecutable y adaptadores de memoria o arneses: conceptos futuros, no código presente.
- Autoaprobación programática: prohibida. Sin aprobación humana no hay evaluación ni ejecución.

## Nuevo frente a trabajos previos

Este repositorio no importa código, archivos, dependencias ni historial de otros trabajos. Las notas de procedencia son solo referencia y no otorgan permiso de copia. Ver `docs/prior-work.md` y `docs/attributions.md` antes de proponer cualquier transferencia futura.

## Límites

- Aprobación humana obligatoria antes de evaluar propuestas.
- Los módulos puros no realizan E/S, no usan red y no modifican otros proyectos.
- No suministrar datos personales; la lista de identificadores admitidos no acredita ausencia de PII.
