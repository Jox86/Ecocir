#!/usr/bin/env bash
# =============================================================================
# Seguimiento de logs del contenedor del sitio (Podman, sin Docker).
# Uso:
#   ./deploy/podman-logs.sh            # sigue los logs en vivo (Ctrl+C para salir)
#   ./deploy/podman-logs.sh --colas    # muestra las últimas 200 líneas y sale
# =============================================================================
set -euo pipefail
NOMBRE="${NOMBRE:-sitio-web}"

if [ "${1:-}" = "--colas" ]; then
    podman logs --tail 200 "${NOMBRE}"
else
    podman logs -f "${NOMBRE}"
fi
