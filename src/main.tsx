import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { captureGlobalErrors, rootErrorHandlers } from "./lib/error-reporting";
import { migrateStorage } from "./lib/migrations";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Falta el elemento #root en index.html");

// Antes que nada: así también quedan en el log los errores del arranque.
captureGlobalErrors();

// Antes de leer ningún dato guardado.
migrateStorage();

createRoot(root, rootErrorHandlers).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
