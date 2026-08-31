import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiscalização Cabo Frio",
  description: "Sistema interno de fiscalização de transportes e trânsito.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#082a4c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
