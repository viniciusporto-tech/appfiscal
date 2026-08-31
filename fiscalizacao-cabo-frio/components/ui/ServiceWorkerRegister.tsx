"use client";

import { useEffect } from "react";

// Registra o Service Worker que dá comportamento de PWA ao sistema.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar Service Worker:", error);
    });
  }, []);

  return null;
}
