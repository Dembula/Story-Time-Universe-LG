import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/screens.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  // Hide the static HTML splash once React takes over.
  const boot = document.getElementById("boot-splash");
  if (boot && boot.parentNode) boot.parentNode.removeChild(boot);

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
