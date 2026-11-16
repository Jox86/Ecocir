import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Noticias — Sitio institucional" };

export default async function Noticias() {
  let noticias: {
    id: number;
    titulo: string | null;
    contenido: string | null;
    autor: string | null;
    fecha: string | null;
  }[] = [];

  try {
    noticias = await prisma.noticia.findMany({
      orderBy: { id: "desc" },
      select: { id: true, titulo: true, contenido: true, autor: true, fecha: true },
    });
  } catch {
    // Base de datos aún no creada: se muestra la página vacía.
  }

  return (
    <main className="contenedor">
      <div className="seccion">
        <h1 className="seccion-titulo">Noticias y anuncios</h1>
        <p className="seccion-sub">
          Comunicados oficiales publicados por las áreas de la institución, en orden
          de aparición. Las fechas corresponden a la publicación.
        </p>
        {noticias.length === 0 ? (
          <p className="vacio">Todavía no hay noticias publicadas.</p>
        ) : (
          <div className="lista-noticias">
            {noticias.map((n) => (
              <article className="noticia" key={n.id}>
                <h3>{n.titulo}</h3>
                <p className="fecha">
                  {n.fecha ?? "Sin fecha"}
                  {n.autor ? ` · ${n.autor}` : ""}
                </p>
                <p>{n.contenido}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
