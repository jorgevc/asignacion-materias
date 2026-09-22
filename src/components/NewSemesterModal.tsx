"use client";

import React, { useState, useEffect } from "react";

export interface SemesterData {
  id: number;
  label: string;
  year: number;
  term: string;
  isActive: boolean;
}

interface NewSemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (semester: SemesterData) => void;
}

export default function NewSemesterModal({
  isOpen,
  onClose,
  onCreated,
}: NewSemesterModalProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [term, setTerm] = useState<string>("1");
  const [label, setLabel] = useState<string>(`${currentYear}-1`);
  const [isManualLabel, setIsManualLabel] = useState(false);
  const [setActive, setSetActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManualLabel) {
      if (term === "verano") {
        setLabel(`${year}-Verano`);
      } else {
        setLabel(`${year}-${term}`);
      }
    }
  }, [year, term, isManualLabel]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          year,
          term,
          setActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el semestre");
      }

      onCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar semestre");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Agregar Nuevo Semestre</h3>
            <p className="text-xs text-zinc-500">
              Registra un nuevo ciclo para asignaciones y peticiones docentes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Año académico *
              </label>
              <input
                type="number"
                min="2020"
                max="2040"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Periodo / Término *
              </label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="1">1 (Primavera)</option>
                <option value="2">2 (Otoño)</option>
                <option value="verano">Verano</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Etiqueta / Identificador único *
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualLabel(false);
                  if (term === "verano") setLabel(`${year}-Verano`);
                  else setLabel(`${year}-${term}`);
                }}
                className="text-[11px] text-indigo-600 hover:underline"
              >
                Restablecer sugerido
              </button>
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setIsManualLabel(true);
                setLabel(e.target.value);
              }}
              placeholder="Ej. 2027-1"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none font-mono"
              required
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Es el nombre visible en selectores y peticiones (ej. 2026-1, 2027-2).
            </p>
          </div>

          <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={setActive}
                onChange={(e) => setSetActive(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-indigo-950">
                  Establecer como Semestre Activo de inmediato
                </span>
                <p className="text-indigo-800/80 text-[11px]">
                  Al marcarlo, las nuevas peticiones de profesores y asignaciones utilizarán este ciclo.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 shadow-sm"
            >
              {loading ? "Creando..." : "Crear Semestre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
