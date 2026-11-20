# Trabajar en tauri-desk-starter

Reglas para cualquier agente (Claude, Codex…) que trabaje en una app creada desde esta plantilla: una app de escritorio
para Windows x64 con Tauri 2. Cada app puede adaptarlas en su copia; las decisiones y sus motivos están en
`docs/decisiones.md`.

## 1. Proyecto

- **Stack:** Tauri 2 (Rust), React, TypeScript estricto, Vite, Tailwind, shadcn (`base-nova` sobre Base UI), iconos
  `lucide-react`, TanStack Router y zod.
- **Idioma:** la interfaz y los identificadores del código, en inglés. Comentarios, documentación y este archivo, en
  castellano.
- **Solo `pnpm`** (`pnpm add`, `pnpm exec shadcn …`, `pnpm tauri …`), el toolchain de Rust fijado en
  `rust-toolchain.toml` (lo sube Dependabot) y los locks del proyecto. Nunca `npm`, `npx`, `yarn` ni `bun`.
- **Puerto:** el de `build.devUrl` en `src-tauri/tauri.conf.json` (1420). Si está ocupado, no se cambia: se avisa y se
  pregunta.
- **Siempre la última versión estable** (en Node, la última LTS; nada de alfa, beta, RC ni *nightly*). Antes de añadir o
  actualizar: `pnpm view <paquete> version`, `pnpm add <paquete>@latest`, `cargo search <crate> --limit 1`; al terminar,
  `pnpm outdated`, `cargo update` y `rustup check`. Si la última no es compatible con otra pieza, se usa la última
  compatible y se anota en `docs/decisiones.md` con el issue. Las dos mitades de Tauri (npm y crates.io), con `tauri`,
  `@tauri-apps/api` y `@tauri-apps/cli`, van en la misma versión menor (lo comprueba `pnpm test:scripts`).

## 2. UI y shadcn

- `src/components/ui/` no se modifica a mano: se añade con la CLI del proyecto y se compone o envuelve fuera (como
  `src/components/vertical-tabs.tsx`).
- Estilos por defecto: `variant` y `size`. `className` solo para layout, nunca para color, tipografía o apariencia.
- **Sin tooltips:** la información, visible. Los botones de solo icono llevan `aria-label`.
- Todo se prueba en el mínimo de la ventana (480×360; su contenido real, 464×351) y en uno amplio; container queries
  (`@container`) cuando depende de su contenedor.
- Diálogos con trabajo del usuario: `disablePointerDismissal`; si cerrar descarta trabajo, se confirma con
  `AlertDialog`.
- Base UI no es Radix: `render` en vez de `asChild`, `toast` en vez de `sonner`. Antes de construir UI propia,
  `pnpm exec shadcn search @shadcn -q "<necesidad>"` y `pnpm exec shadcn docs <componente>`, y la skill `shadcn`.

## 3. Textos de la interfaz

- Para quien usa la app: nada de mecanismos internos (ni bytes, ni comandos, ni nombres de archivos).
- Una descripción solo si aporta algo que el título no dice, y como mucho una frase.
- Errores: «Couldn't …» y qué hacer («Couldn't save. Try again.»).
- Voz directa, sin «we» ni el nombre de la app como sujeto; «…» de un carácter; un término por concepto.

## 4. Seguridad

- CSP de `tauri.conf.json` sin hosts externos; lo que viene de la red se pide desde Rust.
- Capabilities con los permisos sueltos que se usan. Cada comando propio se declara en `build.rs` (denegado por
  defecto) y solo una capability lo concede.
- Rust valida todo lo que llega por IPC (forma y tamaño); el frontend nunca es la defensa.
- Nada secreto en `localStorage`, en la interfaz ni en los logs. La plantilla no trae almacén de secretos: si una app
  lo necesita, va en Rust y se justifica en el PR.
- Un permiso, capability, host de la CSP o comando nuevo se justifica en el PR.

## 5. Datos guardados

Las claves llevan versión (`preferences:v1`, `theme:v1`). Un cambio incompatible crea `:v2`, migra al arrancar lo
que haya en `:v1` (con su test) y después borra `:v1`; uno compatible no cambia de versión. Los datos de una versión
futura se conservan sin tocarlos.

## 6. Tests

Obligatorios en seguridad (IPC, capabilities, CSP), en la lógica crítica y en lo que cambia a menudo. Un cambio no
está terminado hasta que pasan `pnpm lint`, `pnpm build` y las pruebas de su área.

| Comando | Qué cubre |
| --- | --- |
| `pnpm test` | Componentes y lógica (Vitest + jsdom) |
| `pnpm test:scripts` | Coherencia del proyecto: identidad, versiones, skills, CSP, capabilities, workflows y Dependabot |
| `pnpm test:rust` | Ciclo de vida, log, menú contextual, Snap Layouts y geometría de la ventana |
| `pnpm test:e2e` | La build de producción en el navegador, con la CSP de la app, en la ventana mínima y a 1600×900, con axe y sin scroll horizontal |

Más detalle, y lo que se prueba a mano en Windows: `docs/tests-y-ci.md`. Antes de una versión: `docs/release.md`.

## 7. Skills

En `.agents/skills/`, fijadas en `skills-lock.json`; `pnpm test:scripts` comprueba que coinciden.

| Tarea | Skill |
| --- | --- |
| Componentes, formularios y estilos | `shadcn` |
| Interfaz accesible y adaptable | `frontend-ui-engineering` |
| Desarrollo guiado por tests (también bugs) | `test-driven-development` |
| Causa de un fallo | `debugging-and-error-recovery` |
| Aclarar qué pide el usuario | `interview-me` |
| Revisar un plan | `doubt-driven-development` |
| Revisar un cambio | `code-review-and-quality` |
| Simplificar | `code-simplification` |
| Rendimiento | `performance-optimization` |
| Seguridad | `security-and-hardening` |
| CI y release | `ci-cd-and-automation` |
| Commits, ramas y versiones | `git-workflow-and-versioning` |
| Cambios por pasos pequeños | `incremental-implementation` |
| Especificar antes de construir | `spec-driven-development` |
