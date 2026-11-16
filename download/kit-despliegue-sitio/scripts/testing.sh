#!/usr/bin/env bash
# =============================================================================
# 01 — TESTING DEL SITIO
# Verifica que el sitio desplegado responde correctamente:
#   1. Página de entrada (GET /)
#   2. Endpoint de salud si existe (/api/health) — opcional
#   3. Rutas de verificación (config/interfaces.json → "rutasVerificacion")
#   4. Consulta (GET) de cada interfaz definida en la configuración
#   5. Umbrales de latencia individual
#
# Uso:
#   ./scripts/testing.sh [--estricto]
#     --estricto : cualquier 404 cuenta como fallo (por defecto solo avisa)
# Variables:
#   BASE_URL   http://localhost:8080 (o el que esté en config/interfaces.json)
#   CONFIG     ruta alternativa del archivo de configuración
#
# Códigos de salida: 0 = todo OK o solo avisos · 1 = al menos un FALLO
# =============================================================================
set -uo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CONFIG:-${KIT_DIR}/config/interfaces.json}"
ESTRICTO=0
[ "${1:-}" = "--estricto" ] && ESTRICTO=1

if ! command -v curl >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: se requieren curl y python3 en el equipo desde donde se ejecuta el testing." >&2
    exit 1
fi
if [ ! -f "${CONFIG}" ]; then
    echo "ERROR: no existe el archivo de configuración ${CONFIG}" >&2
    exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

BASE_URL="${BASE_URL:-$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["sitio"]["baseUrl"])' "${CONFIG}")}"
python3 - "$CONFIG" "${TMP}" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
salud = cfg["sitio"].get("endpointSalud") or ""
with open(sys.argv[2] + "/salud.txt", "w") as f:
    f.write(salud)
with open(sys.argv[2] + "/rutas.txt", "w") as f:
    for r in cfg.get("rutasVerificacion", []):
        f.write(r + "\n")
    for i in cfg.get("interfaces", []):
        if i.get("rutaConsulta"):
            f.write(i["rutaConsulta"] + "\n")
u = cfg.get("umbrales", {})
with open(sys.argv[2] + "/umbrales.txt", "w") as f:
    f.write(str(int(u.get("latenciaMaxMs", 2000))))
PY
UMBRAL_MS="$(cat "${TMP}/umbrales.txt")"
SALUD="$(cat "${TMP}/salud.txt")"

# Colores solo si la salida es una terminal
if [ -t 1 ]; then
    VERDE='\033[1;32m'; ROJO='\033[1;31m'; AMAR='\033[1;33m'; AZUL='\033[1;34m'; NEUTRO='\033[0m'
else
    VERDE=''; ROJO=''; AMAR=''; AZUL=''; NEUTRO=''
fi

OK=0; AVISO=0; FALLO=0
veredicto() { echo -e "   ${1}${2}${NEUTRO}"; }

# check <etiqueta> <url_completa> <marca_404_como_aviso: sí|no>
check() {
    local etiqueta="$1" url="$2" marca="$3" salida codigo ms
    salida="$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' --max-time 15 "${url}" 2>"${TMP}/err" || true)"
    if [ -z "${salida}" ] || [ "${salida%% *}" = "000" ]; then
        veredicto "${ROJO}" "✗ FALLO   ${etiqueta} (${url}) — sin respuesta: $(tr -d '\n' <"${TMP}/err")"
        FALLO=$((FALLO + 1)); return
    fi
    codigo="${salida%% *}"; ms="$(awk -v s="${salida#* }" 'BEGIN{printf "%d", s*1000}')"
    if [ "${codigo}" -ge 200 ] && [ "${codigo}" -lt 400 ]; then
        if [ "${ms}" -gt "${UMBRAL_MS}" ]; then
            veredicto "${AMAR}" "△ AVISO   ${etiqueta} (${url}) — HTTP ${codigo} pero lenta: ${ms} ms (umbral ${UMBRAL_MS} ms)"
            AVISO=$((AVISO + 1))
        else
            veredicto "${VERDE}" "✓ OK      ${etiqueta} (${url}) — HTTP ${codigo}, ${ms} ms"
            OK=$((OK + 1))
        fi
    elif [ "${codigo}" = "404" ] && [ "${marca}" = "aviso" ] && [ "${ESTRICTO}" = "0" ]; then
        veredicto "${AMAR}" "△ AVISO   ${etiqueta} (${url}) — HTTP 404: la ruta no existe en este sitio; ajusta config/interfaces.json"
        AVISO=$((AVISO + 1))
    else
        veredicto "${ROJO}" "✗ FALLO   ${etiqueta} (${url}) — HTTP ${codigo}"
        FALLO=$((FALLO + 1))
    fi
}

echo -e "${AZUL}════════════════════════════════════════════════════════════════${NEUTRO}"
echo -e "${AZUL} TESTING DEL SITIO — ${BASE_URL}${NEUTRO}"
echo -e "${AZUL}════════════════════════════════════════════════════════════════${NEUTRO}"

# 1) Entrada del sitio (obligatoria)
check "Página de entrada" "${BASE_URL}/" "fallo"

# 2) Endpoint de salud (opcional: 404 → aviso)
if [ -n "${SALUD}" ]; then
    check "Endpoint de salud (${SALUD})" "${BASE_URL}${SALUD}" "aviso"
fi

# 3) Rutas de verificación (404 → aviso salvo --estricto)
while IFS= read -r ruta; do
    [ -z "${ruta}" ] && continue
    check "Ruta ${ruta}" "${BASE_URL}${ruta}" "aviso"
    echo "${ruta}" >> "${TMP}/verificadas"
done < "${TMP}/rutas.txt"

# 4) Interfaces (GET de consulta; se omite si la ruta ya fue verificada arriba)
while IFS= read -r ruta; do
    [ -z "${ruta}" ] && continue
    if grep -qxF "${ruta}" "${TMP}/verificadas" 2>/dev/null; then continue; fi
    check "Interfaz ${ruta}" "${BASE_URL}${ruta}" "aviso"
done < "${TMP}/rutas.txt"

echo -e "${AZUL}────────────────────────────────────────────────────────────────${NEUTRO}"
echo -e " Resumen:  ${VERDE}${OK} OK${NEUTRO} · ${AMAR}${AVISO} avisos${NEUTRO} · ${ROJO}${FALLO} fallos${NEUTRO}"
if [ "${FALLO}" -gt 0 ]; then
    echo -e " ${ROJO}RESULTADO: NO APTO — corrige los fallos antes de pasar a producción.${NEUTRO}"
    exit 1
fi
echo -e " ${VERDE}RESULTADO: APTO${NEUTRO} (avisos = rutas opcionales que faltan configurar en el sitio)"
exit 0
