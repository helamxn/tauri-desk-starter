# Publicar una versión

El destino predeterminado es el repositorio público de la app. Tauri consulta por HTTPS el archivo estático `latest.json`, compara la versión y verifica la firma del instalador y exige que la versión firmada coincida con la anunciada en el manifiesto. GitHub sirve ese archivo en `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`. Un repositorio privado exige autenticación para descargar sus assets. La app distribuida hace peticiones anónimas. [Updater de Tauri](https://v2.tauri.app/plugin/updater/) · [Enlaces de GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)

1. Completa [el renombrado](renombrar.md). Ejecuta `pnpm tauri signer generate -w <ruta-privada>` y conserva una copia segura de la clave y la contraseña fuera del repositorio. Copia el contenido del archivo público en `plugins.updater.pubkey`. Configura el endpoint del repositorio.
2. En Actions registra `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Autoriza al workflow a escribir contenido. La firma del updater permite comprobar actualizaciones. La confianza de Windows en el editor del instalador se gestiona por separado.
3. Actualiza la versión en package.json (es la única: tauri.conf.json la lee de ahí) y escribe la sección fechada en CHANGELOG.md. Reabre Unreleased. Sube los cambios a main y espera la CI.
4. Ejecuta **Actions → Release → Run workflow** en main. El control inicial exige notas, identidad propia, repositorio público y versión nueva; después la release ejecuta la CI completa sobre ese commit. El job de Windows compila sin secretos ni cachés. El de firma verifica los dos paquetes de la CLI con SHA-512 del lock antes de acceder a la clave y firma el instalador con la versión que se publicará. El último publica el borrador completo con el token de GitHub y etiqueta el commit exacto.
5. Instala una primera versión en una cuenta de prueba. Publica una versión superior con la misma clave. Comprueba la descarga, las notas, el reinicio y la conservación de las preferencias. Repite la desinstalación con y sin la casilla de borrado. Conserva la evidencia de la ejecución.

## Si falla a medias

Reintentar siempre es seguro: **Re-run failed jobs** o volver a lanzar el workflow sobre el mismo commit.

- **Falla `check`:** dice qué falta (versión repetida, sin notas en `CHANGELOG.md`, marcadores, repositorio privado). Corrígelo con un PR y vuelve a lanzar.
- **Falla `CI`:** el commit no pasa las suites. Corrígelo con un PR y vuelve a lanzar.
- **Falla `build` o `sign`:** no se ha publicado nada. Reintenta. Si `sign` dice que falta el secreto o la contraseña no es la de la clave, revisa los secretos de Actions.
- **Falla `publish`:** puede quedar un borrador. Al reintentar desde el mismo commit, el borrador se borra y se crea de nuevo; una release de otra compilación con la misma etiqueta detiene el job. Si la release ya se publicó, **Re-run failed jobs** lo detecta y termina sin hacer nada (lanzar el workflow de nuevo se detiene en `check`: la versión ya está publicada).
- **Una versión publicada con un fallo:** no se retira (las instalaciones ya pueden tenerla). Se corrige y se publica una versión mayor.

## Probar una actualización en local

Sin publicar nada: genera una clave desechable (`pnpm tauri signer generate -w <ruta> -p "" --ci`) y compila dos versiones con `--config` apuntando a un servidor local (`"plugins": { "updater": { "pubkey": "<clave pública>", "endpoints": ["http://127.0.0.1:<puerto>/latest.json"], "dangerousInsecureTransportProtocol": true } }`, una `"version"` distinta en cada una (la de `--config` sustituye a la de package.json) y otro `identifier` para no tocar los datos reales). Firma el instalador nuevo como el job `sign` (`pnpm tauri signer sign --app-version <versión> -f <clave> -p "" <instalador>`), escribe `latest.json` con la firma y la URL, sírvelo, instala la versión antigua y pulsa **Check for updates** en Settings (en desarrollo no se busca solo). Esa configuración nunca va a `tauri.conf.json`.

## La clave del updater

La clave privada es lo único que permite publicar actualizaciones que las apps instaladas acepten. Guarda la clave y su contraseña en dos sitios seguros fuera del repositorio (por ejemplo, un gestor de contraseñas y una copia sin conexión):

- **Si se pierde,** las apps instaladas no vuelven a actualizarse: cada usuario tiene que instalar a mano una versión con una clave nueva.
- **Si se filtra,** cualquiera con acceso al endpoint puede publicar una actualización válida. Cámbiala cuanto antes.
- **Para cambiarla,** genera una clave nueva y publica una versión firmada todavía con la antigua que ya lleve la `pubkey` nueva. A partir de esa versión, firma con la nueva y actualiza los secretos de Actions.

## Firma de código

El instalador no lleva firma Authenticode. Firmarlo es una decisión de cada app, porque exige un certificado de firma de código y una identidad verificada. Sin firma:

- **SmartScreen** avisa en la primera instalación («Windows protected your PC»): quien instala pulsa «More info» → «Run anyway». Las actualizaciones no pasan por SmartScreen: las descarga el updater, que comprueba su propia firma (la de `pubkey`).
- **Smart App Control,** en los equipos con Windows 11 que lo tienen activo, bloquea las apps sin firma sin ofrecer una excepción: solo se puede desactivar para todo el equipo. [Smart App Control](https://support.microsoft.com/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003)

Para firmar sin dar la credencial a los jobs donde corren las dependencias, separa el empaquetado: `pnpm tauri build --no-bundle` en el job sin secretos, la firma del ejecutable en un job aislado, `pnpm tauri bundle` para generar el instalador con el ejecutable firmado y, por último, la firma del instalador y la del updater. [Firma de código en Windows](https://v2.tauri.app/distribute/sign/windows/)

## Código privado y descargas públicas

Crea un repositorio público de distribución con una rama inicial. Apunta el endpoint a ese repositorio. En una copia del workflow define `RELEASES_REPO` con su propietario y nombre. Cambia la validación de visibilidad, la comprobación de etiquetas de distribución, la preparación de URLs y las operaciones de publicación para usar ese destino. Mantén la comprobación de CI en el repositorio fuente. Al crear el release, usa un commit existente del repositorio de distribución para `--target`, conserva el SHA del código en las notas y etiqueta ese SHA por separado en el repositorio del código.

Crea un token de acceso granular limitado al repositorio de distribución con Contents: write y guárdalo como `RELEASES_TOKEN` en los secretos del código. Úsalo solo como `GH_TOKEN` del paso de publicación. Adapta las pruebas del workflow a la separación de repositorios. Conserva todos los secretos en Actions.
