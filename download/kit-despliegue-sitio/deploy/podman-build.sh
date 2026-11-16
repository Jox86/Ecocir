#!/usr/bin/env bash
# =============================================================================
# Construcción de la imagen del sitio con PODMAN (el servidor institucional no
# permite Docker; Podman es compatible con la misma sintaxis y no necesita
# demonio, y puede ejecutarse como usuario sin privilegios — rootless).
#
# Uso:
#   APP_DIR=/ruta/al/codigo-del-sitio ./deploy/podman-build.sh
#
# Variables de entorno opcionales:
#   APP_DIR   carpeta con el código fuente del sitio (obligatoria)
#   IMAGEN    nombre:etiqueta de la imagen (por defecto localhost/sitio-web:latest)
# =============================================================================
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # raíz del kit
DEPLOY_DIR="${KIT_DIR}/deploy"

APP_DIR="${APP_DIR:-}"
IMAGEN="${IMAGEN:-localhost/sitio-web:latest}"

if [ -z "${APP_DIR}" ]; then
    echo "ERROR: define APP_DIR con la ruta del código del sitio." >&2
    echo "       Ejemplo:  APP_DIR=/srv/sitio ./deploy/podman-build.sh" >&2
    exit 1
fi

if [ ! -f "${APP_DIR}/package.json" ]; then
    echo "ERROR: no se encontró package.json en '${APP_DIR}'." >&2
    exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
    echo "ERROR: podman no está instalado. Instálalo con:" >&2
    echo "   RHEL/Alma/Rocky:  sudo dnf install podman" >&2
    echo "   Debian/Ubuntu:    sudo apt install podman" >&2
    exit 1
fi

echo ">> Verificando que podman puede ejecutarse rootless..."
podman info >/dev/null

# El entrypoint debe estar DENTRO del contexto de construcción
cp "${DEPLOY_DIR}/container-entrypoint.sh" "${APP_DIR}/.container-entrypoint.sh"

# Ignora archivos innecesarios en el contexto (acelera y asegura la compilación)
if [ ! -f "${APP_DIR}/.containerignore" ]; then
    cp "${DEPLOY_DIR}/containerignore.ejemplo" "${APP_DIR}/.containerignore"
    echo ">> Creado ${APP_DIR}/.containerignore (ajústalo si lo necesitas)."
fi

trap 'rm -f "${APP_DIR}/.container-entrypoint.sh"' EXIT

echo ">> Construyendo imagen ${IMAGEN} desde ${APP_DIR} ..."
podman build \
    --format docker \
    -f "${DEPLOY_DIR}/Containerfile" \
    -t "${IMAGEN}" \
    "${APP_DIR}"

echo ""
echo "✅ Imagen construida: ${IMAGEN}"
podman images "${IMAGEN%%:*}"
echo ""
echo "Siguiente paso:  ./deploy/podman-run.sh"
