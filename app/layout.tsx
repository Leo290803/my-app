import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JERS • IDJUV",
  description: "Sistema dos Jogos Escolares de Roraima - IDJUV",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          h-full
          min-h-dvh
          antialiased
          bg-zinc-50
        `}
      >
        {children}
      </body>
    </html>
  );
}