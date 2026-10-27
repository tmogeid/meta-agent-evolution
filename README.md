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

Cada evidencia contiene exactamente `source`, `harness`, `session`, `date`, `type` y `result`. Los cuatro identificadores son cadenas no vacías de hasta 1.024 caracteres y se recortan en los extremos; `date` debe ser una marca UTC ISO 8601 válida con hasta nueve dígitos fraccionarios, canonizada sin perder precisión. `result` admite valores JSON seguros y finitos, con cadenas de hasta 100.000 caracteres, un máximo agregado de 1.000.000 de caracteres, 100 niveles y 10.000 nodos. No se permiten campos adicionales; el lote conserva todas las posiciones recibidas.

`validateEvidence` devuelve `{ valid, errors }`, con errores compuestos por `field` y `message`, sin incluir valores de entrada. `ingestBatch` devuelve `{ accepted, rejected }`: cada entrada aceptada contiene los seis campos normalizados y añade `provenance` (fuente, arnés, sesión, fecha e índice de entrada) y `occurrences`. La procedencia de cada aparición conserva los valores originales validados; las entradas idénticas en los seis campos normalizados se agrupan en su primera posición y acumulan una procedencia por aparición. Un arnés distinto produce un registro separado. Cada rechazo incluye su índice y errores, no el registro rechazado. En esta versión `options` debe ser un objeto vacío.

Los registros sintéticos se proporcionan al módulo como entrada; no hay fixtures ni almacenamiento de evidencias en el repositorio.

## Verificación

Con Node.js 22 o posterior, ejecutar `npm test`. El workflow de CI ejecuta esa misma prueba en Windows, Ubuntu y macOS.

## Límites

La aprobación humana es obligatoria antes de evaluar propuestas. Este repositorio no ejecuta agentes, no modifica otros proyectos y no hereda código ni historial de trabajos anteriores.
