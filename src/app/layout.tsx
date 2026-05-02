import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archeos Society — Simulador",
  description:
    "Simulador local do jogo de tabuleiro Archeos Society para 2 a 3 jogadores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
