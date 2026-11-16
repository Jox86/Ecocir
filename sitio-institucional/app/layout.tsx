import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sitio institucional",
  description:
    "Sitio web institucional: noticias, agenda de eventos, repositorio de documentos y ventanilla de contacto.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="cabecera">
          <div className="cabecera-interior">
            <div className="marca">
              <div className="marca-emblema">SI</div>
              <div>
                <p className="marca-nombre">Sitio Institucional</p>
                <p className="marca-lema">Atención, información y trámites en línea</p>
              </div>
            </div>
            <nav className="navegacion">
              <a href="/">Inicio</a>
              <a href="/nosotros">Nosotros</a>
              <a href="/noticias">Noticias</a>
              <a href="/contacto">Contacto</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="pie">
          Sitio institucional · gestión de usuarios, noticias, eventos, comentarios,
          contacto, documentos e inscripciones · uso interno de la institución
        </footer>
      </body>
    </html>
  );
}
