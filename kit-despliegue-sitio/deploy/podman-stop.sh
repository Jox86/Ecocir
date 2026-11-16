#!/usr/bin/env bash
# =============================================================================
# Detención y limpieza del contenedor del sitio (Podman, sin Docker).
#
# Uso:
#   ./deploy/podman-stop.sh            # detiene y elimina el contenedor
#   ./deploy/podman-stop.sh --todo     # además elimina el volumen con la BD
#                                      # ¡Pérdida de datos! Úsalo solo para
#                                      # rehacer el entorno desde cero.
# =============================================================================
set -euo pipefail

NOMBRE="${NOMBRE:-sitio-web}"
VOLUMEN_DB="${VOLUMEN_DB:-sitio-db-data}"

if podman ps -a --format '{{.Names}}' | grep -qx "${NOMBRE}"; then
    echo ">> Deteniendo contenedor '${NOMBRE}'..."
    podman stop -t 20 "${NOMBRE}"
    echo ">> Eliminando contenedor '${NOMBRE}'..."
    podman rm "${NOMBRE}"
else
    echo ">> No hay ningún contenedor llamado '${NOMBRE}'."
fi

if [ "${1:-}" = "--todo" ]; then
    if podman volume exists "${VOLUMEN_DB}"; then
        echo ">> Eliminando volumen de base de datos '${VOLUMEN_DB}' (¡borra todos los datos!)..."
        podman volume rm "${VOLUMEN_DB}"
    fi
fi

echo "✅ Listo."
