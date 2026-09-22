export enum Prioridad {
  P1 = 1,
  P2 = 2,
  P3 = 3,
}

export const PUNTOS_BASE: Record<Prioridad, number> = {
  [Prioridad.P1]: 100,
  [Prioridad.P2]: 60,
  [Prioridad.P3]: 30,
};

export const BONO_DESPLAZAMIENTO = 40; // Nivelador P2: 60 + 40 = 100 (mismo piso que P1)
export const BONO_DESPLAZAMIENTO_P3 = 70; // Nivelador P3: 30 + 70 = 100 si perdió P1/P2
export const BONO_FLEX_ULTIMA = 30;
export const PENALIZACION_FLEX_CON_RESPALDO = -15;
export const MAX_EXP = 8; // Máximo 8 puntos (1 punto por cada periodo impartido en los últimos 4 años)

export type Solicitud = {
  prioridad: Prioridad;
  expPeriodos: number; // Número de periodos impartidos en los últimos 4 años
  expAnos?: number; // Compatibilidad legacy
  perdioP1: boolean;
  perdioP2: boolean;
};

export type ContextoNivel = {
  totalOpciones: number;
  esUltima: boolean;
};

export function puntosBase(p: Prioridad): number {
  const v = PUNTOS_BASE[p];
  if (v === undefined) throw new Error(`prioridad debe ser 1,2,3, recibido ${p}`);
  return v;
}

export function bonoDesplazamiento(s: Solicitud, flexPrevPerdida = false): number {
  let base = 0;
  if (s.prioridad === Prioridad.P2 && s.perdioP1) base = BONO_DESPLAZAMIENTO;
  if (s.prioridad === Prioridad.P3 && (s.perdioP1 || s.perdioP2)) base = BONO_DESPLAZAMIENTO_P3;
  const flexDesplazado = flexPrevPerdida ? BONO_FLEX_ULTIMA : 0;
  return base + flexDesplazado;
}

export function ajusteFlexibilidad(c: ContextoNivel): number {
  if (c.totalOpciones <= 1) return 0;
  return c.esUltima ? BONO_FLEX_ULTIMA : PENALIZACION_FLEX_CON_RESPALDO;
}

export function puntosExperiencia(periodos: number): number {
  const p = Number(periodos ?? 0);
  if (Number.isNaN(p)) return 0;
  // +1 punto por cada periodo impartido en los últimos 4 años, tope MAX_EXP (8 puntos)
  return Math.min(Math.max(Math.trunc(p), 0), MAX_EXP);
}

export function calcularPuntaje(solicitud: Solicitud, contexto: ContextoNivel, flexPrevPerdida = false): number {
  const expVal = solicitud.expPeriodos ?? solicitud.expAnos ?? 0;
  return (
    puntosBase(solicitud.prioridad) +
    bonoDesplazamiento(solicitud, flexPrevPerdida) +
    ajusteFlexibilidad(contexto) +
    puntosExperiencia(expVal)
  );
}

export function calcularPuntajeDetalle(solicitud: Solicitud, contexto: ContextoNivel, flexPrevPerdida = false) {
  const expVal = solicitud.expPeriodos ?? solicitud.expAnos ?? 0;
  const base = puntosBase(solicitud.prioridad);
  const desp = bonoDesplazamiento(solicitud, flexPrevPerdida);
  const flex = ajusteFlexibilidad(contexto);
  const exp = puntosExperiencia(expVal);
  return { base, desplazamiento: desp, flexibilidad: flex, experiencia: exp, periodos: expVal, total: base + desp + flex + exp, flexPrevPerdida };
}
