#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
03 — SIMULACIÓN DE DATOS EN TODAS LAS INTERFACES DEL SITIO

Genera datos de prueba (usuarios, noticias, eventos, comentarios, mensajes de
contacto, documentos, ...) creando registros a través de la API de cada
interfaz, según lo definido en config/interfaces.json (entradas con
"simular": true). Todos los registros llevan el prefijo [SIM] en su campo
marcador, para poder identificarlos y eliminarlos después.

Las interfaces cuya ruta no exista en el sitio se saltan con un aviso y la
simulación continúa con el resto. Ajusta las rutas/campos en
config/interfaces.json a tu API real.

Uso:
    ./scripts/simular-datos.py [opciones]
        --base-url URL      destino (o variable BASE_URL o config)
        --config RUTA       archivo de configuración
        --cantidad N        sustituye la "cantidad" de TODAS las interfaces
        --solo ID1,ID2      simular solo en estas interfaces
        --pausa S           pausa entre registros (defecto 0.05 s)

Cada ejecución fusiona su resultado en el manifiesto
datos-simulados-manifiesto.json (raíz del kit), que es la base para la
eliminación posterior.

────────────────────────────────────────────────────────────────────────────
  COMANDO PARA ELIMINAR LOS DATOS SIMULADOS DE TODAS LAS INTERFACES
  (queda COMENTADO a propósito, para evitar borrarlos sin querer;
   descomenta y ejecuta cuando desees limpiar):

  #   ./scripts/eliminar-datos-simulados.py --confirmar
────────────────────────────────────────────────────────────────────────────
Códigos de salida: 0 = se crearon datos · 1 = ninguna interfaz respondió
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

KIT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DEFECTO = KIT_DIR / "config" / "interfaces.json"
MANIFIESTO = KIT_DIR / "datos-simulados-manifiesto.json"
PREFIJO_MARCADOR = "[SIM]"

NOMBRES = ["Ana", "Luis", "María", "Carlos", "Sofía", "Pedro", "Lucía", "Jorge",
           "Valeria", "Andrés", "Camila", "Diego", "Elena", "Marta", "Óscar", "Paula"]
APELLIDOS = ["García", "Rodríguez", "Martínez", "López", "Hernández", "Pérez",
             "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Navarro"]
TITULOS = ["Jornada de matrícula abierta", "Convocatoria de becas 2026",
           "Mantenimiento programado del laboratorio", "Feria de ciencia y tecnología",
           "Reunión general de padres y representantes", "Nuevo horario de biblioteca",
           "Torneo deportivo intersecciones", "Charla de orientación vocacional",
           "Entrega de certificados académicos", "Plan de contingencia climática"]
FRASES = ["Este es un contenido generado automáticamente para pruebas de capacidad.",
          "El registro forma parte de la simulación de datos y puede eliminarse de forma segura.",
          "Se ha creado para validar el comportamiento de la interfaz con información realista.",
          "Los datos simulados llevan el prefijo [SIM] para su identificación posterior.",
          "La información aquí contenida no corresponde a hechos reales."]


def ruta_completa(base_url: str, ruta: str) -> str:
    base = base_url.rstrip("/")
    if not ruta.startswith("/"):
        ruta = "/" + ruta
    return base + ruta


# --------------------------------------------------------- generador de datos
def rellenar(valor: str, rng: random.Random, ctx: dict) -> str:
    def sub(m: re.Match) -> str:
        tok = m.group(1)
        if tok.startswith("opcion:"):
            return rng.choice(tok[len("opcion:"):].split(",")).strip()
        if tok.startswith("entero:"):
            a, b = tok[len("entero:"):].split(",")
            return str(rng.randint(int(a), int(b)))
        mapa = {
            "nombre": lambda: ctx["nombre"],
            "email": lambda: ctx["email"],
            "telefono": lambda: f"+00 {rng.randint(100, 999)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
            "titulo": lambda: rng.choice(TITULOS),
            "parrafo": lambda: " ".join(rng.choice(FRASES) for _ in range(2)),
            "fecha": lambda: (datetime.now() + timedelta(days=rng.randint(1, 90))).strftime("%Y-%m-%d"),
            "url": lambda: f"https://archivos.example.edu/sim/doc_{rng.randint(1000, 9999)}.pdf",
        }
        return mapa[tok]() if tok in mapa else f"<{tok}>"
    return re.sub(r"\{([^}]+)\}", sub, str(valor))


def nuevo_registro(plantilla: dict, rng: random.Random) -> dict:
    ctx = {}
    ctx["nombre"] = f"{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)}"
    ctx["email"] = f"sim{rng.randint(1000, 9999)}.{ctx['nombre'].lower().replace(' ', '.')}@example.edu"
    return {k: rellenar(v, rng, ctx) for k, v in plantilla.items()}


# ------------------------------------------------------------- cliente HTTP
def peticion(metodo: str, url: str, payload: dict | None = None, timeout: int = 15):
    datos = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url, data=datos, method=metodo,
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "User-Agent": "simulacion-datos/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return 0, str(e)


def extraer_id(cuerpo: str, campo_id: str):
    """Busca el identificador del registro creado en la respuesta (también anidada)."""
    try:
        obj = json.loads(cuerpo)
    except (json.JSONDecodeError, ValueError):
        return None
    if isinstance(obj, dict):
        for clave in ("data", "item", "registro", "result", "results"):
            v = obj.get(clave)
            if isinstance(v, dict):
                if campo_id in v:
                    return v[campo_id]
                if "id" in v:
                    return v["id"]
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v[0].get(campo_id, v[0].get("id"))
        return obj.get(campo_id, obj.get("id"))
    if isinstance(obj, list) and obj and isinstance(obj[0], dict):
        return obj[0].get(campo_id, obj[0].get("id"))
    return None


# ------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(
        description="Simulación de datos en todas las interfaces del sitio.")
    ap.add_argument("--config", default=str(CONFIG_DEFECTO))
    ap.add_argument("--base-url", default=None)
    ap.add_argument("--cantidad", type=int, default=None,
                    help="sobrescribe la cantidad de todas las interfaces")
    ap.add_argument("--solo", default=None, help="ids de interfaz separados por coma")
    ap.add_argument("--pausa", type=float, default=0.05)
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    base_url = (args.base_url or os.environ.get("BASE_URL")
                or cfg.get("sitio", {}).get("baseUrl") or "http://localhost:8080").rstrip("/")

    seleccion = set(args.solo.split(",")) if args.solo else None
    interfaces = [i for i in cfg.get("interfaces", [])
                  if i.get("simular") and (seleccion is None or i["id"] in seleccion)]

    if not interfaces:
        print("No hay interfaces activadas para simular (config/interfaces.json → \"simular\": true).")
        sys.exit(1)

    print("═" * 68)
    print(f" SIMULACIÓN DE DATOS — {base_url}")
    print(f" Interfaces: {len(interfaces)} · prefijo identificador: {PREFIJO_MARCADOR}")
    print("═" * 68)

    rng = random.Random()
    manifiesto = {"baseUrl": base_url, "generado": "", "interfaces": {}}
    if MANIFIESTO.exists():
        try:
            previo = json.loads(MANIFIESTO.read_text(encoding="utf-8"))
            manifiesto["interfaces"] = previo.get("interfaces", {})
        except (json.JSONDecodeError, OSError):
            pass

    total_creados = total_fallidos = 0
    interfaces_respondidas = 0

    for interfaz in interfaces:
        iid = interfaz["id"]
        nombre = interfaz.get("nombre", iid)
        ruta = ruta_completa(base_url, interfaz["ruta"])
        cantidad = args.cantidad if args.cantidad is not None else int(interfaz.get("cantidad", 10))
        campo_id = interfaz.get("campoId", "id")
        campo_marcador = interfaz.get("campoMarcador", "nombre")
        plantilla = interfaz.get("plantilla", {})

        entradas = manifiesto["interfaces"].setdefault(iid, [])
        creados = fallidos = 0
        ejemplo_error = ""
        for _ in range(cantidad):
            registro = nuevo_registro(plantilla, rng)
            estado, cuerpo = peticion("POST", ruta, registro)
            if 200 <= estado < 300:
                creados += 1
                entradas.append({
                    "id": extraer_id(cuerpo, campo_id),
                    "marcador": registro.get(campo_marcador),
                    "cuando": datetime.now().isoformat(timespec="seconds"),
                })
            else:
                fallidos += 1
                if not ejemplo_error:
                    ejemplo_error = f"HTTP {estado}: {cuerpo[:120]}"
            time.sleep(args.pausa)

        if creados > 0:
            interfaces_respondidas += 1
        total_creados += creados
        total_fallidos += fallidos
        linea = f" {nombre:<28} {creados:>4} creados · {fallidos:>3} fallidos  ({ruta})"
        print("✓" if creados else "△", linea)
        if fallidos and ejemplo_error:
            print(f"    └─ ejemplo de fallo: {ejemplo_error}")

    manifiesto["generado"] = datetime.now().isoformat(timespec="seconds")
    MANIFIESTO.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2),
                          encoding="utf-8")

    print("─" * 68)
    print(f" Total: {total_creados} registros creados · {total_fallidos} fallidos "
          f"· {interfaces_respondidas}/{len(interfaces)} interfaces activas")
    print(f" Manifiesto de datos simulados: {MANIFIESTO}")

    # ─────────────────────────────────────────────────────────────────────
    # COMANDO PARA ELIMINAR LOS DATOS SIMULADOS DE TODAS LAS INTERFACES
    # (comentado a propósito; descomenta y ejecuta cuando quieras limpiar)
    #
    #   ./scripts/eliminar-datos-simulados.py --confirmar
    # ─────────────────────────────────────────────────────────────────────
    print()
    print("ℹ️  Para eliminar TODOS los datos simulados de todas las interfaces,")
    print("    ejecuta (comando dejado COMENTADO en este script y en el README):")
    print("        #   ./scripts/eliminar-datos-simulados.py --confirmar")

    if interfaces_respondidas == 0:
        print("\n⚠  Ninguna interfaz respondió. Verifica BASE_URL y las rutas en "
              "config/interfaces.json (¿coinciden con tu API?).")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
