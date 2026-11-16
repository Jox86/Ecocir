#!/usr/bin/env bash
# =============================================================================
# 01 — TESTING DEL SITIO
# Verifica que la entrada del sitio, sus rutas y todas las interfaces responden
# correctamente (ver detalles en scripts/testing.sh).
#
# Uso:      ./01-testing.sh [--estricto]
# Ejemplo:  BASE_URL=http://192.168.1.50:8080 ./01-testing.sh
# =============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${DIR}/scripts/testing.sh" "$@"
