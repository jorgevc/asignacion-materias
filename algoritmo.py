def calcular_peso(prioridad, num_opciones_nivel, es_ultima_opcion_nivel, perdio_p1, perdio_p2, exp_años):
    base_map = {1: 100, 2: 60, 3: 30}
    p_base = base_map.get(prioridad, 0)
    
    p_desplazamiento = 0
    p_flexibilidad = 0
    
    # Lógica para P2 tras haber perdido P1
    if perdio_p1 and prioridad == 2:
        if num_opciones_nivel > 1 and not es_ultima_opcion_nivel:
            # Caso: Tiene alternativas en P2 -> Bono diferido para NO desplazar a P1
            p_desplazamiento = 20
            p_flexibilidad = -15
        else:
            # Caso: Es su última P2 (o era rígido) -> Bono de nivelación para competir con P1 por méritos
            p_desplazamiento = 40
            if num_opciones_nivel > 1 and es_ultima_opcion_nivel:
                p_flexibilidad = 30

    p_experiencia = min(max(exp_años, 0), 10)
    
    return p_base + p_desplazamiento + p_flexibilidad + p_experiencia