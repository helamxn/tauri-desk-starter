// Menú contextual del navegador: en release se bloquea salvo en los campos editables, que conservan cortar, copiar,
// pegar y el corrector. Es el único bloqueo: WebView2 respeta preventDefault en `contextmenu`, y desactivar sus menús
// desde Rust (AreDefaultContextMenusEnabled) los quitaría también de los campos editables (src-tauri/src/webview.rs).

/** Si el elemento es editable: inputs de texto, textarea o contenido editable. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return !target.disabled && !target.readOnly;
  if (target instanceof HTMLInputElement) {
    const nonText = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);
    return !nonText.has(target.type) && !target.disabled && !target.readOnly;
  }
  return false;
}

export function onContextMenu(event: MouseEvent): void {
  if (!isEditable(event.target)) event.preventDefault();
}

/** Instala el bloqueo en el documento; devuelve cómo quitarlo. */
export function blockContextMenu(documentNode: Document = document): () => void {
  documentNode.addEventListener("contextmenu", onContextMenu);
  return () => {
    documentNode.removeEventListener("contextmenu", onContextMenu);
  };
}
