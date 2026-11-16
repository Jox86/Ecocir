#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cálculo de los requisitos de almacenamiento del sitio institucional
(contenedor Podman + Next.js + SQLite). Imprime las tablas que alimentan
el documento de estimación y el README del kit.

Supuestos (documentados en el informe):
- Institución con ~1.000 usuarios registrados (crece 20 %/año).
- Actividad editorial: 5 noticias/semana, 20 comentarios/día, 2 eventos/mes,
  30 mensajes de contacto/día, 5 documentos/semana, 200 entradas de
  auditoría/día.
- Contenido subido: imagen de noticia 400 KB, documento PDF 1,2 MB,
  8 fotos por evento (2 MB c/u), avatar 50 KB por usuario.
- Logs: pico 100 usuarios simultáneos ≈ 10 req/s ≈ 864.000 req/día.
- Retención de copias: 30 diarias de BD, 4 semanales de archivos subidos.
"""
import math

GB = 1024 ** 3
MB = 1024 ** 2
KB = 1024


def fmt(b: float) -> str:
    if b >= GB:
        return f"{b / GB:.2f} GB"
    if b >= MB:
        return f"{b / MB:.1f} MB"
    return f"{b / KB:.1f} KB"


# ---------------------------------------------------------------- 1. contenedor
base_imagen = 230 * MB            # node:20-slim + sqlite3 + ca-certificates
node_modules = 420 * MB           # dependencias en producción (Next.js + Prisma)
build_next = 130 * MB             # salida .next
imagen_final = base_imagen + node_modules + build_next
cache_construccion = node_modules * 2 + 300 * MB     # capas deps + build
presupuesto_contenedor = imagen_final + cache_construccion   # techo de podman storage

# ---------------------------------------------------------------- 2. base de datos
TABLAS = [
    # (tabla, bytes/fila, filas/año, filas iniciales año 1)
    ("usuarios",            1.0 * KB, 200,   1000),   # 20 % de crecimiento/año
    ("noticias",            3.0 * KB, 260,   260),
    ("comentarios",         1.2 * KB, 7300,  7300),
    ("eventos",             2.0 * KB, 24,   24),
    ("mensajes_contacto",   1.5 * KB, 10950, 10950),
    ("documentos (metadatos)", 1.0 * KB, 260, 260),
    ("auditoria_sesiones",  0.5 * KB, 73000, 73000),
]
OVERHEAD_SQLITE = 1.35   # índices, freelist, páginas parciales


def bd_anio(n: int) -> float:
    total = 0.0
    for _, tam, filas_anuales, iniciales in TABLAS:
        if "usuarios" in _:
            filas = iniciales * (1.20 ** (n - 1))
        else:
            filas = iniciales * n
        total += filas * tam
    return total * OVERHEAD_SQLITE


# ---------------------------------------------------------------- 3. archivos subidos
ANUAL_UPLOADS = (
    260 * 400 * KB +          # imágenes de noticias (260/año)
    260 * 1.2 * MB +          # documentos PDF (260/año)
    24 * 8 * 2 * MB +         # fotos de eventos (24 eventos × 8 fotos × 2 MB)
    0                         # avatares se suman por año abajo
)
AVATAR_USUARIO = 50 * KB


def uploads_anio(n: int) -> float:
    usuarios = 1000 * (1.20 ** (n - 1))
    return ANUAL_UPLOADS * n + usuarios * AVATAR_USUARIO


# ---------------------------------------------------------------- 4. logs
REQ_DIA = 864_000               # 10 req/s de promedio en punta sostenida
BYTES_POR_REQ_LOG = 250
logs_dia_sin_comprimir = REQ_DIA * BYTES_POR_REQ_LOG
presupuesto_logs = 1 * GB + 2 * GB   # journald (SystemMaxUse=1GB) + access log rotado (2GB, 14 días)

# ---------------------------------------------------------------- 5. copias de seguridad
RETENCION_DB = 30               # copias diarias
RETENCION_ARCHIVOS = 4          # copias semanales del volumen público


def backups_anio(n: int) -> float:
    db_comprimida = bd_anio(n) * 0.40
    archivos = uploads_anio(n)
    return db_comprimida * RETENCION_DB + archivos * RETENCION_ARCHIVOS


def total_anio(n: int) -> float:
    return presupuesto_contenedor + bd_anio(n) + uploads_anio(n) + presupuesto_logs + backups_anio(n)


print("═" * 74)
print(" CÁLCULO DE REQUISITOS DE ALMACENAMIENTO — SITIO INSTITUCIONAL")
print("═" * 74)

print("\n[1] Contenedor Podman")
print(f"    Imagen final (SO + dependencias + build) : {fmt(imagen_final)}")
print(f"    Cache de construcción (capas)            : {fmt(cache_construccion)}")
print(f"    Presupuesto podman storage               : {fmt(presupuesto_contenedor)}")

print("\n[2] Base de datos SQLite (con overhead 1.35×)")
print(f"    {'tabla':<26}{'KB/fila':>9}{'filas/año':>11}")
for nombre_tabla, tam_fila, filas_anuales, iniciales in TABLAS:
    print(f"    {nombre_tabla:<26}{tam_fila / KB:>9.1f}{filas_anuales:>11,}")
print(f"    Año 1: {fmt(bd_anio(1))} · Año 3: {fmt(bd_anio(3))} · Año 5: {fmt(bd_anio(5))}")

print("\n[3] Archivos subidos (uploads)")
print(f"    Crecimiento anual fijo: {fmt(ANUAL_UPLOADS)} + avatares")
print(f"    Año 1: {fmt(uploads_anio(1))} · Año 3: {fmt(uploads_anio(3))} · Año 5: {fmt(uploads_anio(5))}")

print("\n[4] Registros (logs)")
print(f"    Generación diaria sin comprimir: {fmt(logs_dia_sin_comprimir)} (~864k req/día)")
print(f"    Presupuesto con rotación/compresión: {fmt(presupuesto_logs)} (fijo)")

print("\n[5] Copias de seguridad (30 diarias BD + 4 semanales archivos)")
print(f"    Año 1: {fmt(backups_anio(1))} · Año 3: {fmt(backups_anio(3))} · Año 5: {fmt(backups_anio(5))}")

print("\n" + "═" * 74)
print(" RESUMEN POR HORIZONTE")
print("═" * 74)
print(f"    {'componente':<34}{'año 1':>10}{'año 3':>10}{'año 5':>10}")
filas = [
    ("Contenedor + cache Podman", presupuesto_contenedor, presupuesto_contenedor, presupuesto_contenedor),
    ("Base de datos SQLite", bd_anio(1), bd_anio(3), bd_anio(5)),
    ("Archivos subidos", uploads_anio(1), uploads_anio(3), uploads_anio(5)),
    ("Registros/logs (presupuesto)", presupuesto_logs, presupuesto_logs, presupuesto_logs),
    ("Copias de seguridad", backups_anio(1), backups_anio(3), backups_anio(5)),
]
for n, a, b, c in filas:
    print(f"    {n:<34}{fmt(a):>10}{fmt(b):>10}{fmt(c):>10}")
t1, t3, t5 = total_anio(1), total_anio(3), total_anio(5)
minimo_gb = math.ceil((t3 * 1.25) / (5 * GB)) * 5   # 3 años + 25 % de margen, redondeado a múltiplos de 5
print("    " + "-" * 64)
print(f"    {'TOTAL':<34}{fmt(t1):>10}{fmt(t3):>10}{fmt(t5):>10}")
print(f"\n    Recomendación: mínimo operativo {minimo_gb} GB "
      f"(3 años + 25 % de margen) · dimensionado recomendado 50 GB")
print(f"    (el TOTAL del año 5 es {fmt(t5)}; 50 GB deja margen para picos, "
      "actualizaciones de imagen y el propio sistema operativo)")
