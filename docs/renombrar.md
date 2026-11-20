# Crear la identidad de la app

Empieza por el identificador, antes de abrir la ventana. Cambiarlo después deja huérfanos los datos existentes. Estas rutas son también el inventario que consulta la prueba de identidad.

| Archivo | Cambio |
| --- | --- |
| `src-tauri/tauri.conf.json` | Sustituye `com.example.myapp`, ambos nombres visibles «My App», la clave pública y `example/my-app` por tu repositorio. |
| `package.json` | Sustituye el nombre npm `my-app`. |
| `index.html` | Cambia el título de la página. |
| `src-tauri/Cargo.toml` | Cambia el paquete `my-app` (la biblioteca, `app_lib`, se queda). |
| `src-tauri/Cargo.lock` | Actualiza la entrada del paquete local con `cargo check --manifest-path src-tauri/Cargo.toml`. |
| `src-tauri/icons/` | Genera los iconos de la app con `pnpm tauri icon <imagen>` (un PNG cuadrado de 1024 px, con transparencia). Sustituye todos los de la carpeta; el instalador y la ventana usan `icon.ico`. |

Conserva y rellena `CHANGELOG.md` en cada versión. Las menciones en esta guía, en la definición de la prueba (`scripts/lib/identity.ts`) y en el ejemplo de CLI de la skill de terceros (`.agents/skills/shadcn/SKILL.md`) son literales de referencia y se conservan. Ejecuta `pnpm test:scripts` tras cambiar la identidad. Antes de publicar, define `$env:GITHUB_REPOSITORY = "propietario/repositorio"` en PowerShell y ejecuta `node scripts/release.ts check`. GitHub Actions ya proporciona esa variable.

## Retirar el ejemplo

Example es un estado vacío. Para retirarlo, elimina la carpeta `src/features/example/`, la ruta y su import en `src/router.tsx` y el enlace en `src/features/sections.ts`, y ajusta los tests de navegación (`src/App.test.tsx`, `e2e/app.spec.ts`).
