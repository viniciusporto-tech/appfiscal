"use client";

import { useEffect } from "react";

// Componente responsável apenas por registrar o Service Worker da PWA.
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Verifica se o navegador oferece suporte a Service Worker.
    if (!("serviceWorker" in navigator)) return;

    // Registra o arquivo público /sw.js após a página carregar.
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // Exibe o erro apenas no console para facilitar diagnóstico durante o desenvolvimento.
      console.error("Falha ao registrar Service Worker:", error);
    });
  }, []);

  // O componente não desenha nada na tela.
  return null;
}
