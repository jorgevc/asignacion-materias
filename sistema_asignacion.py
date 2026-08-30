"""
Sistema Dinámico de Asignación - Opción 2 (reescritura clara)
Guía: Guía del Sistema Dinámico de Asignación.txt
4 factores: base + desplazamiento + flexibilidad + experiencia
"""
from dataclasses import dataclass
from enum import IntEnum


class Prioridad(IntEnum):
    P1 = 1
    P2 = 2
    P3 = 3


# Constantes según Guía
PUNTOS_BASE = {
    Prioridad.P1: 100,
    Prioridad.P2: 60,
    Prioridad.P3: 30,
}
BONO_DESPLAZAMIENTO = 100  # Guía.txt:9
BONO_FLEX_ULTIMA = 30      # Guía.txt:11 premio
PENALIZACION_FLEX_CON_RESPALDO = -15  # cede paso
MAX_EXP = 10               # Guía.txt:8


@dataclass(frozen=True)
class Solicitud:
    prioridad: Prioridad
    exp_anos: int = 0
    perdio_p1: bool = False
    perdio_p2: bool = False


@dataclass(frozen=True)
class ContextoNivel:
    total_opciones: int  # num materias en ese nivel de prioridad
    es_ultima: bool      # si es la última materia restante del nivel


def puntos_base(p: Prioridad) -> int:
    if p not in PUNTOS_BASE:
        raise ValueError(f"prioridad debe ser 1,2,3, recibido {p}")
    return PUNTOS_BASE[p]


def bono_desplazamiento(s: Solicitud, flex_prev_perdida: bool = False) -> int:
    """Guía.txt:9 protección + Nota 2 flex desplazado +30 si prev flexible perdida"""
    base = 0
    if s.prioridad == Prioridad.P2 and s.perdio_p1:
        base = BONO_DESPLAZAMIENTO
    if s.prioridad == Prioridad.P3 and (s.perdio_p1 or s.perdio_p2):
        base = BONO_DESPLAZAMIENTO
    flex_desplazado = BONO_FLEX_ULTIMA if flex_prev_perdida else 0
    return base + flex_desplazado


def ajuste_flexibilidad(c: ContextoNivel) -> int:
    """Guía.txt:10-11 independiente del bono, para cualquier nivel con >1 opciones"""
    if c.total_opciones <= 1:
        return 0
    return BONO_FLEX_ULTIMA if c.es_ultima else PENALIZACION_FLEX_CON_RESPALDO


def puntos_experiencia(anos: int) -> int:
    """Guía.txt:8 +1 por año, tope 10"""
    try:
        a = int(anos or 0)
    except (TypeError, ValueError):
        a = 0
    return min(max(a, 0), MAX_EXP)


def calcular_puntaje(solicitud: Solicitud, contexto: ContextoNivel, flex_prev_perdida: bool = False) -> int:
    """Suma 4 factores + flex desplazado intra-slot"""
    return (
        puntos_base(solicitud.prioridad)
        + bono_desplazamiento(solicitud, flex_prev_perdida)
        + ajuste_flexibilidad(contexto)
        + puntos_experiencia(solicitud.exp_anos)
    )


def calcular_puntaje_detalle(solicitud: Solicitud, contexto: ContextoNivel, flex_prev_perdida: bool = False) -> dict:
    """Útil para auditar / tests"""
    base = puntos_base(solicitud.prioridad)
    desp = bono_desplazamiento(solicitud, flex_prev_perdida)
    flex = ajuste_flexibilidad(contexto)
    exp = puntos_experiencia(solicitud.exp_anos)
    return {"base": base, "desplazamiento": desp, "flexibilidad": flex, "experiencia": exp, "total": base+desp+flex+exp, "flex_prev_perdida": flex_prev_perdida}


if __name__ == "__main__":
    # Demo
    casos = [
        (Solicitud(Prioridad.P1, 5, False, False), ContextoNivel(3, False)),
        (Solicitud(Prioridad.P2, 5, True, False), ContextoNivel(3, False)),
        (Solicitud(Prioridad.P2, 5, True, False), ContextoNivel(3, True)),
        (Solicitud(Prioridad.P3, 5, True, True), ContextoNivel(2, True)),
    ]
    for s, c in casos:
        print(s, c, "->", calcular_puntaje_detalle(s, c))
