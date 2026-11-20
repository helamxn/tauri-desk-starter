# tauri-desk-starter

Plantilla para crear apps de escritorio para **Windows x64** con Tauri 2, React, TypeScript y shadcn. Trae lo que
necesita cualquier app de escritorio, seguro por defecto, y deja libre el contenido: Home y Example son estados vacíos.

## Qué incluye

- **Ventana sin marco** con barra propia: navegación, menú y los botones de Windows con Snap Layouts, sin plugins
  (un módulo sin framework y una ventana nativa en Rust). Mínimo de 480×360, para caber en las zonas de Snap, y sin
  destello al arrancar.
- **Settings** (Ctrl+,) con secciones registrables: General (bandeja y actualizaciones) y Appearance (tema System,
  Light o Dark, también para la ventana nativa).
- **Actualizaciones firmadas:** se descargan en segundo plano y se instalan cuando el usuario lo decide.
- **Bandeja opcional** («Keep the app running when closed») e instancia única.
- **Comportamiento de app, no de navegador:** sin zoom; en release, sin recargar ni el menú contextual del navegador
  (que se conserva en los campos de texto).
- **Seguridad:** CSP sin hosts externos, permisos de la webview uno a uno y comandos propios denegados por defecto.
- **Instalador NSIS por usuario** (sin permisos de administrador) y workflow de release que firma y publica en GitHub
  Releases.
- **Tests:** Vitest, Playwright con axe (en la ventana mínima y a 1600×900), tests de Rust y tests de coherencia del proyecto
  (versiones, CSP, permisos, workflows).

Stack: Tauri 2, React 19, TypeScript, Vite, Tailwind 4, shadcn `base-nova` sobre Base UI, TanStack Router y zod.

## Requisitos

- Windows 10 u 11 x64 con WebView2.
- Visual Studio Build Tools con la carga de trabajo de C++.
- Node (versión de `.node-version`), pnpm y Rust (lo instala rustup desde `rust-toolchain.toml`). pnpm se instala sin
  npm, con `winget install pnpm.pnpm`, y usa por sí mismo la versión de `packageManager` en `package.json`.

## Crear una app

1. En GitHub, **Use this template** (con el repositorio de la plantilla marcado como *Template repository*). En local:
   copia la plantilla en una carpeta nueva sin `.git` y ejecuta `git init`.
2. Antes del primer arranque, cambia el identificador y los nombres con [la guía de identidad](docs/renombrar.md): el
   identificador decide dónde se guardan los datos.
3. Ejecuta `pnpm install --frozen-lockfile` y `pnpm test:scripts`.
4. Para publicar, genera la clave de firma y configura el repositorio con [el procedimiento de release](docs/release.md).
   En GitHub, protege `main` (Settings → Branches): cambios solo por PR y con los tres jobs de la CI en verde.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm tauri dev` | Abre la app con recarga en caliente |
| `pnpm dev` | Solo el frontend, en el navegador (puerto 1420) |
| `pnpm build:app` | Instalador local, sin los archivos del updater |
| `pnpm lint` y `pnpm build` | ESLint con tipos y compilación del frontend |
| `pnpm test`, `pnpm test:scripts`, `pnpm test:rust`, `pnpm test:e2e` | Las suites ([pruebas](docs/tests-y-ci.md)) |

## Documentación

- [Arquitectura](docs/arquitectura.md): estructura, cómo añadir un comando, CSP, permisos y dónde están los datos.
- [Settings](docs/settings.md): cómo añadir una sección.
- [Identidad](docs/renombrar.md): qué cambiar al crear una app.
- [Release](docs/release.md): publicar una versión y probar una actualización en local.
- [Pruebas y CI](docs/tests-y-ci.md).
- [Decisiones](docs/decisiones.md): por qué el starter es como es.
- [AGENTS.md](AGENTS.md): reglas para agentes de código.

Cada app incorpora a mano las mejoras de la plantilla que le interesen.
