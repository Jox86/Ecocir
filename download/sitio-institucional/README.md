# Sitio institucional

Sitio web de la institución construido con **Next.js 15 (App Router) + Prisma + SQLite**.
Es el proyecto de código al que se aplica el kit de despliegue `kit-despliegue-sitio`
(Pruebas, contenedor Podman y despliegue en el servidor institucional).

## Requisitos

- Node.js 20 LTS o superior (`node -v`)
- npm (incluido con Node)
- No requiere Docker: para el modo contenedor se usa Podman (ver kit de despliegue)

## Puesta en marcha (modo desarrollo)

```bash
npm install                    # dependencias
npx prisma migrate dev         # crea la base de datos (db/custom.db) y las tablas
npx prisma db seed             # opcional: noticias y eventos de ejemplo
npm run dev                    # servidor en http://localhost:3000
```

## Estructura

```
sitio-institucional/
├── package.json               ← dependencias y scripts (dev/build/start)
├── prisma/
│   ├── schema.prisma          ← 7 tablas (una por interfaz del kit)
│   ├── seed.js                ← datos de ejemplo (npx prisma db seed)
│   └── migrations/            ← migraciones (las aplica el contenedor al arrancar)
├── app/
│   ├── layout.tsx             ← cabecera, navegación y pie comunes
│   ├── page.tsx               ← inicio (noticias y eventos desde la base de datos)
│   ├── nosotros/page.tsx      ← descripción institucional
│   ├── noticias/page.tsx      ← listado de noticias
│   ├── contacto/page.tsx      ← formulario que crea mensajes reales
│   └── api/
│       ├── health/route.ts            ← GET /api/health (endpoint de salud)
│       ├── [tabla]/route.ts           ← GET lista + POST creación
│       └── [tabla]/[id]/route.ts      ← DELETE por id
├── lib/prisma.ts              ← cliente Prisma (singleton)
└── public/                    ← favicon y robots.txt
```

## API

Todos los recursos usan el mismo contrato; la respuesta `{"data": ...}` es la que
esperan los scripts del kit (testing, simulación de datos y limpieza).

| Recurso | Rutas | Tabla |
|---|---|---|
| Usuarios | `GET/POST /api/usuarios`, `DELETE /api/usuarios/{id}` | `Usuario` |
| Noticias | `GET/POST /api/noticias`, `DELETE /api/noticias/{id}` | `Noticia` |
| Eventos | `GET/POST /api/eventos`, `DELETE /api/eventos/{id}` | `Evento` |
| Comentarios | `GET/POST /api/comentarios`, `DELETE /api/comentarios/{id}` | `Comentario` |
| Contacto | `GET/POST /api/contacto`, `DELETE /api/contacto/{id}` | `MensajeContacto` |
| Documentos | `GET/POST /api/documentos`, `DELETE /api/documentos/{id}` | `Documento` |
| Inscripciones | `GET/POST /api/inscripciones`, `DELETE /api/inscripciones/{id}` | `Inscripcion` |

- `GET` devuelve `{"data": [ ... ]}`; `POST` devuelve `201` con `{"data": registro}`.
- Los campos enteros (`cupos`, `eventoId`) se normalizan aunque lleguen como texto.
- Los campos de fecha se guardan como texto (aceptan cualquier formato).

## Probar con el kit de despliegue

Con el sitio corriendo (`npm run dev`), desde la carpeta del kit:

```bash
export BASE_URL=http://localhost:3000
./01-testing.sh                 # 13 comprobaciones → RESULTADO: APTO
./02-simulacion-carga.sh        # 100 usuarios simultáneos durante 60 s
./03-simular-datos.sh           # crea registros [SIM] en las interfaces
```

## Construcción para producción

```bash
npm run build
npm start                       # http://localhost:3000 (variable PORT para otro puerto)
```

Para el contenedor Podman y el despliegue en el servidor, usar el kit:

```bash
APP_DIR=/ruta/a/sitio-institucional ./deploy/podman-build.sh
./deploy/podman-run.sh          # http://localhost:8080
```

Dentro del contenedor la base de datos vive en el volumen `/app/db`
(`DATABASE_URL=file:/app/db/custom.db`) y las migraciones se aplican solas al arrancar.
