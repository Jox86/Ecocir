import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

//   DELETE /api/<recurso>/{id}  -> {"eliminado": id}   (usado por la limpieza
//   de datos simulados del kit: scripts/eliminar-datos-simulados.py)

const TABLAS: Record<string, string> = {
  usuarios: "usuario",
  noticias: "noticia",
  eventos: "evento",
  comentarios: "comentario",
  contacto: "mensajeContacto",
  documentos: "documento",
  inscripciones: "inscripcion",
};

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tabla: string; id: string }> }
) {
  const { tabla, id } = await params;
  const modelo = TABLAS[tabla];
  if (!modelo) {
    return NextResponse.json({ error: "no existe" }, { status: 404 });
  }

  const identificador = Number(id);
  if (!Number.isInteger(identificador)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    await (prisma as any)[modelo].delete({ where: { id: identificador } });
    return NextResponse.json({ eliminado: identificador });
  } catch {
    return NextResponse.json({ error: "id inexistente" }, { status: 404 });
  }
}
