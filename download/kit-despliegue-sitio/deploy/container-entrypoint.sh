#!/bin/sh
# =============================================================================
# Punto de entrada del contenedor (lo copia podman-build.sh al contexto).
# 1. Prepara la carpeta de base de datos (volumen persistente /app/db).
# 2. Aplica migraciones Prisma si el proyecto las usa.
# 3. Arranca el servidor Next.js escuchando en 0.0.0.0:3000.
# =============================================================================
set -e

mkdir -p /app/db

# URL de la base de datos SQLite dentro del volumen persistente
export DATABASE_URL="${DATABASE_URL:-file:/app/db/custom.db}"

if [ -f prisma/schema.prisma ]; then
    echo ">> Aplicando migraciones de base de datos (npx prisma migrate deploy)..."
    npx prisma migrate deploy || echo "AVISO: no se pudieron aplicar migraciones; revisa los logs."
fi

echo ">> Arrancando servidor en 0.0.0.0:${PORT:-3000}"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
