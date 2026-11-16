#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LIMPIEZA — ELIMINA LOS DATOS SIMULADOS DE TODAS LAS INTERFACES

Elimina, interfaz por interfaz, los registros creados por
scripts/simular-datos.py:

  1. Por el manifiesto datos-simulados-manifiesto.json (ids conocidos).
  2. Si no hay id en el manifiesto, por barrido de seguridad: consulta la
     ruta de la interfaz y elimina los registros cuyo campo marcador
     comience por "[SIM]".

IMPORTANTE: este comando NO se ejecuta nunca de forma automática. En
scripts/simular-datos.py y en 03-simular-datos.sh aparece COMENTADO; aquí se
pide confirmación explícita con --confirmar.

Uso:
    ./scripts/eliminar-datos-simulados.py            # simulación (dry-run): solo muestra
    ./scripts/eliminar-datos-simulados.py --confirmar  # elimina de verdad
Opciones:
    --base-url URL · --config RUTA · --manifiesto RUTA · --solo ID1,ID2
Códigos de salida: 0 = limpieza completada · 1 = error
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

KIT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DEFECTO = KIT_DIR / "config" / "interfaces.json"
MANIFIESTO_DEFECTO = KIT_DIR / "datos-simulados-manifiesto.json"
PREFIJO_MARCADOR = "[SIM]"
LIMITE_BARRIDO = 2000


def ruta_completa(base_url: str, ruta: str) -> str:
    base = base_url.rstrip("/")
    if not ruta.startswith("/"):
        ruta = "/" + ruta
    return base + ruta


def peticion(metodo: str, url: str, timeout: int = 15):
    req = urllib.request.Request(url, method=metodo,
                                 headers={"Accept": "application/json",
                                          "User-Agent": "limpieza-datos/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return 0, str(e)


def listar_registros(cuerpo: str):
    """Extrae la lista de registros de una respuesta de consulta (directa o anidada)."""
    try:
        obj = json.loads(cuerpo)
    except (json.JSONDecodeError, ValueError):
        return []
    if isinstance(obj, list):
        return [r for r in obj if isinstance(r, dict)]
    if isinstance(obj, dict):
        for clave in ("data", "items", "resultados", "results", "registros", "records"):
            v = obj.get(clave)
            if isinstance(v, list):
                return [r for r in v if isinstance(r, dict)]
        # algunas APIs devuelven {"id": ..., ...} único
        return [obj] if obj.get("id") is not None else []
    return []


def ids_por_barrido(base_url, interfaz) -> list:
    """Consulta la interfaz y devuelve los ids cuyo marcador empieza por [SIM]."""
    ruta_consulta = interfaz.get("rutaConsulta")
    if not ruta_consulta:
        return []
    campo_id = interfaz.get("campoId", "id")
    campo_marcador = interfaz.get("campoMarcador", "nombre")
    estado, cuerpo = peticion("GET", ruta_completa(base_url, ruta_consulta))
    if not (200 <= estado < 300):
        return []
    ids = []
    for registro in listar_registros(cuerpo)[:LIMITE_BARRIDO]:
        marcador = str(registro.get(campo_marcador, ""))
        if marcador.startswith(PREFIJO_MARCADOR):
            rid = registro.get(campo_id, registro.get("id"))
            if rid is not None:
                ids.append(rid)
    return ids


def main():
    ap = argparse.ArgumentParser(
        description="Elimina los datos simulados de todas las interfaces (prefijo [SIM]).")
    ap.add_argument("--confirmar", action="store_true",
                    help="elimina realmente; sin esta opción solo muestra lo que haría")
    ap.add_argument("--config", default=str(CONFIG_DEFECTO))
    ap.add_argument("--manifiesto", default=str(MANIFIESTO_DEFECTO))
    ap.add_argument("--base-url", default=None)
    ap.add_argument("--solo", default=None, help="ids de interfaz separados por coma")
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    base_url = (args.base_url or os.environ.get("BASE_URL")
                or cfg.get("sitio", {}).get("baseUrl") or "http://localhost:8080").rstrip("/")

    manifiesto = {}
    if Path(args.manifiesto).exists():
        try:
            manifiesto = json.loads(Path(args.manifiesto).read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass

    seleccion = set(args.solo.split(",")) if args.solo else None
    interfaces = [i for i in cfg.get("interfaces", [])
                  if (seleccion is None or i["id"] in seleccion)]

    modo = "ELIMINACIÓN REAL" if args.confirmar else "SIMULACIÓN (dry-run; añade --confirmar para eliminar)"
    print("═" * 68)
    print(f" LIMPIEZA DE DATOS SIMULADOS — {base_url}")
    print(f" Modo: {modo}")
    print("═" * 68)

    total_eliminados = total_errores = 0
    plan = []
    for interfaz in interfaces:
        ruta_eliminar = interfaz.get("rutaEliminar")
        if not ruta_eliminar:
            continue
        iid = interfaz["id"]
        entrada_manifiesto = manifiesto.get("interfaces", {}).get(iid, [])
        ids = [e.get("id") for e in entrada_manifiesto if e.get("id") is not None]
        origen = "manifiesto"
        barrido = ids_por_barrido(base_url, interfaz)
        if not ids and barrido:
            ids, origen = barrido, "barrido por prefijo [SIM]"
        elif barrido:
            ids = sorted({str(i) for i in ids} | {str(i) for i in barrido})
            origen = "manifiesto + barrido"
        if not ids:
            print(f" · {interfaz.get('nombre', iid):<28} sin datos simulados registrados")
            continue
        plan.append((interfaz, ids, origen))
        print(f" · {interfaz.get('nombre', iid):<28} {len(ids)} registros a eliminar (fuente: {origen})")

    if not plan:
        print("\nNo se encontraron datos simulados que eliminar. Nada que hacer.")
        sys.exit(0)

    if not args.confirmar:
        print("\n>> DRY-RUN: no se ha eliminado nada.")
        print(">> Ejecuta de nuevo con --confirmar para eliminar realmente los registros.")
        sys.exit(0)

    print("─" * 68)
    for interfaz, ids, origen in plan:
        iid = interfaz["id"]
        nombre = interfaz.get("nombre", iid)
        eliminados = errores = 0
        for rid in ids:
            ruta = interfaz["rutaEliminar"].replace("{id}", urllib.parse.quote(str(rid), safe=""))
            estado, _ = peticion("DELETE", ruta_completa(base_url, ruta))
            if 200 <= estado < 300:
                eliminados += 1
            else:
                errores += 1
        total_eliminados += eliminados
        total_errores += errores
        print(f" ✓ {nombre:<28} eliminados: {eliminados} · errores: {errores}")

    print("─" * 68)
    print(f" Limpieza terminada ({datetime.now():%Y-%m-%d %H:%M:%S}): "
          f"{total_eliminados} registros eliminados · {total_errores} errores.")
    if total_errores:
        print("   Los registros con error conservan el prefijo [SIM]; puedes reintentar.")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
