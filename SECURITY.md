# Seguridad

## Cómo informar de un fallo

Si encuentras un fallo de seguridad en la app, **no abras un issue público**. Usa
[Report a vulnerability](../../security/advisories/new) en la pestaña *Security* del repositorio (aviso privado de
GitHub) con:

- qué versión de la app y de Windows usas;
- qué pasos lo reproducen;
- qué puede conseguir alguien con él.

Se responde en cuanto sea posible y se te avisa cuando haya una versión con la corrección.

## Qué cubre

La app de escritorio (código de `src/` y `src-tauri/`), su instalador y el proceso de actualización. El modelo de
seguridad (CSP, capabilities, comandos propios, firma de las actualizaciones) está en
[docs/arquitectura.md](docs/arquitectura.md).

## Versiones con soporte

Solo la última versión publicada: las actualizaciones automáticas llevan a ella.
