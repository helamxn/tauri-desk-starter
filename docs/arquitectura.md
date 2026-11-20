# Arquitectura

Tauri 2 aloja una única ventana WebView2 en Windows. React monta el router con historial hash, la barra propia, Home y Example. Un error de sección conserva la barra y ofrece recargar. La ventana restaura tamaño y posición, nace oculta y la muestra la interfaz cuando ya ha pintado con su tema. Una segunda instancia muestra la primera, incluso cuando está en la bandeja.

## Barra y botones de la ventana

La ventana no tiene marco. La barra (`src/components/title-bar.tsx`) es la zona de arrastre y lleva la navegación y las acciones. Los botones de minimizar, maximizar y cerrar son un módulo sin framework, `src/lib/window-controls.ts` (DOM y la API de Tauri, con sus estilos en `window-controls.css`): `mountWindowControls(contenedor)` los crea y devuelve cómo quitarlos.

Para que Windows 11 muestre Snap Layouts sobre el botón de maximizar, `src-tauri/src/window_controls.rs` coloca encima una ventana nativa invisible que responde como un botón de maximizar nativo. El módulo de la interfaz le envía la zona del botón medida en el DOM (comando `set_maximize_button_area`), y Rust le avisa de lo que hace el ratón (evento `window-controls://maximize`) para que pinte el hover y la pulsación. El clic lo resuelve Rust con `WM_SYSCOMMAND`, como el botón nativo.

## Desarrollo y ajustes

`build.devUrl` en `src-tauri/tauri.conf.json` fija el puerto local, inicialmente 1420, que Vite lee. Vite falla si el puerto está ocupado. En desarrollo la recarga usa el mismo origen. Playwright prueba la build de producción con `vite preview`, en su puerto por defecto (4173).

Settings se carga al abrirse. Tema y preferencias se guardan con claves versionadas. `src/lib/storage.ts` migra los valores conocidos tras escribir el destino y conserva las versiones futuras. Keep running crea la bandeja antes de activar el cierre en segundo plano. Un fallo al crearla devuelve la preferencia al estado desactivado.

## Añadir un comando de dominio

Home y Example son estados vacíos: la plantilla no trae comandos de dominio. Para añadir uno:

1. Escríbelo en un módulo de `src-tauri/src/` con `#[tauri::command]`. Valida en Rust cada argumento (forma y tamaño) y devuelve a la interfaz errores fijos; el detalle va al log, sin datos del usuario. El acceso a disco corre fuera del hilo de la ventana (`async` o `spawn_blocking`).
2. Declara el nombre del comando en `src-tauri/build.rs`, regístralo con `generate_handler!` en `src-tauri/src/lib.rs` y concede su permiso solo a la ventana que lo necesita y justifícalo en la tabla de permisos de abajo. El test de capabilities (`scripts/security.test.ts`) comprueba que cada comando declarado tiene su permiso, y nada más, y que la tabla coincide con la capability.
3. Encapsula `invoke` en la feature (`src/features/<feature>/`), no en los componentes.
4. Prueba en Rust las entradas válidas, las inválidas y los límites; en React, el argumento enviado y cómo se recupera la interfaz de un fallo. La plantilla no trae almacén de secretos: si la app necesita uno, se añade en Rust, con su justificación en el PR, y el secreto no pasa por la interfaz.

## Política de contenido

| Directiva | Motivo |
| --- | --- |
| `default-src 'self'` | Solo carga los recursos empaquetados y los scripts que autoriza Tauri en la compilación. |
| `connect-src 'self' ipc: http://ipc.localhost` | Transporte local de Tauri (IPC). El updater accede a la red desde Rust. |
| `img-src 'self' data: blob:` | Iconos empaquetados y recursos de imagen embebidos o locales de la webview. |
| `style-src 'self' 'unsafe-inline'` | Base UI inserta elementos `<style>` (por ejemplo, el del Select). Los estilos que se aplican desde JavaScript (CSSOM) no dependen de la CSP. |
| `font-src 'self' data:` | Fuentes locales o embebidas del bundle. |
| `object-src 'none'` | Bloquea plugins y objetos incrustados. |
| `base-uri 'self'` | Restringe la base de las URLs al origen de la app. |
| `form-action 'none'` | Los formularios se procesan en React y Rust. |
| `frame-ancestors 'none'` | Impide alojar la app dentro de otro documento. |

Tauri envía esta CSP con los archivos que sirve él, es decir, en la app empaquetada. En `tauri dev` la webview carga el servidor de Vite directamente y no hay CSP. Se prueba en el e2e (`e2e/csp.spec.ts`): Playwright abre la build de producción con `vite preview`, que envía la misma cabecera (`preview.headers` en `vite.config.ts`, leída de `tauri.conf.json`). `scripts/security.test.ts` comprueba que esta tabla coincide con la CSP.

No pongas `<style>` ni scripts en línea en `index.html`: Tauri les añade un nonce o un hash en la CSP de la app empaquetada, y un nonce en `style-src` hace que el navegador ignore `'unsafe-inline'`. Los `<style>` de Base UI se bloquearían solo en la app, y el e2e, que sirve la CSP tal cual, no lo vería.

## Permisos de la ventana principal

| Permiso | Uso |
| --- | --- |
| `core:event:allow-listen` | Escuchar cambios de tamaño y lo que hace el ratón sobre el botón de maximizar (Snap Layouts). |
| `core:event:allow-unlisten` | Liberar esas suscripciones. |
| `log:allow-log` | Registrar el contexto fijo de fallos del frontend. |
| `core:window:allow-minimize` | Botón de minimizar. |
| `core:window:allow-toggle-maximize` | Botón de maximizar y restaurar (con el teclado o un lector de pantalla; el clic lo atiende Rust). |
| `core:window:allow-internal-toggle-maximize` | Doble clic en la zona de arrastre. |
| `core:window:allow-is-maximized` | Elegir el icono de maximizar o restaurar. |
| `core:window:allow-close` | Botón de cerrar. |
| `core:window:allow-start-dragging` | Arrastrar la ventana sin marco. |
| `core:window:allow-set-theme` | Aplicar el tema a WebView2 y los controles nativos. |
| `core:window:allow-show` | Mostrar la ventana, que nace oculta, cuando la interfaz ya ha pintado. |
| `allow-set-maximize-button-area` | Colocar sobre el botón de maximizar la zona nativa de Snap Layouts (Rust valida la zona). |
| `allow-set-keep-running` | Sincronizar el cierre y la bandeja con la preferencia. |
| `updater:allow-check` | Consultar el manifiesto de actualización. |
| `updater:allow-download` | Descargar la nueva versión en segundo plano. |
| `updater:allow-install` | Instalar tras la confirmación del usuario. |
| `core:resources:allow-close` | Liberar el recurso nativo de la actualización o su descarga. |

No hace falta un permiso para reiniciar: al instalar, el updater cierra la app y el instalador (modo pasivo) la vuelve a abrir. `scripts/security.test.ts` comprueba que esta tabla coincide con la capability.

## Dónde están los datos

Todo cuelga del `identifier` de `tauri.conf.json` (por eso se elige antes del primer arranque, [renombrar.md](renombrar.md)):

| Qué | Dónde |
| --- | --- |
| Logs (5 archivos de 1 MB como mucho, en hora local) | `%LOCALAPPDATA%\<identifier>\logs\<productName>.log` |
| Preferencias y tema (`localStorage` de WebView2) | `%LOCALAPPDATA%\<identifier>\EBWebView\` |
| Tamaño y posición de la ventana | `%APPDATA%\<identifier>\.window-state.json` |
| La app instalada | `%LOCALAPPDATA%\<productName>\` (instalación por usuario) |

Si el tamaño guardado no cabe en la pantalla (por ejemplo, tras pasar de un monitor grande al portátil), la ventana se ajusta al arrancar (`src-tauri/src/window_bounds.rs`).

## Distribución

El [release](release.md) genera un instalador NSIS por usuario y un manifiesto con la firma del instalador para el updater. Al desinstalar con «Delete the application data» se borran las dos carpetas de datos; sin la casilla se conservan. El modo de actualización conserva los datos.
