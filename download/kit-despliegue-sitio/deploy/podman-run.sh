#!/usr/bin/env bash
# =============================================================================
# Arranque del sitio como contenedor Podman (rootless, sin Docker).
#   - Crea el volumen persistente de la base de datos si no existe.
#   - Publica el sitio en http://localhost:${PUERTO_HOST} (por defecto 8080).
#   - Reinicio automático ante caídas (--restart unless-stopped).
#
# Uso:
#   ./deploy/podman-run.sh
# Variables opcionales:
#   PUERTO_HOST   puerto del host que publicará el sitio (8080 por defecto)
#   IMAGEN        imagen construida (localhost/sitio-web:latest por defecto)
#   NOMBRE        nombre del contenedor (sitio-web por defecto)
#
# Para producción con arranque automático al encender el servidor, usa el
# archivo quadlet de deploy/quadlet/sitio-web.container (ver README.md).
# =============================================================================
set -euo pipefail

IMAGEN="${IMAGEN:-localhost/sitio-web:latest}"
NOMBRE="${NOMBRE:-sitio-web}"
PUERTO_HOST="${PUERTO_HOST:-8080}"
VOLUMEN_DB="${VOLUMEN_DB:-sitio-db-data}"

if ! command -v podman >/dev/null 2>&1; then
    echo "ERROR: podman no está instalado." >&2
    exit 1
fi

if podman ps -a --format '{{.Names}}' | grep -qx "${NOMBRE}"; then
    echo "ERROR: ya existe un contenedor llamado '${NOMBRE}'." >&2
    echo "       Detente y elimínalo primero:  ./deploy/podman-stop.sh" >&2
    exit 1
fi

# Volumen nombrado: la base de datos SQLite sobrevive a reinicios y cambios de imagen
if ! podman volume exists "${VOLUMEN_DB}"; then
    podman volume create "${VOLUMEN_DB}"
    echo ">> Volumen de base de datos creado: ${VOLUMEN_DB}"
fi

# ":Z" aplica la etiqueta SELinux necesaria en servidores RHEL/Alma/Rocky
podman run -d \
    --name "${NOMBRE}" \
    --restart unless-stopped \
    -p "${PUERTO_HOST}:3000" \
    -v "${VOLUMEN_DB}:/app/db:Z" \
    -e "DATABASE_URL=file:/app/db/custom.db" \
    -e "NODE_ENV=production" \
    "${IMAGEN}"

echo ""
echo "✅ Contenedor '${NOMBRE}' en ejecución."
echo "   Sitio:            http://localhost:${PUERTO_HOST}"
echo "   Base de datos:    volumen ${VOLUMEN_DB} → /app/db (persistente)"
echo "   Ver logs:         ./deploy/podman-logs.sh"
echo "   Detener:          ./deploy/podman-stop.sh"
