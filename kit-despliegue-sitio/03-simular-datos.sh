#!/usr/bin/env bash
# =============================================================================
# 03 — SIMULACIÓN DE DATOS EN TODAS LAS INTERFACES
# Crea datos de prueba a través de la API de cada interfaz definida en
# config/interfaces.json (usuarios, noticias, eventos, comentarios, contacto,
# documentos, ...). Los registros llevan el prefijo [SIM].
# (Ver detalles en scripts/simular-datos.py.)
#
# Uso:      ./03-simular-datos.sh [opciones]
# Ejemplos: BASE_URL=http://localhost:8080 ./03-simular-datos.sh
#           ./03-simular-datos.sh --cantidad 50
#
# ────────────────────────────────────────────────────────────────────────────
# COMANDO PARA ELIMINAR LOS DATOS SIMULADOS DE TODAS LAS INTERFACES
# (dejado COMENTADO a propósito; descomenta y ejecuta cuando quieras limpiar):
#
#   # ./scripts/eliminar-datos-simulados.py --confirmar
# ────────────────────────────────────────────────────────────────────────────
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${DIR}/scripts/simular-datos.py" "$@"
