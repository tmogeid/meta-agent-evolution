# Arquitectura propuesta

## Estado

Documento de diseño inicial. No hay motor ni adaptadores implementados; están implementados los módulos puros de ingesta de evidencias sintéticas y detección de fallos recurrentes.

## Componentes futuros

- **Motor independiente:** alojaría la lógica de evolución y no dependería de OpenCode.
- **Adaptador OpenCode:** primer adaptador previsto; todavía no implementado.
- **Adaptadores de memoria y arneses:** extensiones futuras, también no implementadas.

## Flujo previsto

1. Generar o recibir únicamente datos sintéticos.
2. Extraer patrones de esas entradas.
3. Formular una propuesta estructurada.
4. Detener el flujo hasta obtener aprobación humana explícita.
5. Evaluar la propuesta aprobada con criterios documentados.

La aprobación no se presume ni se automatiza. Sin ella, la evaluación no continúa.

## Etapa Meta

La evolución Meta queda fuera del alcance inicial. Solo podrá considerarse cuando estén autorizados explícitamente el modelo, las credenciales y el presupuesto. No se configura proveedor ni se realizan llamadas a modelos en este repositorio.

## Restricciones

- No incorporar datos reales o secretos.
- No copiar código, archivos ni historial de otros trabajos.
- Mantener separadas la documentación de arquitectura y cualquier implementación futura.

## Ingesta de evidencias implementada

El módulo puro `src/evidence.mjs` exporta `validateEvidence(record)` e `ingestBatch(records, options)`. No realiza E/S ni depende de servicios, bases de datos, adaptadores o proveedores de modelos.

El contrato de evidencia contiene exactamente `source`, `harness`, `session`, `date`, `type` y `result`. Los cuatro identificadores son cadenas no vacías de hasta 1.024 caracteres y se recortan en los extremos; las fechas UTC ISO 8601 válidas admiten hasta nueve dígitos fraccionarios y se canonizan sin perder precisión.

`result` admite valores JSON seguros y finitos: cadenas, números finitos, booleanos, `null`, arreglos y objetos planos acíclicos. Las cadenas tienen un máximo de 100.000 caracteres cada una, 1.000.000 en total, 100 niveles y 10.000 nodos. Se rechazan propiedades fuera del esquema. `options` debe ser un objeto vacío; el lote procesa todas las posiciones recibidas.

La validación devuelve `{ valid, errors }`; cada error identifica `field` y `message`, sin incluir valores de entrada. La ingesta devuelve `{ accepted, rejected }`.

Las entradas aceptadas se agrupan por sus seis campos normalizados, conservando el orden de la primera aparición; cada grupo mantiene `occurrences` y un elemento `provenance` por aparición, con los valores originales validados de `source`, `harness`, `session` y `date`, además del índice del lote. Los arneses distintos permanecen separados.

Los rechazos por registro incluyen índice y errores, sin copiar el contenido rechazado. Una entrada de lote u opciones inválidas se devuelve como rechazo de lote con índice `null`.

Esta etapa procesa datos sintéticos recibidos como argumento. No crea fixtures ni almacena evidencias. La detección de patrones no formula propuestas ni realiza evaluaciones; la aprobación humana sigue siendo obligatoria para cualquier evaluación futura.

## Detector de fallos recurrentes implementado

El módulo puro `src/patterns.mjs` exporta `detectRecurrentFailures(acceptedRecords, options = {})`. No importa `src/evidence.mjs`, no realiza E/S y no depende de servicios ni proveedores. Solo recibe `accepted` de `ingestBatch`; nunca analiza `rejected` ni sus errores.

El detector considera registros con `harness`, `session` y `date` válidos y un `result` que sea objeto plano JSON seguro, finito y acíclico. `result.status` debe ser exactamente `error` o `failure`.

Para el código, `code` y `failureCode` solo aportan valores si son strings no vacíos tras `trim`: ningún valor significa que no hay fallo y el registro se omite; un único valor o valores iguales dan el código, y valores distintos omiten el registro.

Para el tipo, `type`, `failureType` y `failure_type` usan la misma regla; si no hay valor, el tipo es `null`. No se copian ni se devuelven propiedades arbitrarias de `result`.

`acceptedRecords` debe ser un arreglo. `options` debe ser un objeto no nulo ni arreglo; `minSessions` debe ser un entero ≥ 2 (predeterminado 2). Un arreglo u opciones inválidos producen `TypeError`; un `minSessions` no entero también produce `TypeError`, y un entero menor que 2 produce `RangeError`. Los elementos malformados se omiten sin incluir sus valores en errores.

La clave de grupo es `JSON.stringify([harness, code, type ?? ""])`; el orden de salida es ascendente por `harness`, `code` y `type`. Cada resultado tiene `{ harness, code, type, eventCount, totalOccurrences, sessionCount, sessions, evidenceRefs }`.

`eventCount` cuenta entradas aceptadas del grupo; `totalOccurrences` suma `occurrences` si es un entero seguro positivo y usa 1 en caso contrario. `sessions` es la unión ordenada de `session` y `provenance[].session`. `evidenceRefs` mantiene el orden de los índices aceptados; cada referencia contiene solo `{ acceptedIndex, session, harness, date, occurrences }`. Solo se devuelven grupos con al menos `minSessions` sesiones distintas.

## Propuestas revisables implementadas

`src/proposals.mjs` exporta `buildProposals(patterns, options)` y `reviewProposal(proposal, action)`. `buildProposals` requiere `options.targetKind` igual a `agent`, `prompt` o `skill`. Omite patrones que no cumplen el contrato y solo copia campos permitidos. La propuesta no contiene sesiones; de cada referencia solo conserva `acceptedIndex` y `occurrences`. También excluye `session`, `harness` y `date` de las referencias, pero conserva el campo superior `harness` del patrón.

`harness` y `code`, y `type` cuando no es `null`, deben cumplir `^[A-Za-z0-9._-]{1,128}$`. Este filtro limita el formato, pero no demuestra que el valor esté libre de PII. Los conteos deben ser enteros seguros positivos.

El ID determinista es `prop-sha256-` seguido de SHA-256 de `JSON.stringify([harness, code, type ?? ""])`. `origin` registra `detectRecurrentFailures` y esa clave canónica. `diagnosis` contiene únicamente `eventCount`, `totalOccurrences` y `sessionCount`, sin atribuir causas o proponer correcciones.

Las propuestas nacen con `status: "pending"` y un destino `{ kind, detail: null }`, donde `kind` lo indica explícitamente quien las construye. `reviewProposal` solo acepta `approve` o `reject` para una propuesta pendiente válida y devuelve un clon con el nuevo estado. La revisión no autentica al usuario, no persiste, no altera la entrada ni realiza E/S, llamadas de red o acciones en agentes/configuración. El plan v6 relacionado conserva su estado DRAFT.
