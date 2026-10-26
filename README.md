# Meta Agent Evolution

Repositorio independiente para documentar la evolución futura de agentes. Esta versión inicial contiene solo documentación y una prueba de humo; no implementa el motor ni adaptadores ejecutables.

## Alcance inicial

- OpenCode se considera el primer adaptador futuro.
- El motor se diseñará como componente independiente de los adaptadores.
- Los adaptadores futuros de memoria y arneses se mantienen como conceptos, no como código presente.
- El flujo documentado es: datos sintéticos → patrones → propuesta estructurada → aprobación humana → evaluación.
- Cualquier etapa Meta posterior queda condicionada a autorización explícita del modelo, las credenciales y el presupuesto.

No se usan datos reales, servicios externos, dependencias npm ni API pagas. El plan v2 ubicado fuera de este subdirectorio permanece como borrador y no forma parte de este repositorio.

## Verificación

Con Node.js 22 o posterior, ejecutar `npm test`. El workflow de CI ejecuta esa misma prueba en Windows, Ubuntu y macOS.

## Límites

La aprobación humana es obligatoria antes de evaluar propuestas. Este repositorio no ejecuta agentes, no modifica otros proyectos y no hereda código ni historial de trabajos anteriores.
