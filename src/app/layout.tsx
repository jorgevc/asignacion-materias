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
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-shadow">
          <div className="mx-auto max-w-6xl px-4 py-2.5 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                📚
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Asignación de Materias
                </span>
                <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">
                  Programación Académica
                </span>
              </div>
            </Link>

            <nav className="flex items-center bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/60 text-xs font-medium">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition"
              >
                Docente
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md bg-slate-900 text-white shadow-2xs hover:bg-slate-800 transition"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-slate-200/70 bg-white text-center text-xs text-slate-500 py-3.5 mt-8">
          <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Sistema de Asignación de Materias por Mérito y Desplazamiento</span>
            <span className="text-slate-400 text-[11px]">3 slots × 3 opciones · Protección de prioridades y rescate</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
