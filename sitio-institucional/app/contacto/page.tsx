"use client";

import { useState } from "react";

export default function Contacto() {
  const [estado, setEstado] = useState<"inactivo" | "enviando" | "ok" | "error">(
    "inactivo"
  );
  const [mensaje, setMensaje] = useState("");

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado("enviando");
    setMensaje("");

    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const cuerpo = {
      nombre: String(datos.get("nombre") ?? ""),
      email: String(datos.get("email") ?? ""),
      asunto: String(datos.get("asunto") ?? ""),
      mensaje: String(datos.get("mensaje") ?? ""),
    };

    try {
      const respuesta = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      setEstado("ok");
      setMensaje(
        "Solicitud registrada. Recibirás respuesta por correo en un plazo máximo de dos días hábiles."
      );
      formulario.reset();
    } catch {
      setEstado("error");
      setMensaje(
        "No se pudo registrar la solicitud. Revisa tu conexión e inténtalo de nuevo."
      );
    }
  }

  return (
    <main className="contenedor">
      <div className="seccion">
        <h1 className="seccion-titulo">Ventanilla de contacto</h1>
        <p className="seccion-sub">
          Envía tus solicitudes, preguntas o comentarios. Cada mensaje queda
          registrado con fecha de recepción y se asigna al área responsable.
        </p>

        {estado === "ok" && <div className="aviso aviso-ok">{mensaje}</div>}
        {estado === "error" && <div className="aviso aviso-error">{mensaje}</div>}

        <form className="formulario" onSubmit={alEnviar}>
          <div className="campo">
            <label htmlFor="nombre">Nombre completo</label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              placeholder="Nombre y apellidos"
            />
          </div>
          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="campo">
            <label htmlFor="asunto">Asunto</label>
            <input
              id="asunto"
              name="asunto"
              type="text"
              required
              placeholder="Resumen del tema en una línea"
            />
          </div>
          <div className="campo">
            <label htmlFor="mensaje">Mensaje</label>
            <textarea
              id="mensaje"
              name="mensaje"
              required
              rows={6}
              placeholder="Describe tu solicitud con el mayor detalle posible"
            />
          </div>
          <button className="boton" type="submit" disabled={estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : "Enviar solicitud"}
          </button>
        </form>
      </div>
    </main>
  );
}
