// Semillero de datos iniciales: unas pocas noticias y eventos para que el
// sitio no se vea vacío en el primer arranque. Ejecutar con:
//   npx prisma db seed
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.noticia.deleteMany({});
  await prisma.evento.deleteMany({});

  await prisma.noticia.createMany({
    data: [
      {
        titulo: "Inicio del periodo académico: calendario y horarios disponibles",
        contenido:
          "El nuevo periodo académico comienza con la publicación del calendario completo de actividades, los horarios por programa y el procedimiento de atención a estudiantes. La información está disponible en la sección de noticias y se actualizará semanalmente.",
        autor: "Dirección académica",
        fecha: "2026-11-02",
      },
      {
        titulo: "Nuevo repositorio de documentos institucionales en línea",
        contenido:
          "Los reglamentos, formatos académicos y boletines administrativos ya se encuentran reunidos en un único repositorio consultable desde el sitio. La búsqueda por categoría facilita localizar el documento vigente sin pedirlo por correo.",
        autor: "Secretaría general",
        fecha: "2026-11-08",
      },
      {
        titulo: "Atención de la ventanilla única de contacto: nuevos tiempos de respuesta",
        contenido:
          "Los mensajes enviados desde el formulario de contacto se registran automáticamente y se asignan al área correspondiente. El tiempo de respuesta estimado pasa de cinco días hábiles a dos, con confirmación de recepción por correo.",
        autor: "Ventanilla única",
        fecha: "2026-11-12",
      },
    ],
  });

  await prisma.evento.createMany({
    data: [
      {
        titulo: "Jornada de puertas abiertas para aspirantes",
        descripcion:
          "Recorrido guiado por las instalaciones, presentación de programas académicos y sesión de preguntas con docentes y estudiantes actuales. Inscripción previa obligatoria por cupos.",
        lugar: "Auditorio principal",
        fecha: "2026-11-25",
        cupos: 120,
      },
      {
        titulo: "Taller: uso responsable del repositorio de documentos",
        descripcion:
          "Sesión práctica sobre cómo localizar, descargar y citar los documentos institucionales vigentes. Dirigido a estudiantes de primer semestre.",
        lugar: "Biblioteca",
        fecha: "2026-11-27",
        cupos: 40,
      },
      {
        titulo: "Conferencia: tecnología y gestión institucional",
        descripcion:
          "Ponencia sobre cómo los sistemas propios (sitio web, ventanilla de contacto y repositorio) reducen trámites presenciales y mejoran la atención a la comunidad.",
        lugar: "Sala de conferencias",
        fecha: "2026-12-03",
        cupos: 60,
      },
    ],
  });

  console.log("Semillero aplicado: 3 noticias y 3 eventos de ejemplo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
