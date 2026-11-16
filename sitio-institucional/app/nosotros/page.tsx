export const metadata = { title: "Nosotros — Sitio institucional" };

export default function Nosotros() {
  return (
    <main className="contenedor">
      <div className="seccion">
        <h1 className="seccion-titulo">Sobre la institución</h1>
        <p className="seccion-sub">Qué hacemos, cómo trabajamos y a quién servimos.</p>
        <p>
          La institución atiende a su comunidad académica y administrativa a través
          de servicios de información, trámites y participación. El sitio
          institucional concentra esos servicios en un único canal digital: aquí se
          publican las noticias y los anuncios oficiales, se mantiene la agenda de
          eventos con inscripción por cupos, se consulta el repositorio de
          documentos vigentes y funciona la ventanilla de contacto que recibe y
          asigna las solicitudes.
        </p>
        <p>
          La gestión del sitio responde a tres principios. Primero, transparencia:
          toda la información oficial se publica en un solo lugar, con fecha y área
          responsable, para que nadie dependa de cadenas de correo. Segundo,
          trazabilidad: cada solicitud que entra por el formulario de contacto
          queda registrada con su fecha de recepción y su estado, lo que permite
          medir tiempos de respuesta en lugar de estimarlos. Tercero, accesibilidad:
          los servicios se diseñan para usarse desde cualquier navegador moderno,
          sin requisitos técnicos especiales para la persona usuaria.
        </p>
      </div>

      <div className="seccion">
        <h2 className="seccion-titulo">Áreas responsables</h2>
        <p className="seccion-sub">Quién mantiene cada canal del sitio.</p>
        <div className="rejilla">
          <div className="tarjeta">
            <span className="etiqueta">Dirección académica</span>
            <h3>Noticias y agenda</h3>
            <p>Publica calendarios, horarios y convocatorias; mantiene la agenda de eventos.</p>
          </div>
          <div className="tarjeta">
            <span className="etiqueta">Secretaría general</span>
            <h3>Repositorio de documentos</h3>
            <p>Actualiza reglamentos y formatos, y retira del repositorio los documentos vencidos.</p>
          </div>
          <div className="tarjeta">
            <span className="etiqueta">Área de tecnología</span>
            <h3>Operación del sitio</h3>
            <p>Administra la plataforma, su base de datos y el despliegue en el servidor institucional.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
