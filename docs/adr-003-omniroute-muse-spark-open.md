---
title: "ADR-003: Integración de cliente OmniRoute con baseten/meta-models/muse-spark-open-1026"
last_updated: 2026-10-27
status: Accepted
idempotency_key: adr-003-20261027
---

# ADR-003: Integración de cliente OmniRoute con baseten/meta-models/muse-spark-open-1026

**Estado:** Accepted (Diseño de arquitecto `ses_e8089e380ffeMDcUxZAunC8yMl`).

## Contexto

El sistema de evolución de meta-agentes requiere un cliente para interactuar con modelos de lenguaje locales mediante OmniRoute. Se definió como modelo base `baseten/meta-models/muse-spark-open-1026`, expuesto en el endpoint local `http://127.0.0.1:20129/v1`.

Se identificaron las siguientes condiciones operativas y de seguridad:

1. El upstream no garantiza la aplicación estricta de JSON Schema nativo en las respuestas del modelo.
2. Las credenciales no deben persistirse en archivos de configuración ni en el código fuente.
3. El usuario prohíbe explícitamente cualquier mecanismo de aprobación automática de propuestas generadas, tanto en ejecución normal como en scripts de demostración.
4. Se requiere una arquitectura desacoplada y determinista que admita pruebas unitarias sin dependencias externas ni llamadas reales de red.

## Opciones consideradas

- **Opción 1: Cliente acoplado a SDK externo con autoaprobación en demostración.**
  Integrar el SDK oficial de OpenAI configurando `baseURL` local y ejecutar en la demo un flujo que llame a `approve()` automáticamente para mostrar el ciclo completo.
  _Rechazada:_ Introduce dependencias externas innecesarias, presupone soporte de schema que el upstream no garantiza y vulnera la política de supervisión que prohíbe la aprobación automática.

- **Opción 2: Factoría ESM con inyección de fetch, validación local y revisión humana sin autoaprobación.**
  Implementar una factoría ESM con `fetch` inyectable, autenticación exclusiva por variable de entorno, validación de esquema en proceso local bajo política fail-closed, y retención de propuestas en estado `pending` para revisión manual obligatoria.
  _Aceptada:_ Garantiza aislamiento, verificabilidad en pruebas aisladas, seguridad de credenciales y control humano obligatorio.

## Decisión

1. **Patrón de diseño y factoría ESM:**
   - Implementar el cliente mediante una factoría ESM pura que admita dependencias opcionales (`fetch`, `baseUrl`, `model`, `apiKey`).
   - Permitir la inyección de `fetch` para ejecutar pruebas unitarias deterministas sin sockets reales ni servidores HTTP activos.

2. **Configuración y autenticación:**
   - Endpoint base predeterminado: `http://127.0.0.1:20129/v1` (configurable por opciones de factoría).
   - Modelo predeterminado: `baseten/meta-models/muse-spark-open-1026` (configurable por opciones de factoría).
   - Clave de autenticación: obtenida exclusivamente de la variable de entorno `OMNIROUTE_API_KEY`. Si la variable no está definida y no se suministra en las opciones, el cliente adopta comportamiento fail-closed e interrumpe la operación sin emitir peticiones.

3. **Manejo de esquema y validación local (Fail-Closed):**
   - El cliente no depende de que el upstream aplique JSON Schema estructurado.
   - El mensaje del sistema solicita salida JSON, y la respuesta se valida localmente contra el esquema esperado.
   - Si la respuesta no es un JSON parseable o no satisface la estructura requerida, se descarta bajo la política fail-closed.

4. **Flujo de supervisión humana (Sin autoaprobación):**
   - Toda propuesta generada por el cliente se almacena exclusivamente en estado `pending`.
   - Las demostraciones y ejemplos presentan la propuesta pendiente y muestran las instrucciones de inspección manual.
   - Queda prohibido invocar `approve()` de forma automatizada o programada en cualquier script de prueba o demo.

5. **Restricción de inferencia y despliegue:**
   - Sin llamadas de inferencia no autorizadas y sin operaciones de push automático a repositorios o entornos externos.

## Consecuencias

### Positivas

- **Aislamiento y testabilidad:** La inyección de `fetch` facilita pruebas unitarias completas sin requerir GPU ni conexión de red activa.
- **Seguridad de credenciales:** Ningún secreto se expone en código ni en artefactos versionados; el acceso se limita a `OMNIROUTE_API_KEY`.
- **Integridad de datos:** La validación local protege los componentes receptores de salidas truncadas o fuera de especificación.
- **Control humano estricto:** El estado `pending` obligatorio previene mutaciones autónomas no verificadas por un operador.

### Negativas y limitaciones técnicas

- **Sobrecarga de validación local:** El cliente debe ejecutar la validación estructural por cuenta propia en cada llamada.
- **Intervención manual necesaria:** Las validaciones de extremo a extremo que demanden una propuesta aprobada requieren la acción explícita de un operador humano.

## Restricciones

- Prohibido hardcodear claves, rutas absolutas rígidas o tokens en código o documentación.
- No incorporar librerías HTTP externas; emplear la API `fetch` estándar inyectable.
- En scripts de demostración, la ejecución debe concluir dejando la propuesta en estado `pending` y exhibiendo los datos para revisión manual, sin invocar `approve()`.
