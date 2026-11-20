import { Component, type ReactNode } from "react";
import { ErrorScreen } from "./error-screen";

/**
 * Captura cualquier error de render por debajo y muestra la pantalla de error. No lo registra: lo hace la raíz de
 * React (`rootErrorHandlers` en src/lib/error-reporting.ts, en main.tsx) con cada error que captura un ErrorBoundary.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state: { error: unknown } = { error: undefined };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override render() {
    return this.state.error === undefined ? this.props.children : <ErrorScreen />;
  }
}
