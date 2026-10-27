# Meta Agent Evolution

Repositorio independiente para documentar la evolución futura de agentes. Incluye un módulo puro para ingesta de evidencias sintéticas; no implementa el motor ni adaptadores ejecutables.

## Alcance inicial

- OpenCode se considera el primer adaptador futuro.
- El motor se diseñará como componente independiente de los adaptadores.
- Los adaptadores futuros de memoria y arneses se mantienen como conceptos, no como código presente.
- El flujo documentado es: datos sintéticos → patrones → propuesta estructurada → aprobación humana → evaluación.
- Cualquier etapa Meta posterior queda condicionada a autorización explícita del modelo, las credenciales y el presupuesto.

No se usan datos reales, servicios externos, dependencias npm ni API pagas. El plan v2 ubicado fuera de este subdirectorio permanece como borrador y no forma parte de este repositorio.

## Ingesta de evidencias sintéticas

`src/evidence.mjs` exporta `validateEvidence(record)` e `ingestBatch(records, options)`. El módulo es puro, usa solo Node.js/JavaScript estándar y no conecta con servicios, bases de datos ni agentes.

Cada evidencia contiene exactamente `source`, `harness`, `session`, `date`, `type` y `result`. Los cuatro identificadores son cadenas no vacías de hasta 1.024 caracteres y se recortan en los extremos; `date` debe ser una marca UTC ISO 8601 válida con hasta nueve dígitos fraccionarios, canonizada sin perder precisión.

`result` admite solo valores JSON seguros y finitos: cadenas, números finitos, booleanos, `null`, arreglos y objetos planos, sin ciclos. Las cadenas admiten hasta 100.000 caracteres cada una, con un máximo agregado de 1.000.000 de caracteres, 100 niveles y 10.000 nodos. No se permiten campos adicionales; el lote conserva todas las posiciones recibidas.

`validateEvidence` devuelve `{ valid, errors }`, con errores compuestos por `field` y `message`, sin incluir valores de entrada. `ingestBatch` devuelve `{ accepted, rejected }`: cada entrada aceptada contiene los seis campos normalizados y añade `provenance` (fuente, arnés, sesión, fecha e índice de entrada) y `occurrences`.

La procedencia de cada aparición conserva los valores originales validados; las entradas idénticas en los seis campos normalizados se agrupan en su primera posición y acumulan una procedencia por aparición. Un arnés distinto produce un registro separado. Cada rechazo incluye su índice y errores, no el registro rechazado. En esta versión `options` debe ser un objeto vacío.

### Detector de fallos recurrentes

`src/patterns.mjs` exporta `detectRecurrentFailures(acceptedRecords, options = {})`. Recibe exclusivamente el arreglo `accepted` de `ingestBatch`; no consume `rejected` ni sus errores.

`acceptedRecords` debe ser un arreglo. `options` debe ser un objeto no nulo ni arreglo; `minSessions` es un entero de al menos 2 y su valor predeterminado es 2. Una entrada no-array u opciones inválidas producen `TypeError`; un `minSessions` no entero también produce `TypeError`, y un entero menor que 2 produce `RangeError`.

Solo se consideran elementos con `harness`, `session` y `date` válidos y un `result` que sea objeto plano JSON seguro, finito y acíclico. El estado debe ser exactamente `error` o `failure`.

Entre `code` y `failureCode`, cero alias string no vacíos significa que no hay fallo; un solo valor normalizado o valores iguales identifican el código; valores distintos omiten el elemento. Para `type`, `failureType` y `failure_type`, cero alias válidos produce `null`, valores iguales producen el tipo y valores distintos omiten el elemento. Los alias string se recortan; no se combinan fallos ambiguos. Los elementos malformados se omiten sin copiar ni incluir su contenido en errores.

La agrupación usa `JSON.stringify([harness, code, type ?? ""])` y el resultado se ordena por `harness`, `code` y `type`. Cada patrón contiene `{ harness, code, type, eventCount, totalOccurrences, sessionCount, sessions, evidenceRefs }`.

`eventCount` cuenta elementos aceptados únicos del grupo; `totalOccurrences` suma `occurrences` cuando es un entero seguro positivo y usa 1 en otro caso. `sessions` es la unión ordenada de la sesión del registro y de `provenance[].session`.

Cada referencia, en orden de índice aceptado, contiene únicamente `{ acceptedIndex, session, harness, date, occurrences }`. Se devuelven solo grupos con al menos `minSessions` sesiones distintas. El detector no devuelve `source`, `result` ni otros datos arbitrarios.

Los registros sintéticos se proporcionan al módulo como entrada; no hay fixtures ni almacenamiento de evidencias en el repositorio.

## Verificación

Con Node.js 22 o posterior, ejecutar `npm test`. El workflow de CI ejecuta esa misma prueba en Windows, Ubuntu y macOS.

## Límites

La aprobación humana es obligatoria antes de evaluar propuestas. Este repositorio no ejecuta agentes, no modifica otros proyectos y no hereda código ni historial de trabajos anteriores.

## Propuestas revisables implementadas

`src/proposals.mjs` exporta `buildProposals(patterns, options)` y `reviewProposal(proposal, action)`. La construcción requiere `options.targetKind` explícito (`agent`, `prompt` o `skill`); no elige un destino por omisión. El identificador estable usa SHA-256 sobre `JSON.stringify([harness, code, type ?? ""])`.

Las propuestas incluyen conteos agregados, referencias limitadas a `{ acceptedIndex, occurrences }`, diagnóstico factual, origen del detector y estado inicial `pending`. No copian sesiones ni otros campos de las referencias de entrada. `harness` y `code`, y `type` cuando no es `null`, aceptan únicamente letras ASCII, dígitos, punto, guion y guion bajo, con longitud de 1 a 128 caracteres. Esta allowlist no demuestra que un valor esté libre de PII; no se deben suministrar datos personales.

`reviewProposal` acepta `approve` o `reject` solo para propuestas `pending` y devuelve un clon con el nuevo estado. No valida identidad o autenticación externa, no persiste cambios y no ejecuta acciones sobre archivos, configuración, agentes o red. El plan v6 relacionado permanece en estado DRAFT.
