# Decisiones

Por qué el starter es como es. Cada decisión dice qué se hace, por qué y dónde está. Si una app cambia alguna, la
actualiza aquí.

## Plataforma

- **Solo Windows x64**, con WebView2 e instalador NSIS por usuario (sin permisos de administrador). No hay código ni
  permisos para macOS, Linux o móvil: la biblioteca de Rust es solo `rlib` y hay una única capability.
- **Un solo repositorio, público.** El updater descarga `latest.json` y el instalador sin autenticación, y GitHub solo
  sirve así los assets de un repositorio público. Para código privado, [release.md](release.md) describe un repositorio
  de distribución aparte. [Enlaces de GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)

## Versiones

- **La versión de la app está solo en `package.json`:** `tauri.conf.json` la lee con `"version": "../package.json"`
  (el instalador, el updater y el ejecutable la toman de ahí) y Vite la pasa a la interfaz. La de `Cargo.toml` no se
  usa y se deja fija, para no tocar `Cargo.lock` en cada versión.
  [Configuración de Tauri](https://v2.tauri.app/reference/config/)
- **La última versión estable** de cada pieza (en Node, la LTS), con la antigüedad mínima de un día que exige pnpm a los
  paquetes recién publicados. Las versiones exactas están en los locks.
- **TypeScript, en la última versión mayor que admite typescript-eslint** (6.x mientras siga abierto su seguimiento).
  Dependabot ignora las versiones mayores de TypeScript; cuando typescript-eslint admita la siguiente, se quita esa
  regla. [Seguimiento](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
- **Las dos mitades de Tauri** (crates y paquetes npm, más `tauri`, `@tauri-apps/api` y `@tauri-apps/cli`) van en la
  misma versión menor; lo comprueba `pnpm test:scripts`.
- **El toolchain de Rust, fijado** en `rust-toolchain.toml`: todas las máquinas y la CI compilan con el mismo Rust, y
  una versión nueva (con lints nuevos de clippy) no rompe la CI sin cambiar el código. Dependabot propone cada versión
  nueva. [Dependabot y el toolchain de Rust](https://github.blog/changelog/2025-08-19-dependabot-now-supports-rust-toolchain-updates/)
- **Las acciones de GitHub, fijadas a un commit** (una etiqueta se puede mover), con la versión en un comentario.

## Barra de título

- **Los botones de la ventana son código propio, sin plugin.** Tauri no ofrece botones nativos en una ventana sin marco
  ([tauri#4531](https://github.com/tauri-apps/tauri/issues/4531)), y los plugins que los dan son de un solo autor e
  imponen su propio DOM y sus estilos. Hay dos piezas:
  - `src/lib/window-controls.ts`: los tres botones, en DOM y sin framework (`mountWindowControls`), con los glifos de
    Windows (Segoe Fluent Icons; en Windows 10, Segoe MDL2 Assets), las medidas de Windows 11 (46 px de ancho), el
    hover con el color del texto y cerrar en rojo con la X blanca. Fuera del orden de Tab, como en las ventanas
    nativas (con el teclado: Alt+F4, Win+flechas, Alt+Espacio), pero en el árbol de accesibilidad.
  - `src-tauri/src/window_controls.rs`: Snap Layouts. Windows solo muestra su menú si la ventana responde a
    `WM_NCHITTEST` con `HTMAXBUTTON` sobre el botón de maximizar, y en una ventana sin marco el ratón lo recibe WebView2.
    Una ventana nativa invisible, colocada sobre el botón con la zona que mide la interfaz, da esa respuesta, avisa del
    hover y la pulsación, y maximiza o restaura con `WM_SYSCOMMAND` como el botón nativo.
    [Microsoft](https://learn.microsoft.com/windows/apps/desktop/modernize/apply-snap-layout-menu)
- **La API de Tauri se importa** (`@tauri-apps/api`): `withGlobalTauri` queda desactivado, como viene en Tauri, y
  ningún script depende de `window.__TAURI__`.
- **La barra es simétrica:** 36 px de alto con botones de 28, 4 px de margen a la izquierda y 16 px entre el menú y los
  botones de la ventana, para que el menú no parezca uno de ellos.
- **Tamaño mínimo de 480×360.** Microsoft pide un ancho mínimo de 500 epx como mucho para que la ventana quepa en las
  zonas de Snap Layouts: una de 800 de ancho no cabe en media pantalla de un portátil 1080p al 125 %. En una ventana
  sin marco el contenido queda 16×9 px por debajo del mínimo (tao no cuenta los bordes invisibles,
  [tauri#13375](https://github.com/tauri-apps/tauri/issues/13375)); no se corrige, y el e2e prueba ese tamaño real
  (464×351). La barra y Settings se adaptan con container queries.
- **La ventana nace oculta** (`visible: false`) y la muestra la interfaz cuando ya ha pintado (`src/lib/reveal-window.ts`):
  así no se ve el fondo blanco de WebView2 ni un primer fotograma con otro tema. Si la interfaz no carga, Rust la
  muestra igualmente a los 4 s. window-state no guarda la visibilidad, porque si no la mostraría antes de pintar.
- **Una ventana restaurada que no cabe** en el área de trabajo de su monitor (por ejemplo, guardada en un monitor más
  grande) se encoge y se coloca dentro al arrancar (`src-tauri/src/window_bounds.rs`). window-state ya recoloca una
  ventana que queda fuera de todos los monitores, pero no cambia su tamaño.

## Interfaz

- **shadcn `base-nova` sin modificar.** `src/components/ui/` sale de la CLI (`pnpm exec shadcn add …`) y no se edita a
  mano, para poder actualizarlo con la CLI y revisar el diff: el del PR muestra cualquier cambio en `ui/`. Lo que
  falta se compone fuera.
- **`VerticalTabs`:** el `Tabs` de shadcn no pasa `orientation` a Base UI, así que unas pestañas verticales se recorren
  con izquierda y derecha y no anuncian `aria-orientation="vertical"`. Cuando shadcn lo corrija, se vuelve a su `Tabs`.
  [shadcn-ui/ui#10592](https://github.com/shadcn-ui/ui/issues/10592)
- **Settings:** alto fijo con pestañas verticales con aspecto de Toggle (`ToggleTabsTrigger`) y secciones con la
  cabecera fija y su propio scroll ([settings.md](settings.md)). Cada cambio se aplica al momento, así que no hay aviso
  de cambios sin guardar; un clic fuera no cierra el diálogo. Settings y el diálogo del updater se cargan al abrirlos.
- **Todos los modales** miden como mucho el 80 % del alto y el 94 % del ancho de la ventana, y nunca tapan la barra de
  título: sin ese tope, Settings no cabe en la ventana mínima. En un Settings estrecho, las pestañas se quedan en su
  icono (el nombre sigue para lectores de pantalla).
- **La webview no se comporta como un navegador:**
  - **Autocompletado:** desactivado (`generalAutofillEnabled: false`). WebView2 lo trae activado: guarda en su perfil
    lo que se escribe en los formularios (nombres, direcciones, texto) y lo sugiere después.
    [WebView2](https://learn.microsoft.com/microsoft-edge/webview2/reference/win32/icorewebview2settings4)
  - **Zoom:** desactivado siempre, en desarrollo y en release. Es lo predeterminado en Tauri (`zoomHotkeysEnabled` vale
    `false`, y wry desactiva con él también el pellizco), así que no hay código para ello.
  - **Recargar, imprimir, buscar y atrás/adelante con el teclado:** desactivados en release con
    `AreBrowserAcceleratorKeysEnabled` de WebView2 (`src-tauri/src/webview.rs`), que conserva los atajos de edición. En
    desarrollo siguen disponibles.
  - **Menú contextual:** en release solo en los campos editables (cortar, copiar, pegar y corrector). Lo bloquea
    `src/lib/context-menu.ts` con `preventDefault`. No se desactivan los menús de WebView2 desde Rust: eso los quitaría
    también de los campos editables, y además dejaría de emitirse el evento que permite filtrarlos. El menú de WebView2
    en un campo trae además «Import passwords», del gestor de contraseñas de Edge (`generalAutofillEnabled` no lo
    quita). `webview.rs` lo filtra en `ContextMenuRequested`: quita los comandos sin nombre propio (`other`), nunca los
    submenús ni los de edición, y los separadores sobrantes. Se comprueba a mano en una build release, con y sin
    sugerencias del corrector ([tests-y-ci.md](tests-y-ci.md)).
    [Menús contextuales de WebView2](https://learn.microsoft.com/microsoft-edge/webview2/how-to/context-menus)

## Seguridad y datos

- **CSP sin hosts externos:** lo que viene de la red se pide desde Rust. Tauri solo envía la CSP con los archivos que
  sirve él: en `tauri dev`, la webview carga el servidor de Vite y no hay CSP. Por eso el e2e prueba la build de
  producción con `vite preview` y la misma cabecera, y falla ante cualquier violación (`e2e/csp.spec.ts`). zod
  prueba `new Function` la primera vez que valida, y la CSP no lo permite: por eso se importa desde
  `src/lib/zod.ts`, configurado con `jitless` (lo exige ESLint).
- **Una capability** para la ventana principal, con los permisos sueltos que se usan. Los comandos propios se declaran
  en `build.rs` y quedan denegados salvo que la capability los conceda. `scripts/security.test.ts` comprueba las reglas
  (sin conjuntos `:default`, sin `remote`, comandos declarados ⇔ concedidos) y que cada permiso y cada directiva estén
  justificados en [arquitectura.md](arquitectura.md).
  [Capabilities de Tauri](https://v2.tauri.app/security/capabilities/)
- **Sin el patrón de aislamiento de Tauri** (isolation), que Tauri recomienda siempre que se pueda: intercepta cada
  mensaje IPC en un iframe aislado para validarlo antes de que llegue a Rust. Con una capability mínima y comandos que
  solo cambian la ventana, no añadiría ninguna validación que Rust no haga ya, y en Windows obliga a meter sus scripts
  en línea. Una app que añada comandos con acceso a archivos, red o procesos debe adoptarlo y validar ahí sus
  argumentos. [Isolation de Tauri](https://v2.tauri.app/concept/inter-process-communication/isolation/)
- **Sin almacén de secretos:** la plantilla no guarda ninguno. Si una app lo necesita, lo añade en Rust con su
  justificación, y el secreto no pasa por la interfaz.
- **Las claves guardadas no llevan el nombre de la app** (`preferences:v1`, `theme:v1`): el localStorage ya es de cada
  app (su directorio de datos sale del `identifier`). Así no hay que cambiarlas al renombrar, y cambiarlas después de
  publicar perdería los datos.
- **El log** guarda todo lo de la app y la interfaz y, de Tauri y sus plugins, solo avisos y errores. De un pánico
  guarda dónde ocurrió, no su texto, que podría llevar datos (en desarrollo, la consola sigue mostrando el mensaje).
- **Los errores de la interfaz** llegan al log aunque nadie los capture (`src/lib/error-reporting.ts`): los de render
  con los manejadores de la raíz de React (`createRoot`, el único sitio que los registra, también los de cada
  sección), y las excepciones y promesas rechazadas sin capturar con los eventos de `window`. Se guarda el tipo, la
  pila y la pila de componentes, nunca el mensaje.

## Actualizaciones y publicación

- **Actualizaciones firmadas:** el plugin verifica la firma con la clave pública y `requireSignedVersion` exige que
  la versión firmada sea la anunciada. Se descargan en segundo plano y se instalan cuando el usuario lo decide. Al
  instalar, el plugin cierra la app y el instalador NSIS (modo pasivo) la vuelve a abrir: no hace falta
  `tauri-plugin-process` ni su permiso de reinicio. Como la app sale sin su cierre normal, window-state no guarda en
  ese momento el tamaño ni la posición. En desarrollo no se buscan solas: el endpoint no existe hasta publicar y una
  versión publicada no debe sustituir a la que se desarrolla. [Updater de Tauri](https://v2.tauri.app/plugin/updater/)
- **El release separa compilar de firmar:** primero ejecuta la CI completa sobre el commit (`workflow_call`); el job de
  Windows compila sin secretos (ahí se ejecutan las dependencias) y sin cachés; el de firma no hace checkout y
  verifica la CLI de Tauri con el SHA-512 del lock antes de usar la clave; el último publica primero un borrador y
  después la release, para que `latest.json` nunca apunte a una a medio subir.
- **Sin firma Authenticode:** la plantilla no se distribuye; firmar el instalador es decisión de cada app
  ([release.md](release.md#firma-de-código)).
- **Dependabot** abre cada semana un PR con todas las dependencias de npm y Cargo juntas (así las dos mitades de Tauri
  suben a la vez), otro con las acciones y otro con el toolchain de Rust.
  [Grupos multiecosistema](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-multi-ecosystem-updates)

## Lo que solo se prueba en GitHub

La CI, el workflow de release (con la llamada a la CI y la firma en su job aislado) y una actualización entre dos
releases publicadas necesitan el repositorio de la app. En local se prueban la configuración de los workflows (sus
tests) y una actualización firmada desde un servidor local ([release.md](release.md#probar-una-actualización-en-local)).
Lo que se prueba a mano en Windows está en [tests-y-ci.md](tests-y-ci.md).
