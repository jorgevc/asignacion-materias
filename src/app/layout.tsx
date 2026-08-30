import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Asignación de Materias",
  description: "Sistema de peticiones de clases por prioridad",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">Asignación de Materias</Link>
            <nav className="flex gap-3 text-sm">
              <Link href="/" className="px-3 py-1.5 rounded hover:bg-zinc-100">Docente</Link>
              <Link href="/admin" className="px-3 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-800">Admin</Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t bg-white text-center text-xs text-zinc-500 py-3">
          Fase 1: Recolección de peticiones (3 slots × 3 clases, prioridades 1-3, duplicadas permitidas)
        </footer>
      </body>
    </html>
  );
}
