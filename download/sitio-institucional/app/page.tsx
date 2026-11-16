import { prisma } from "@/lib/prisma";

// Las páginas se generan en cada petición para reflejar siempre los datos
// actuales de la base (y para que la construcción no necesite la base lista).
export const dynamic = "force-dynamic";

export default async function Inicio() {
  let noticias: { id: number; titulo: string | null; fecha: string | null }[] = [];
  let eventos: {
    id: number;
    titulo: string | null;
    lugar: string | null;
    fecha: string | null;
    cupos: number | null;
  }[] = [];

  try {
    noticias = await prisma.noticia.findMany({
      orderBy: { id: "desc" },
      take: 3,
      select: { id: true, titulo: true, fecha: true },
    });
    eventos = await prisma.evento.findMany({
      orderBy: { fecha: "asc" },
      take: 3,
      select: { id: true, titulo: true, lugar: true, fecha: true, cupos: true },
    });
  } catch {
    // La base todavía no existe (p. ej. antes de la primera migración):
    // la página se muestra sin datos en lugar de fallar.
  }

  return (
    <main>
      <section className="portada">
        <h1>Bienvenido al sitio institucional</h1>
        <p>
          Consulta noticias y agenda, descarga documentos oficiales y envía tus
          solicitudes por la ventanilla de contacto, sin desplazarte hasta las
          oficinas.
        </p>
        <a className="boton" href="/noticias">
          Ver noticias y agenda
        </a>
      </section>

      <section className="contenedor">
        <div className="seccion">
          <h2 className="seccion-titulo">Últimas noticias</h2>
          <p className="seccion-sub">Lo más reciente publicado por las áreas de la institución.</p>
          {noticias.length === 0 ? (
            <p className="vacio">Todavía no hay noticias publicadas.</p>
          ) : (
            <div className="lista-noticias">
              {noticias.map((n) => (
                <article className="noticia" key={n.id}>
                  <h3>{n.titulo}</h3>
                  <p className="fecha">{n.fecha ?? "Sin fecha"}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="seccion">
          <h2 className="seccion-titulo">Próximos eventos</h2>
          <p className="seccion-sub">Agenda de actividades con inscripción por cupos.</p>
          {eventos.length === 0 ? (
            <p className="vacio">No hay eventos agendados.</p>
          ) : (
            <div className="rejilla">
              {eventos.map((e) => (
                <div className="tarjeta" key={e.id}>
                  <span className="etiqueta">{e.fecha ?? "Sin fecha"}</span>
                  <h3>{e.titulo}</h3>
                  <p>
                    {e.lugar ?? "Lugar por confirmar"}
                    {e.cupos != null ? ` · ${e.cupos} cupos` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="seccion">
          <h2 className="seccion-titulo">Servicios en línea</h2>
          <p className="seccion-sub">Los cuatro canales que concentran la atención a la comunidad.</p>
          <div className="rejilla">
            <div className="tarjeta">
              <span className="etiqueta">Información</span>
              <h3>Noticias y anuncios</h3>
              <p>Comunicados oficiales de dirección académica, secretaría y bienestar.</p>
            </div>
            <div className="tarjeta">
              <span className="etiqueta">Documentos</span>
              <h3>Repositorio oficial</h3>
              <p>Reglamentos, formatos académicos y boletines organizados por categoría.</p>
            </div>
            <div className="tarjeta">
              <span className="etiqueta">Atención</span>
              <h3>Ventanilla de contacto</h3>
              <p>Solicitudes y preguntas que se registran y asignan al área correspondiente.</p>
            </div>
            <div className="tarjeta">
              <span className="etiqueta">Participación</span>
              <h3>Inscripciones a eventos</h3>
              <p>Reserva de cupos en jornadas, talleres y conferencias de la agenda.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
