import type { Metadata, Viewport } from "next";
import "./globals.css";

// Metadados exibidos pelo navegador e usados quando a PWA é adicionada à tela inicial.
export const metadata: Metadata = {
  title: "Fiscalização Cabo Frio",
  description: "Sistema interno de fiscalização de transportes e trânsito.",
  manifest: "/manifest.webmanifest",
};

// Define a cor da barra do navegador em celulares compatíveis.
export const viewport: Viewport = {
  themeColor: "#0c2f57",
};

// Layout raiz: envolve todas as páginas do sistema.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
