#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Postproceso del docx (compatibilidad WPS/Word):
1. Elimina <w:pgNumType/> vacíos de las secciones (portada).
2. Parchea los campos PAGE de los pies: romanos (marca 707070) y arábigos (808080).
"""
import re
import shutil
import sys
import zipfile

RUTA = sys.argv[1]
TMP = RUTA + ".tmp"

with zipfile.ZipFile(RUTA, "r") as zin:
    nombres = zin.namelist()
    contenidos = {n: zin.read(n) for n in nombres}

# 1) quitar pgNumType vacíos en document.xml
doc = contenidos["word/document.xml"].decode("utf-8")
doc = re.sub(r"<w:pgNumType/>", "", doc)

# 1b) eliminar la entrada de índice duplicada que add_toc_placeholders.py deja
# dentro del párrafo del campo (tras el fldChar "separate"); la entrada estática
# correspondiente ya existe como párrafo propio y Word regenera el TOC igual.
doc, n_dup = re.subn(
    r'(<w:r><w:fldChar w:fldCharType="separate"/></w:r>)<w:hyperlink[^>]*>.*?</w:hyperlink>',
    r"\1", doc, count=1, flags=re.S)
if n_dup:
    print("entrada de índice duplicada eliminada")
contenidos["word/document.xml"] = doc.encode("utf-8")

# 2) parchear pies de página según su color marcador
patron = re.compile(r"(<w:instrText[^>]*>)([^<]*PAGE[^<]*)(</w:instrText>)")
parcheados = []
for nombre in list(contenidos):
    if not re.match(r"word/footer\d+\.xml", nombre):
        continue
    xml = contenidos[nombre].decode("utf-8")
    if "PAGE" not in xml:
        continue
    if "707070" in xml:
        formato = r"\* ROMAN"
    else:
        formato = r"\* arabic"
    nuevo = patron.sub(lambda m: m.group(1) + f" PAGE {formato} \\* MERGEFORMAT " + m.group(3), xml)
    if nuevo != xml:
        contenidos[nombre] = nuevo.encode("utf-8")
        parcheados.append((nombre, formato))

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in nombres:
        zout.writestr(n, contenidos[n])
shutil.move(TMP, RUTA)
print("pgNumType vacíos eliminados; pies parcheados:", parcheados)
