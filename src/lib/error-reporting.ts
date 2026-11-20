// Errores de la interfaz al log de la app. En release no hay consola: sin esto, un error de render, una promesa
// rechazada sin `catch` o una excepción en un manejador de eventos desaparecerían sin rastro.
//
// Del error se registra su tipo y su pila (dónde ocurrió: funciones y archivos del bundle) y, en los de render, la pila
// de componentes. Nunca su mensaje: puede llevar datos del usuario.
import { logError } from "./log";

/** Líneas de pila que se conservan: bastan para ubicar el fallo sin llenar el log. */
const MAX_FRAMES = 15;

/** Las líneas de una pila de V8 (WebView2) que son ubicaciones de código (`    at …`), sin la del mensaje. */
function frames(stack: string | null | undefined): string[] {
  return (stack ?? "")
    .split("\n")
    .filter((line) => /^\s*at\s/.test(line))
    .slice(0, MAX_FRAMES)
    .map((line) => `  ${line.trim()}`);
}

/** El texto del log para un error: el contexto, su tipo, su pila y, si la hay, la pila de componentes. */
export function describeError(context: string, error: unknown, componentStack?: string | null): string {
  const kind = error instanceof Error ? error.name : typeof error;
  const lines = [`${context}: ${kind}`, ...frames(error instanceof Error ? error.stack : undefined)];
  const components = frames(componentStack);
  if (components.length > 0) lines.push("Componentes:", ...components);
  return lines.join("\n");
}

function report(context: string, error: unknown, componentStack?: string | null) {
  logError(describeError(context, error, componentStack));
  // Al sustituir los manejadores de React, este deja de escribir en la consola: en desarrollo, que siga haciéndolo.
  if (import.meta.env.DEV) console.error(error);
}

/**
 * Para `createRoot`: los errores de render, capturados por un ErrorBoundary (también la pantalla de error de cada
 * sección) o sin capturar. Es el único sitio que los registra.
 */
export const rootErrorHandlers = {
  onCaughtError: (error: unknown, info: { componentStack?: string }) => {
    report("Error en la interfaz", error, info.componentStack);
  },
  onUncaughtError: (error: unknown, info: { componentStack?: string }) => {
    report("Error sin capturar en la interfaz", error, info.componentStack);
  },
};

/** Registra los errores fuera de React: excepciones sin capturar y promesas rechazadas sin `catch`. */
export function captureGlobalErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    report("Excepción sin capturar", event.error);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    report("Promesa rechazada sin capturar", event.reason);
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
