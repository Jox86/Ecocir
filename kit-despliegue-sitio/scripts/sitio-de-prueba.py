#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Servidor de prueba (mock) que imita el sitio institucional para verificar
los scripts del kit: rutas de verificación, /api/health y las interfaces
(listar / crear / eliminar). Solo para verificación local."""
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

DATOS = {i: [] for i in ("usuarios", "noticias", "eventos", "comentarios",
                         "contacto", "documentos", "inscripciones")}
CONTADOR = iter(range(1, 1000000))
HTML = "<html><body><h1>Sitio institucional (mock de prueba)</h1></body></html>"


class Manejador(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silencia el log por petición
        pass

    def _enviar(self, codigo, cuerpo, tipo="application/json; charset=utf-8"):
        data = cuerpo.encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        ruta = urlparse(self.path).path
        if ruta == "/api/health":
            return self._enviar(200, json.dumps({"status": "ok"}))
        m = re.match(r"^/api/([a-z-]+)$", ruta)
        if m:
            tabla = m.group(1)
            if tabla in DATOS:
                return self._enviar(200, json.dumps({"data": DATOS[tabla]}))
            return self._enviar(404, json.dumps({"error": "no existe"}))
        if ruta in ("/", "/nosotros", "/noticias", "/contacto"):
            return self._enviar(200, HTML, "text/html; charset=utf-8")
        return self._enviar(404, "no encontrado", "text/plain")

    def do_POST(self):
        m = re.match(r"^/api/([a-z-]+)$", urlparse(self.path).path)
        if not m or m.group(1) not in DATOS:
            return self._enviar(404, json.dumps({"error": "no existe"}))
        largo = int(self.headers.get("Content-Length", 0))
        cuerpo = json.loads(self.rfile.read(largo) or b"{}")
        registro = {"id": next(CONTADOR), **cuerpo}
        DATOS[m.group(1)].append(registro)
        return self._enviar(201, json.dumps(registro))

    def do_DELETE(self):
        m = re.match(r"^/api/([a-z-]+)/(\d+)$", urlparse(self.path).path)
        if not m or m.group(1) not in DATOS:
            return self._enviar(404, json.dumps({"error": "no existe"}))
        rid = int(m.group(2))
        antes = len(DATOS[m.group(1)])
        DATOS[m.group(1)] = [r for r in DATOS[m.group(1)] if r["id"] != rid]
        if len(DATOS[m.group(1)]) < antes:
            return self._enviar(200, json.dumps({"eliminado": rid}))
        return self._enviar(404, json.dumps({"error": "id inexistente"}))


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8123), Manejador).serve_forever()
