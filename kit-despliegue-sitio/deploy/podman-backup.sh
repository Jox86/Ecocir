#!/usr/bin/env bash
# =============================================================================
# Copia de seguridad de la base de datos y de los archivos subidos al sitio.
# Ejecuta la copia EN CALIENTE (sqlite3 .backup) sin detener el contenedor y
# guarda todo en <raíz-del-kit>/backups/. Aplica retención automática.
#
# Uso:
#   ./deploy/podman-backup.sh
# Variables opcionales:
#   NOMBRE             contenedor (sitio-web)
#   RETENCION_DB       nº de copias de base de datos a conservar (30 por defecto)
#   RETENCION_ARCHIVOS nº de copias de archivos subidos a conservar (4 por defecto)
#
# Se recomienda programarlo a diario con cron/systemd-timer. Ver README.md.
# =============================================================================
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOMBRE="${NOMBRE:-sitio-web}"
RETENCION_DB="${RETENCION_DB:-30}"
RETENCION_ARCHIVOS="${RETENCION_ARCHIVOS:-4}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="${KIT_DIR}/backups/${STAMP}"

if ! podman ps --format '{{.Names}}' | grep -qx "${NOMBRE}"; then
    echo "ERROR: el contenedor '${NOMBRE}' no está en ejecución." >&2
    exit 1
fi

mkdir -p "${DEST}"

echo ">> Copia en caliente de la base de datos (sqlite3 .backup)..."
podman exec "${NOMBRE}" sh -c 'mkdir -p /tmp/bak && sqlite3 /app/db/custom.db ".backup /tmp/bak/db.sqlite"'
podman cp "${NOMBRE}:/tmp/bak/db.sqlite" "${DEST}/db.sqlite"
podman exec "${NOMBRE}" sh -c 'rm -rf /tmp/bak'
gzip -f "${DEST}/db.sqlite"

echo ">> Empaquetando archivos públicos subidos (app/public)..."
podman exec "${NOMBRE}" tar czf /tmp/uploads.tgz -C /app public
podman cp "${NOMBRE}:/tmp/uploads.tgz" "${DEST}/uploads.tgz"
podman exec "${NOMBRE}" rm -f /tmp/uploads.tgz

echo ">> Aplicando retención: ${RETENCION_DB} copias de BD y ${RETENCION_ARCHIVOS} de archivos..."
ls -1t "${KIT_DIR}"/backups/*/db.sqlite.gz      2>/dev/null | tail -n +"$((RETENCION_DB + 1))" | xargs -r rm -f
ls -1t "${KIT_DIR}"/backups/*/uploads.tgz       2>/dev/null | tail -n +"$((RETENCION_ARCHIVOS + 1))" | xargs -r rm -f
find "${KIT_DIR}/backups" -mindepth 1 -type d -empty -delete

echo "✅ Copia de seguridad completada en: ${DEST}"
du -sh "${DEST}"
