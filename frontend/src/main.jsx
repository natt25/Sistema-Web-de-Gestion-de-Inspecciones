import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./App.css";

async function resetBrowserRuntimeCaches() {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn("[bootstrap] No se pudo limpiar SW/cache:", err?.message || err);
  }
}

function renderFatal(error) {
  const el = document.getElementById("root");
  if (!el) return;

  el.innerHTML = `
    <div style="padding:16px;font-family:Arial,sans-serif">
      <h2 style="margin:0 0 8px 0">Error de arranque</h2>
      <div style="margin-bottom:8px">La app no pudo iniciar correctamente.</div>
      <pre style="white-space:pre-wrap;font-size:12px;background:#f5f5f5;padding:10px;border-radius:8px;">${String(error?.stack || error?.message || error)}</pre>
    </div>
  `;
}

window.addEventListener("unhandledrejection", (event) => {
  renderFatal(event?.reason || "Unhandled promise rejection");
});

window.addEventListener("error", (event) => {
  renderFatal(event?.error || event?.message || "Unknown runtime error");
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);

// Limpieza en background para no bloquear el primer render.
resetBrowserRuntimeCaches().catch((err) => {
  console.warn("[bootstrap] limpieza de cache/SW fallo:", err?.message || err);
});
