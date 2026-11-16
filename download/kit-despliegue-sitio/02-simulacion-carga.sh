#!/usr/bin/env bash
# =============================================================================
# 02 — SIMULACIÓN DE CARGA: ENTRADA AL SITIO CON 100 USUARIOS (MÍNIMO) A LA VEZ
# 100 usuarios simultáneos navegan el sitio durante 60 s con rampa progresiva
# de 15 s. Al final emite el veredicto APTO / NO APTO y guarda un informe JSON
# en reportes/. (Ver detalles en scripts/simulacion-carga-100-usuarios.py.)
#
# Uso:      ./02-simulacion-carga.sh [opciones]
# Ejemplos: BASE_URL=http://localhost:8080 ./02-simulacion-carga.sh
#           ./02-simulacion-carga.sh --usuarios 150 --duracion 120
# =============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${DIR}/scripts/simulacion-carga-100-usuarios.py" "$@"
