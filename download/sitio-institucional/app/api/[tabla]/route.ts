import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// API REST genérica para las 7 interfaces del sitio. El nombre del recurso en
// la URL se traduce al modelo Prisma correspondiente; el formato de respuesta
// ({"data": ...}) es el que consumen los scripts del kit de despliegue:
//   GET    /api/<recurso>        -> {"data": [registros]}
//   POST   /api/<recurso>        -> 201 {"data": registro creado}
// Las rutas equivalentes están definidas en kit-despliegue-sitio/config/interfaces.json.

const TABLAS: Record<string, string> = {
  usuarios: "usuario",
  noticias: "noticia",
  eventos: "evento",
  comentarios: "comentario",
  contacto: "mensajeContacto",
  documentos: "documento",
  inscripciones: "inscripcion",
};

// Campos enteros: se normalizan porque pueden llegar como número o como texto.
const CAMPOS_ENTERO: Record<string, string[]> = {
  eventos: ["cupos"],
  inscripciones: ["eventoId"],
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tabla: string }> }
) {
  const { tabla } = await params;
  const modelo = TABLAS[tabla];
  if (!modelo) {
    return NextResponse.json({ error: "no existe" }, { status: 404 });
  }
  try {
    const lista = await (prisma as any)[modelo].findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json({ data: lista });
  } catch {
    return NextResponse.json(
      { error: "error al consultar" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tabla: string }> }
) {
  const { tabla } = await params;
  const modelo = TABLAS[tabla];
  if (!modelo) {
    return NextResponse.json({ error: "no existe" }, { status: 404 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(cuerpo)) {
    if (valor === null || valor === undefined) continue;
    if (CAMPOS_ENTERO[tabla]?.includes(clave)) {
      const numero = Number(valor);
      data[clave] = Number.isFinite(numero) ? Math.round(numero) : null;
    } else if (
      typeof valor === "string" ||
      typeof valor === "number" ||
      typeof valor === "boolean"
    ) {
      data[clave] = String(valor);
    }
  }

  try {
    const registro = await (prisma as any)[modelo].create({ data });
    return NextResponse.json({ data: registro }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "no se pudo crear el registro" },
      { status: 400 }
    );
  }
}
