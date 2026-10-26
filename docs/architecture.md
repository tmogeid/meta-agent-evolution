# Arquitectura propuesta

## Estado

Documento de diseño inicial. No hay motor, adaptadores ni funciones centrales implementados.

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
