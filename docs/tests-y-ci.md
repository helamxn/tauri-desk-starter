# Pruebas y CI

| Comando | Cobertura |
| --- | --- |
| `pnpm lint` | ESLint con tipos y reglas de React. |
| `pnpm build` | Proyectos TypeScript y bundle de producción. |
| `pnpm test` | Navegación, errores (y que el log no guarda su mensaje), tema, persistencia, ajustes, bandeja, updater (también que no busca solo en desarrollo), mostrar la ventana al pintar y los botones de la ventana (acciones, maximizado, orden de Tab, zona de Snap Layouts y su hover). |
| `pnpm test:scripts` | Identidad, versión única, mitades de Tauri (en los locks), lock de skills, reglas de la CSP y de la capability (y que coinciden con arquitectura.md), comandos, workflows y Dependabot. |
| `pnpm test:rust` | Ciclo de vida, qué entra en el log, filtro del menú contextual, validación y posición de la zona de Snap Layouts y ajuste a la pantalla de la ventana. |
| `pnpm test:e2e` | La build de producción (`vite preview`) con la CSP de `tauri.conf.json`, en Chromium con el contenido de la ventana mínima (464×351) y a 1600×900: navegación, ajustes, axe, scroll horizontal, ninguna violación de CSP y bloqueo de hosts externos. |
| `pnpm audit --audit-level high` | Árbol npm completo. |
| `cargo audit --file src-tauri/Cargo.lock` | Avisos de RustSec. |

La CI corre en cada PR y push a main, y el workflow de release la ejecuta sobre el commit que publica. El job frontend ejecuta auditoría, lint, compilación y tests JS. Rust usa Windows, rustfmt, clippy (en debug y en release, que compila el código que solo existe en la versión distribuida) y cargo audit y, en cada push a main, compila la app real con el perfil release y el instalador NSIS (sin los archivos del updater). E2E instala Chromium y ejecuta Playwright. Las acciones están fijadas a commits y los checkouts omiten las credenciales persistentes.

La validación nativa (una compilación release con otro `identifier`) incluye los permisos, que F5, Ctrl+R y el zoom no hagan nada, que el botón derecho solo abra menú en los campos de texto (con cortar, copiar, pegar y el corrector, y sin «Import passwords»), el orden de Tab, el menú de Snap Layouts y el hover al pasar por el botón de maximizar (al 100 % y a otra escala), que el clic maximice y restaure, que el arranque no muestre un destello claro con el tema Dark, el tamaño mínimo arrastrando el borde, la segunda instancia, la bandeja, instalar y desinstalar con y sin la casilla y una actualización entre dos versiones ([release.md](release.md#probar-una-actualización-en-local)). Para inspeccionar la app real: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<puerto>` y CDP; el código que ejecuta CDP no está sujeto a la CSP (para probar `eval`, lánzalo desde la página). La firma en Actions y la entrega desde GitHub Releases requieren el repositorio y las claves de la app. Registra por separado qué pruebas llegaron a ejecutarse.
