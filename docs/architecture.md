# Arquitectura propuesta

## Estado

Documento de diseño inicial. No hay motor ni adaptadores implementados; el módulo puro de ingesta de evidencias sintéticas sí está implementado.

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

El contrato de evidencia contiene exactamente `source`, `harness`, `session`, `date`, `type` y `result`. Los cuatro identificadores son cadenas no vacías de hasta 1.024 caracteres y se recortan en los extremos; las fechas UTC ISO 8601 válidas admiten hasta nueve dígitos fraccionarios y se canonizan sin perder precisión. `result` acepta valores JSON seguros y finitos, con cadenas de hasta 100.000 caracteres, un máximo agregado de 1.000.000 de caracteres, 100 niveles y 10.000 nodos. Se rechazan propiedades fuera del esquema. `options` debe ser un objeto vacío; el lote procesa todas las posiciones recibidas.

La validación devuelve `{ valid, errors }`; cada error identifica `field` y `message`, sin incluir valores de entrada. La ingesta devuelve `{ accepted, rejected }`. Las entradas aceptadas se agrupan por sus seis campos normalizados, conservando el orden de la primera aparición; cada grupo mantiene `occurrences` y un elemento `provenance` por aparición, con los valores originales validados de `source`, `harness`, `session` y `date`, además del índice del lote. Los arneses distintos permanecen separados. Los rechazos por registro incluyen índice y errores, sin copiar el contenido rechazado. Una entrada de lote u opciones inválidas se devuelve como rechazo de lote con índice `null`.

Esta etapa solo procesa datos sintéticos recibidos como argumento. No crea fixtures, no almacena evidencias y no avanza a extracción de patrones ni a propuestas. La aprobación humana sigue siendo obligatoria para cualquier evaluación futura.
