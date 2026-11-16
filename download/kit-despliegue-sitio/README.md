# Kit de despliegue del sitio institucional — Podman (sin Docker)

Paquete operativo para montar el sitio en el servidor institucional **en
contenedor, sin Docker**: Podman rootless + systemd (Quadlet), y una carpeta de
scripts ejecutables para **testing**, **simulación de carga (100 usuarios
mínimo a la vez)** y **simulación de datos en todas las interfaces** (con el
comando de limpieza comentado).

---

## 1. Contenido de la carpeta

```
kit-despliegue-sitio/
├── 01-testing.sh                      ← TESTING del sitio (ejecutable)
├── 02-simulacion-carga.sh             ← CARGA: 100 usuarios simultáneos (ejecutable)
├── 03-simular-datos.sh                ← DATOS: simula datos en todas las interfaces (ejecutable)
├── README.md                          ← este documento
├── config/
│   └── interfaces.json                ← configuración central: rutas, interfaces, perfiles y umbrales
├── deploy/                            ← contenedor con Podman (NO Docker)
│   ├── Containerfile                  ← construcción en 3 etapas (deps → build → runner)
│   ├── container-entrypoint.sh        ← arranque: migraciones + servidor
│   ├── containerignore.ejemplo        ← contexto de construcción sin archivos innecesarios
│   ├── podman-build.sh                ← construye la imagen (APP_DIR=/ruta/del/sitio)
│   ├── podman-run.sh                  ← arranca el contenedor con volumen persistente
│   ├── podman-stop.sh                 ← detiene y elimina el contenedor
│   ├── podman-logs.sh                 ← sigue los logs en vivo
│   ├── podman-backup.sh               ← copia de seguridad en caliente con retención
│   └── quadlet/sitio-web.container    ← servicio systemd: arranque automático
├── scripts/
│   ├── testing.sh                     ← implementación del testing (curl + config)
│   ├── simulacion-carga-100-usuarios.py ← carga con asyncio (solo stdlib de Python 3)
│   ├── simular-datos.py               ← crea datos [SIM] en cada interfaz vía API
│   ├── eliminar-datos-simulados.py    ← LIMPIEZA: elimina todos los datos simulados
│   ├── calcular-almacenamiento.py     ← cálculo reproducible del informe de almacenamiento
│   └── sitio-de-prueba.py             ← mock del sitio (puerto 8123) para probar el kit sin el código real
├── docs/
│   ├── Estimacion_requisitos_almacenamiento.docx ← informe de almacenamiento (+PDF)
│   └── Guia_ejecucion_VS_Code.docx     ← guía paso a paso para ejecutar el proyecto en VS Code (+PDF)
└── reportes/                          ← informes JSON de las pruebas de carga
```

## 2. Requisitos previos en el servidor

- **Podman** (no requiere Docker ni su demonio):
  - RHEL / Alma / Rocky: `sudo dnf install podman`
  - Debian / Ubuntu: `sudo apt install podman`
- **python3 y curl** en el equipo desde el que se ejecuten los scripts 01–03
  (todos los scripts usan solo biblioteca estándar; no hay que instalar nada más).
- Usuario de servicio con Podman rootless. Si el contenedor debe arrancar al
  encender el servidor sin sesión abierta: `sudo loginctl enable-linger USUARIO`.

## 3. Despliegue paso a paso

```bash
# 1) Construir la imagen desde el código del sitio (adaptar APP_DIR)
APP_DIR=/srv/sitio ./deploy/podman-build.sh

# 2) Arrancar el contenedor (publica http://localhost:8080)
./deploy/podman-run.sh

# 3) Verificar
./deploy/podman-logs.sh
curl -I http://localhost:8080
```

### Arranque automático con systemd (producción)

```bash
APP_DIR=/srv/sitio ./deploy/podman-build.sh          # la imagen debe existir
mkdir -p ~/.config/containers/systemd
podman volume create sitio-db-data
cp deploy/quadlet/sitio-web.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user enable --now sitio-web.service
systemctl --user status sitio-web.service
```

Notas:
- Puertos por debajo de 1024 (80/443) requieren root o
  `sudo sysctl net.ipv4.ip_unprivileged_port_start=80`. El kit publica por
  defecto el **8080**; delante puede añadirse un proxy inverso institucional.
- `:Z` en los volúmenes aplica la etiqueta SELinux necesaria en RHEL/Alma/Rocky.

## 4. Scripts de prueba (después de desplegar)

```bash
# Ajusta el destino si no es el puerto 8080:
export BASE_URL=http://localhost:8080

./01-testing.sh                 # entrada, rutas e interfaces: OK / avisos / fallos
./02-simulacion-carga.sh        # 100 usuarios simultáneos durante 60 s (rampa 15 s)
./03-simular-datos.sh           # crea datos [SIM] en todas las interfaces
```

- **02** emite veredicto **APTO / NO APTO** (umbral: p95 ≤ 2000 ms y errores
  ≤ 1 %) y guarda un informe JSON en `reportes/`.
  Otros perfiles: `./02-simulacion-carga.sh --usuarios 200 --duracion 120`.
- **03** registra cada interfaz activada en `config/interfaces.json`
  (`"simular": true`), marca los registros con el prefijo `[SIM]` y deja un
  manifiesto (`datos-simulados-manifiesto.json`).
- Las interfaces cuya ruta no exista aún en el sitio se saltan con aviso:
  ajusta `rutas` y `plantilla` de cada interfaz en `config/interfaces.json`
  a tu API real.

### Eliminar los datos simulados de todas las interfaces

El comando va **comentado a propósito** (en `03-simular-datos.sh`, al final de
`scripts/simular-datos.py` y aquí) para no borrar nada por accidente.
Descomenta y ejecuta cuando quieras limpiar:

```bash
# ./scripts/eliminar-datos-simulados.py --confirmar
```

Sin `--confirmar` solo muestra lo que eliminaría (dry-run).

## 5. Copias de seguridad y mantenimiento

```bash
./deploy/podman-backup.sh                 # copia BD (en caliente) + archivos públicos
```

Programa diario (cron del usuario que ejecuta el contenedor):

```cron
0 2 * * * /srv/kit-despliegue-sitio/deploy/podman-backup.sh >> /srv/kit-backup.log 2>&1
```

Retención por defecto: 30 copias diarias de base de datos y 4 semanales de
archivos (`RETENCION_DB` / `RETENCION_ARCHIVOS` modificables).

## 6. Requisitos de almacenamiento (resumen)

Cálculo completo, supuestos y recomendaciones en
`docs/Estimacion_requisitos_almacenamiento.docx` (reproducible con
`scripts/calcular-almacenamiento.py`).

| Componente | Año 1 | Año 3 | Año 5 |
|---|---|---|---|
| Contenedor + cache Podman | 1,88 GB | 1,88 GB | 1,88 GB |
| Base de datos SQLite | 0,08 GB | 0,25 GB | 0,42 GB |
| Archivos subidos | 0,85 GB | 2,41 GB | 3,99 GB |
| Registros (presupuesto fijo) | 3,00 GB | 3,00 GB | 3,00 GB |
| Copias de seguridad | 4,29 GB | 12,55 GB | 20,85 GB |
| **Total** | **10,08 GB** | **20,08 GB** | **30,13 GB** |

**Recomendación: 50 GB** (mínimo operativo 30 GB para 3 años con margen del
25 %). Destinar las copias de seguridad, a ser posible, a un disco o NAS
separado.

## 7. Adaptación

- **Stack distinto**: el Containerfile asume Node.js/Next.js + Prisma/SQLite.
  Si tu sitio arranca con otro comando, ajusta la última línea de
  `deploy/container-entrypoint.sh` (p. ej. `php-fpm`, `gunicorn`, `java -jar`).
- **Rutas e interfaces**: todo se centraliza en `config/interfaces.json`
  (rutas de verificación, perfil de carga, umbrales, interfaces a simular).
- **Puerto y volúmenes**: variables `PUERTO_HOST`, `VOLUMEN_DB`, `IMAGEN`,
  `NOMBRE` en los scripts de `deploy/`.
