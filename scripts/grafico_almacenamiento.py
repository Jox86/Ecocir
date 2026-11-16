#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gráfico de barras agrupadas: componentes de almacenamiento por horizonte (GB)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams["axes.unicode_minus"] = False

componentes = ["Contenedor\n+ cache Podman", "Base de datos\nSQLite", "Archivos\nsubidos",
               "Registros\n(logs)", "Copias de\nseguridad"]
anio1 = [1.88, 0.084, 0.85, 3.00, 4.29]
anio3 = [1.88, 0.250, 2.41, 3.00, 12.55]
anio5 = [1.88, 0.417, 3.99, 3.00, 20.85]

x = np.arange(len(componentes))
w = 0.26
fig, ax = plt.subplots(figsize=(10, 5.5), constrained_layout=True)
b1 = ax.bar(x - w, anio1, w, label="Año 1", color="#529286")
b2 = ax.bar(x, anio3, w, label="Año 3", color="#6B9DAD")
b3 = ax.bar(x + w, anio5, w, label="Año 5", color="#C49B72")

for barras in (b1, b2, b3):
    for r in barras:
        h = r.get_height()
        ax.annotate(f"{h:.2f}", (r.get_x() + r.get_width() / 2, h),
                    textcoords="offset points", xytext=(0, 3),
                    ha="center", fontsize=8, color="#404040")

ax.set_ylabel("Almacenamiento estimado (GB)")
ax.set_title("Requisitos de almacenamiento por componente y horizonte", fontsize=13, pad=12)
ax.set_xticks(x, componentes, fontsize=9)
ax.set_ylim(0, 23)
ax.grid(True, axis="y", alpha=0.3)
ax.set_axisbelow(True)
ax.legend(loc="upper left", bbox_to_anchor=(0.01, 0.99), frameon=False)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

out = "/home/z/my-project/scripts/assets/grafico_almacenamiento.png"
import os
os.makedirs(os.path.dirname(out), exist_ok=True)
fig.savefig(out, dpi=200)
print("guardado:", out)

from PIL import Image
im = Image.open(out)
print("dimensiones:", im.size)
