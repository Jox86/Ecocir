#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
02 — SIMULACIÓN DE CARGA DE ENTRADA AL SITIO (≥ 100 usuarios a la vez)

Abre N "usuarios" simultáneos (por defecto 100, el mínimo exigido) que entran
al sitio, navegan rutas al azar y permanecen conectados durante la duración
configurada, con rampa de entrada progresiva. No requiere instalar nada:
usa solo la biblioteca estándar de Python 3.

Uso:
    ./scripts/simulacion-carga-100-usuarios.py [opciones]

Opciones principales (todas opcionales; por defecto se leen de
config/interfaces.json → secciones "carga" y "umbrales"):
    --base-url URL     destino (o variable de entorno BASE_URL)
    --usuarios N       usuarios simultáneos (defecto 100)
    --duracion S       segundos de prueba sostenida (defecto 60)
    --rampa S          segundos en alcanzar los 100 % de usuarios (defecto 15)
    --p95-max MS       umbral de latencia p95 aceptable (defecto 2000 ms)
    --error-max PCT    umbral de tasa de error aceptable (defecto 1 %)

Salida:
    - Resumen en pantalla con veredicto APTO / NO APTO
    - Informe JSON en reportes/carga_<fecha>.json
Códigos de salida: 0 = APTO · 2 = NO APTO · 1 = error de ejecución
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import random
import ssl
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

KIT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DEFECTO = KIT_DIR / "config" / "interfaces.json"
DIR_REPORTES = KIT_DIR / "reportes"


# ----------------------------------------------------------------- utilidades
def cargar_config(ruta: Path) -> dict:
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR: no se pudo leer la configuración {ruta}: {e}", file=sys.stderr)
        sys.exit(1)


def ruta_completa(base_url: str, ruta: str) -> str:
    """Une el prefijo del BASE_URL (p. ej. /app) con la ruta solicitada."""
    prefijo = urlsplit(base_url).path.rstrip("/")
    if not ruta.startswith("/"):
        ruta = "/" + ruta
    return prefijo + ruta


def percentil(valores, p):
    if not valores:
        return 0.0
    vals = sorted(valores)
    k = (len(vals) - 1) * p / 100.0
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return vals[int(k)]
    return vals[f] * (c - k) + vals[c] * (k - f)


def fmt_ms(ms):
    return f"{ms:.0f} ms" if ms < 10000 else f"{ms / 1000:.1f} s"


# ------------------------------------------------------------ cliente HTTP 1.1
async def peticion_get(host, puerto, ssl_ctx, encabezado_host, ruta, timeout_ms):
    """Una petición GET con conexión nueva (Connection: close)."""
    timeout = timeout_ms / 1000.0
    t0 = time.perf_counter()

    async def lat():
        return (time.perf_counter() - t0) * 1000.0

    escritor = None
    try:
        lector, escritor = await asyncio.wait_for(
            asyncio.open_connection(host, puerto, ssl=ssl_ctx), timeout)
        req = (
            f"GET {ruta} HTTP/1.1\r\n"
            f"Host: {encabezado_host}\r\n"
            f"User-Agent: simulacion-carga/1.0 (prueba autorizada)\r\n"
            f"Accept: text/html,application/json,*/*\r\n"
            f"Accept-Encoding: identity\r\n"
            f"Connection: close\r\n\r\n"
        )
        escritor.write(req.encode("latin-1"))
        await escritor.drain()

        bruto = await asyncio.wait_for(lector.readuntil(b"\r\n\r\n"), timeout)
        lineas = bruto.split(b"\r\n")
        partes = lineas[0].decode("latin-1").split(" ", 2)
        if len(partes) < 2 or not partes[1].isdigit():
            raise ValueError(f"respuesta no HTTP: {lineas[0][:60]!r}")
        estado = int(partes[1])

        cabezas = {}
        for linea in lineas[1:]:
            if b":" in linea:
                k, v = linea.split(b":", 1)
                cabezas[k.decode("latin-1").strip().lower()] = v.decode("latin-1").strip()

        te = cabezas.get("transfer-encoding", "").lower()
        if "chunked" in te:
            cuerpo = bytearray()
            while True:
                lin = await asyncio.wait_for(lector.readuntil(b"\r\n"), timeout)
                tam = int(lin.split(b";")[0].strip() or b"0", 16)
                if tam == 0:
                    await asyncio.wait_for(lector.readuntil(b"\r\n"), timeout)
                    break
                cuerpo += await asyncio.wait_for(lector.readexactly(tam), timeout)
                await asyncio.wait_for(lector.readexactly(2), timeout)
        elif "content-length" in cabezas:
            n = int(cabezas["content-length"])
            cuerpo = await asyncio.wait_for(lector.readexactly(n), timeout) if n > 0 else b""
        else:
            cuerpo = await asyncio.wait_for(lector.read(-1), timeout)

        return {"ok": estado < 400, "estado": estado, "lat_ms": await lat(),
                "ruta": ruta, "tipo": "", "bytes": len(cuerpo)}

    except (asyncio.TimeoutError, TimeoutError):
        return {"ok": False, "estado": 0, "lat_ms": await lat(), "ruta": ruta,
                "tipo": "timeout", "bytes": 0}
    except asyncio.IncompleteReadError:
        return {"ok": False, "estado": 0, "lat_ms": await lat(), "ruta": ruta,
                "tipo": "lectura incompleta", "bytes": 0}
    except (ConnectionError, BrokenPipeError, OSError):
        return {"ok": False, "estado": 0, "lat_ms": await lat(), "ruta": ruta,
                "tipo": "conexión", "bytes": 0}
    except ValueError as e:
        return {"ok": False, "estado": 0, "lat_ms": await lat(), "ruta": ruta,
                "tipo": f"respuesta inválida ({e})", "bytes": 0}
    finally:
        if escritor is not None:
            try:
                escritor.close()
            except OSError:
                pass


# --------------------------------------------------------------- usuario virtual
async def usuario_virtual(indice, ctx, resultados, arranca_en):
    await asyncio.sleep(arranca_en)
    fin = ctx["fin_monotonic"]
    while True:
        restante = fin - time.monotonic()
        if restante <= 0:
            break
        ruta = random.choice(ctx["rutas"])
        resultados.append(await peticion_get(
            ctx["host"], ctx["puerto"], ctx["ssl_ctx"], ctx["host_header"],
            ruta, ctx["timeout_ms"]))
        pausa = random.uniform(ctx["pausa_min"], ctx["pausa_max"])
        await asyncio.sleep(min(pausa, max(0.0, restante)))


async def progreso(resultados, fin_monotonic, total_usuarios):
    ultimo = 0
    while True:
        await asyncio.sleep(10)
        ahora = len(resultados)
        restante = max(0.0, fin_monotonic - time.monotonic())
        print(f"   [{datetime.now():%H:%M:%S}] peticiones: {ahora} "
              f"(+{ahora - ultimo}) · restante: {restante:4.0f} s "
              f"· errores: {sum(1 for r in resultados if not r['ok'])}")
        ultimo = ahora


# ------------------------------------------------------------------- informe
def resumen(resultados, cfg_resumen, inicio, fin, usuarios):
    total = len(resultados)
    latencias = [r["lat_ms"] for r in resultados]
    errores_red = [r for r in resultados if r["tipo"]]
    errores_http = [r for r in resultados if r["estado"] >= 400]
    fallidas = len(errores_red) + len(errores_http)
    tasa_error = (fallidas / total * 100.0) if total else 100.0
    duracion = max(fin - inicio, 0.001)

    estados, tipos, rutas = {}, {}, {}
    for r in resultados:
        clave = f"HTTP {r['estado']}" if r["estado"] else r["tipo"] or "desconocido"
        estados[clave] = estados.get(clave, 0) + 1
        if r["tipo"]:
            tipos[r["tipo"]] = tipos.get(r["tipo"], 0) + 1
        d = rutas.setdefault(r["ruta"], {"peticiones": 0, "errores": 0, "latencias": []})
        d["peticiones"] += 1
        d["errores"] += 0 if r["ok"] else 1
        d["latencias"].append(r["lat_ms"])

    lat = {
        "media_ms": round(statistics.fmean(latencias), 1) if latencias else 0.0,
        "p50_ms": round(percentil(latencias, 50), 1),
        "p90_ms": round(percentil(latencias, 90), 1),
        "p95_ms": round(percentil(latencias, 95), 1),
        "p99_ms": round(percentil(latencias, 99), 1),
        "max_ms": round(max(latencias), 1) if latencias else 0.0,
    }
    por_ruta = {r: {"peticiones": d["peticiones"], "errores": d["errores"],
                    "p95_ms": round(percentil(d["latencias"], 95), 1)}
                for r, d in sorted(rutas.items())}

    apto = (tasa_error <= cfg_resumen["tasa_error_max_pct"]
            and lat["p95_ms"] <= cfg_resumen["latencia_max_ms"])
    return {
        "inicio": datetime.fromtimestamp(inicio).isoformat(timespec="seconds"),
        "duracion_efectiva_s": round(duracion, 1),
        "usuarios_simultaneos": usuarios,
        "peticiones_totales": total,
        "peticiones_ok": total - fallidas,
        "peticiones_fallidas": fallidas,
        "errores_http": len(errores_http),
        "errores_red": len(errores_red),
        "tasa_error_pct": round(tasa_error, 2),
        "rps": round(total / duracion, 1),
        "latencia": lat,
        "estados_http": estados,
        "tipos_fallo_red": tipos,
        "por_ruta": por_ruta,
        "umbrales": cfg_resumen,
        "veredicto": "APTO" if apto else "NO APTO",
    }


# ------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(
        description="Simulación de carga de entrada al sitio (≥100 usuarios simultáneos).")
    ap.add_argument("--config", default=str(CONFIG_DEFECTO))
    ap.add_argument("--base-url", default=None)
    ap.add_argument("--usuarios", type=int, default=None)
    ap.add_argument("--duracion", type=int, default=None, help="segundos")
    ap.add_argument("--rampa", type=int, default=None, help="segundos")
    ap.add_argument("--p95-max", type=float, default=None, help="ms")
    ap.add_argument("--error-max", type=float, default=None, help="%%")
    ap.add_argument("--timeout", type=int, default=10000, help="timeout por petición, ms")
    ap.add_argument("--informe", default=None, help="ruta del informe JSON de salida")
    args = ap.parse_args()

    cfg = cargar_config(Path(args.config))
    carga = cfg.get("carga", {})
    umbrales = cfg.get("umbrales", {})

    base_url = (args.base_url or os.environ.get("BASE_URL")
                or cfg.get("sitio", {}).get("baseUrl") or "http://localhost:8080").rstrip("/")
    usuarios = args.usuarios if args.usuarios is not None else int(carga.get("usuariosSimultaneos", 100))
    duracion = args.duracion if args.duracion is not None else int(carga.get("duracionSegundos", 60))
    rampa = args.rampa if args.rampa is not None else float(carga.get("rampaSegundos", 15))
    pausa_min = float(carga.get("pausaMinSeg", 0.5))
    pausa_max = float(carga.get("pausaMaxSeg", 1.5))
    p95_max = args.p95_max if args.p95_max is not None else float(umbrales.get("latenciaMaxMs", 2000))
    error_max = args.error_max if args.error_max is not None else float(umbrales.get("tasaErrorMaxPct", 1.0))

    partes = urlsplit(base_url)
    if partes.scheme not in ("http", "https") or not partes.hostname:
        print(f"ERROR: BASE_URL inválida: {base_url!r}", file=sys.stderr)
        sys.exit(1)
    puerto = partes.port or (443 if partes.scheme == "https" else 80)
    ssl_ctx = None
    if partes.scheme == "https":
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE  # entornos de prueba con certificado institucional propio

    rutas_cfg = carga.get("rutasNavegacion") or [carga.get("rutaEntrada") or "/"]
    rutas = [ruta_completa(base_url, r) for r in rutas_cfg if r]
    if not rutas:
        rutas = [ruta_completa(base_url, "/")]

    if usuarios < 100:
        print(f"AVISO: se piden {usuarios} usuarios; el mínimo exigido para la prueba es 100.")

    print("═" * 68)
    print(f" SIMULACIÓN DE CARGA — {base_url}")
    print(f" usuarios simultáneos: {usuarios} · duración: {duracion} s · rampa: {rampa} s")
    print(f" rutas: {', '.join(rutas)}")
    print(f" umbrales: p95 ≤ {p95_max:.0f} ms · tasa de error ≤ {error_max:.1f} %")
    print("═" * 68)

    resultados: list = []
    ctx = {
        "host": partes.hostname, "puerto": puerto, "ssl_ctx": ssl_ctx,
        "host_header": partes.netloc, "rutas": rutas,
        "pausa_min": pausa_min, "pausa_max": pausa_max,
        "timeout_ms": args.timeout, "fin_monotonic": 0.0,
    }

    async def orquestador():
        inicio = time.monotonic()
        ctx["fin_monotonic"] = inicio + duracion
        # Rampa: los usuarios entran repartidos en los primeros `rampa` segundos
        tareas = []
        for i in range(usuarios):
            arranca = (rampa * i / max(usuarios, 1)) if rampa > 0 else 0.0
            tareas.append(asyncio.create_task(
                usuario_virtual(i, ctx, resultados, arranca)))
        monitor = asyncio.create_task(progreso(resultados, ctx["fin_monotonic"], usuarios))
        await asyncio.gather(*tareas)
        monitor.cancel()
        return inicio

    inicio_monotonic = time.monotonic()
    try:
        inicio = asyncio.run(orquestador())
    except KeyboardInterrupt:
        print("\n>> Interrumpido por el usuario; calculando resultados parciales...")
        inicio = inicio_monotonic
    fin = time.monotonic()

    informe = resumen(resultados, {"latencia_max_ms": p95_max,
                                   "tasa_error_max_pct": error_max}, inicio, fin, usuarios)

    # Guardar informe JSON
    DIR_REPORTES.mkdir(parents=True, exist_ok=True)
    ruta_informe = Path(args.informe) if args.informe else (
        DIR_REPORTES / f"carga_{datetime.now():%Y%m%d_%H%M%S}.json")
    with open(ruta_informe, "w", encoding="utf-8") as f:
        json.dump({"destino": base_url, **informe}, f, ensure_ascii=False, indent=2)

    # Resumen en pantalla
    lat = informe["latencia"]
    print("─" * 68)
    print(f" Peticiones totales : {informe['peticiones_totales']:>8} "
          f"(OK {informe['peticiones_ok']} · fallidas {informe['peticiones_fallidas']})")
    print(f" Rendimiento        : {informe['rps']} peticiones/s sostenidas")
    print(f" Latencia           : media {fmt_ms(lat['media_ms'])} · p50 {fmt_ms(lat['p50_ms'])}"
          f" · p90 {fmt_ms(lat['p90_ms'])} · p95 {fmt_ms(lat['p95_ms'])} · p99 {fmt_ms(lat['p99_ms'])}"
          f" · máx {fmt_ms(lat['max_ms'])}")
    print(f" Tasa de error      : {informe['tasa_error_pct']} % (umbral {error_max:.1f} %)")
    if informe["estados_http"]:
        print(" Estados            : " + ", ".join(f"{k}: {v}" for k, v in informe["estados_http"].items()))
    print("─" * 68)
    if informe["veredicto"] == "APTO":
        print(f" ✅ RESULTADO: APTO — el sitio sostuvo {usuarios} usuarios simultáneos "
              f"con p95 {fmt_ms(lat['p95_ms'])} y {informe['tasa_error_pct']} % de errores.")
        codigo = 0
    else:
        print(f" ❌ RESULTADO: NO APTO — revisar capacidad del servidor "
              f"(p95 {fmt_ms(lat['p95_ms'])} / tasa de error {informe['tasa_error_pct']} %).")
        print("    Sugerencias: revisar CPU/RAM del servidor, límites del contenedor y "
              "el volumen Podman; aumentar recursos y repetir.")
        codigo = 2
    print(f" Informe detallado  : {ruta_informe}")
    sys.exit(codigo)


if __name__ == "__main__":
    main()
