"use client";

import { useEffect, useState } from "react";

type Semester = { id: number; label: string; isActive: boolean; year: number; term: string };
type Course = { id: number; code: string; name: string; cupo: number | null; dias: string | null; horario: string | null; ubicacion: string | null; semesterId: number };

type OptionState = { courseId: string; priority: string };
type SlotsState = {
  1: OptionState[];
  2: OptionState[];
  3: OptionState[];
};

const emptyOptions = (): OptionState[] => [
  { courseId: "", priority: "" },
  { courseId: "", priority: "" },
  { courseId: "", priority: "" },
];

export default function Home() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesterId, setSemesterId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<SlotsState>({ 1: emptyOptions(), 2: emptyOptions(), 3: emptyOptions() });
  const [enabledSlot2, setEnabledSlot2] = useState(false);
  const [enabledSlot3, setEnabledSlot3] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/semesters")
      .then((r) => r.json())
      .then((data: Semester[]) => {
        setSemesters(data);
        const active = data.find((s) => s.isActive);
        if (active) setSemesterId(String(active.id));
        else if (data[0]) setSemesterId(String(data[0].id));
      });
  }, []);

  useEffect(() => {
    if (!semesterId) return;
    fetch(`/api/courses?semesterId=${semesterId}`)
      .then((r) => r.json())
      .then((data: Course[]) => setCourses(data));
    // reset slots when semester changes? keep but clear courseIds that don't match?
    // not clearing to avoid UX loss, but validation will catch
  }, [semesterId]);

  const handleLoad = async () => {
    if (!email || !semesterId) {
      setMessage({ type: "error", text: "Email y semestre requeridos para cargar" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/petitions?email=${encodeURIComponent(email)}&semesterId=${semesterId}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Error al cargar" });
        return;
      }
      if (data.teacher) setName(data.teacher.name || "");
      if (data.slots && data.slots.length > 0) {
        const newSlots: SlotsState = { 1: emptyOptions(), 2: emptyOptions(), 3: emptyOptions() };
        let has2 = false,
          has3 = false;
        for (const s of data.slots) {
          const idx = s.slot_no as 1 | 2 | 3;
          const opts: OptionState[] = s.options.map((o: { courseId: number; priority: number }) => ({
            courseId: String(o.courseId),
            priority: String(o.priority),
          }));
          // pad to 3
          while (opts.length < 3) opts.push({ courseId: "", priority: "" });
          newSlots[idx] = opts.slice(0, 3);
          if (idx === 2) has2 = true;
          if (idx === 3) has3 = true;
        }
        setSlots(newSlots);
        setEnabledSlot2(has2);
        setEnabledSlot3(has3);
        setMessage({ type: "ok", text: `Peticiones cargadas: ${data.slots.length} slot(s)` });
      } else {
        setMessage({ type: "error", text: "No se encontraron peticiones para ese email/semestre" });
      }
    } catch (e) {
      setMessage({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const updateOption = (slot: 1 | 2 | 3, index: number, field: "courseId" | "priority", value: string) => {
    setSlots((prev) => {
      const copy = { ...prev, [slot]: [...prev[slot]] } as SlotsState;
      copy[slot][index] = { ...copy[slot][index], [field]: value };
      return copy;
    });
  };

  const validateClient = (): string | null => {
    if (!email.trim() || !name.trim()) return "Email y nombre son obligatorios";
    if (!semesterId) return "Seleccione semestre";
    // slot 1 required: all 3 courseId + priority
    for (let i = 0; i < 3; i++) {
      if (!slots[1][i].courseId || !slots[1][i].priority) return "Slot 1: las 3 clases y sus prioridades son obligatorias";
    }
    if (enabledSlot2) {
      for (let i = 0; i < 3; i++) {
        if (!slots[2][i].courseId || !slots[2][i].priority) return "Slot 2: si está habilitado, las 3 clases y prioridades son obligatorias";
      }
    }
    if (enabledSlot3) {
      for (let i = 0; i < 3; i++) {
        if (!slots[3][i].courseId || !slots[3][i].priority) return "Slot 3: si está habilitado, las 3 clases y prioridades son obligatorias";
      }
    }
    // duplicate courses across all enabled slots
    const allIds: string[] = [];
    allIds.push(...slots[1].map((o) => o.courseId));
    if (enabledSlot2) allIds.push(...slots[2].map((o) => o.courseId));
    if (enabledSlot3) allIds.push(...slots[3].map((o) => o.courseId));
    if (new Set(allIds).size !== allIds.length) return "No se puede repetir la misma materia en diferentes slots";
    // duplicate within slot already covered but also check
    for (const sn of [1, 2, 3] as const) {
      if (sn === 2 && !enabledSlot2) continue;
      if (sn === 3 && !enabledSlot3) continue;
      const ids = slots[sn].map((o) => o.courseId);
      if (new Set(ids).size !== ids.length) return `Slot ${sn}: materias duplicadas dentro del mismo slot`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const err = validateClient();
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }
    setLoading(true);
    const payloadSlots = [];
    // Slot 1 always
    payloadSlots.push({
      slot_no: 1,
      options: slots[1].map((o) => ({ courseId: Number(o.courseId), priority: Number(o.priority) })),
    });
    if (enabledSlot2) {
      payloadSlots.push({
        slot_no: 2,
        options: slots[2].map((o) => ({ courseId: Number(o.courseId), priority: Number(o.priority) })),
      });
    }
    if (enabledSlot3) {
      payloadSlots.push({
        slot_no: 3,
        options: slots[3].map((o) => ({ courseId: Number(o.courseId), priority: Number(o.priority) })),
      });
    }

    try {
      const res = await fetch("/api/petitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, semesterId: Number(semesterId), slots: payloadSlots }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Error al guardar" });
      } else {
        setMessage({ type: "ok", text: `Guardado correctamente: ${data.slots.length} slot(s)` });
      }
    } catch (e) {
      setMessage({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const renderSlot = (slotNo: 1 | 2 | 3, enabled: boolean, setEnabled?: (v: boolean) => void) => {
    const isRequired = slotNo === 1;
    const title = `Solicitud ${slotNo} ${isRequired ? "(Obligatoria - 3 materias)" : "(Opcional - si se habilita, 3 materias)"}`;
    return (
      <div className={`border rounded-lg p-4 bg-white ${!enabled && !isRequired ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          {!isRequired && setEnabled && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Habilitado
            </label>
          )}
        </div>
        <div className="grid gap-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 items-end border rounded p-2 bg-zinc-50">
              <div>
                <label className="text-xs font-medium">Materia {idx + 1}</label>
                <select
                  disabled={!enabled && !isRequired}
                  value={slots[slotNo][idx].courseId}
                  onChange={(e) => updateOption(slotNo, idx, "courseId", e.target.value)}
                  className="w-full border rounded px-2 py-1.5 bg-white text-sm"
                >
                  <option value="">-- seleccione --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.code} - {c.name} | Cupo:{c.cupo ?? "-"} | {c.dias ?? "-"} {c.horario ?? ""} | {c.ubicacion ?? "-"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Prioridad *</label>
                <select
                  disabled={!enabled && !isRequired}
                  value={slots[slotNo][idx].priority}
                  onChange={(e) => updateOption(slotNo, idx, "priority", e.target.value)}
                  className="w-full border rounded px-2 py-1.5 bg-white text-sm"
                >
                  <option value="">--</option>
                  <option value="1">1 - Alta</option>
                  <option value="2">2 - Media</option>
                  <option value="3">3 - Baja</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-2">Prioridades pueden repetirse (ej. 1,1,2 significa dos materias con igual preferencia máxima).</p>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Peticiones de Asignación</h1>
        <p className="text-sm text-zinc-600">Identifícate con tu email. Slot 1 obligatorio con 3 materias. Slots 2 y 3 opcionales, pero si se habilitan deben tener 3 materias cada uno.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4 border rounded-lg p-4 bg-white">
          <div>
            <label className="text-sm font-medium">Email (identificación) *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="docente@uni.edu" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Semestre *</label>
            <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
              {semesters.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.label} {s.isActive ? "(Activo)" : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleLoad} disabled={loading} className="mt-2 text-xs px-3 py-1 rounded bg-zinc-100 hover:bg-zinc-200 border">
              Cargar mis peticiones
            </button>
          </div>
        </div>

        {message && (
          <div className={`px-4 py-2 rounded text-sm ${message.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {renderSlot(1, true)}
        {renderSlot(2, enabledSlot2, setEnabledSlot2)}
        {renderSlot(3, enabledSlot3, setEnabledSlot3)}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="px-6 py-2 rounded bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
            {loading ? "Guardando..." : "Guardar peticiones"}
          </button>
          <button type="button" onClick={() => { setSlots({ 1: emptyOptions(), 2: emptyOptions(), 3: emptyOptions() }); setEnabledSlot2(false); setEnabledSlot3(false); }} className="px-6 py-2 rounded border bg-white hover:bg-zinc-50">
            Limpiar
          </button>
        </div>
        <p className="text-xs text-zinc-500">Total materias a guardar: {enabledSlot3 ? 9 : enabledSlot2 ? 6 : 3} (3 x slot habilitado). Prioridad requerida por materia, duplicados permiten empates.</p>
      </form>
    </main>
  );
}
