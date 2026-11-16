// Generador del informe: Estimación de requisitos de almacenamiento
// Sitio institucional en contenedor Podman — skill docx (receta R1 + DS-1)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents, SectionType, TableLayoutType,
} = require("docx");
const fs = require("fs");

// ---------------------------------------------------------------- paleta DS-1
const P = {
  bg: "0B1C2C", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", innerLine: "BECFCC", surface: "E8ECEB" },
  headings: "0B1C2C", body: "000000", gray: "606060",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ------------------------------------------------- título latino (width-aware)
function estimateTextWidth(text, pt) {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isCJK = (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f);
    w += isCJK ? pt * 20 : pt * 11;
  }
  return w;
}

function wrapWords(title, maxWidthTwips, pt) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (estimateTextWidth(candidate, pt) <= maxWidthTwips || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  // sin líneas huérfanas de 1-2 caracteres
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcTitleLayoutLatin(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  let titlePt = preferredPt;
  let lines = wrapWords(title, maxWidthTwips, titlePt);
  while (titlePt > minPt && lines.length > 3) {
    titlePt -= 2;
    lines = wrapWords(title, maxWidthTwips, titlePt);
  }
  while (titlePt > minPt && lines.length > 2) {
    const two = wrapWords(title, maxWidthTwips, titlePt - 2);
    if (two.length <= 2) { titlePt -= 2; lines = two; break; }
    break;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ------------------------------------------------------------- portada (R1)
function buildCoverR1(config) {
  const C = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayoutLatin(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: C.accent, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: C.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: C.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: C.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ------------------------------------------------------------ cuerpo / estilos
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.headings,
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.headings,
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120, ...(opts.spacing || {}) },
    children: [new TextRun({ text, size: 24, color: P.body,
      font: { ascii: "Times New Roman", eastAsia: "SimSun" } })],
  });
}

function pRuns(runs, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120, ...(opts.spacing || {}) },
    children: runs.map(r => new TextRun({ size: 24, color: P.body,
      font: { ascii: "Times New Roman", eastAsia: "SimSun" }, ...r })),
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: P.body,
      font: { ascii: "Times New Roman", eastAsia: "SimSun" } })],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200, line: 312 },
    children: [new TextRun({ text, size: 21, color: P.gray, italics: true,
      font: { ascii: "Times New Roman", eastAsia: "SimSun" } })],
  });
}

function tablaTitulo(text) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.headings,
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}

// Tabla estilo Horizontal-Only (negocio) con tokens de la paleta DS-1
// filas: [[c1, c2, ...], ...]; primera fila = encabezado. alinearDer: índices de columnas numéricas
function tabla(filas, anchosPct, alinearDer = []) {
  const bordes = {
    top: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: P.accent },
    left: NB, right: NB,
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
    insideVertical: NB,
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordes,
    rows: filas.map((celdas, idx) => new TableRow({
      tableHeader: idx === 0,
      cantSplit: true,
      children: celdas.map((texto, col) => new TableCell({
        width: { size: anchosPct[col], type: WidthType.PERCENTAGE },
        shading: idx === 0
          ? { type: ShadingType.CLEAR, fill: P.table.headerBg }
          : (idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: P.table.surface } : undefined),
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: (idx > 0 && alinearDer.includes(col)) ? AlignmentType.RIGHT
            : (idx === 0 ? AlignmentType.LEFT : AlignmentType.LEFT),
          spacing: { line: 312 },
          children: [new TextRun({
            text: String(texto), size: 21,
            bold: idx === 0,
            color: idx === 0 ? P.table.headerText : P.body,
            font: { ascii: "Times New Roman", eastAsia: "SimSun" },
          })],
        })],
      })),
    })),
  });
}

// ------------------------------------------------------------------ cabecera
function cabecera() {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8C8C8", space: 4 } },
    children: [new TextRun({ text: "Estimación de requisitos de almacenamiento — sitio institucional",
      size: 18, color: "808080", font: { ascii: "Times New Roman" } })],
  })] });
}

// pies de página: color marcador 707070 = romanos; 808080 = arábigos (postproceso)
function pie(colorMarca) {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: colorMarca,
      font: { ascii: "Times New Roman" } })],
  })] });
}

// ------------------------------------------------------------------- imagen
const img = fs.readFileSync("/home/z/my-project/scripts/assets/grafico_almacenamiento.png");
// dimensiones reales 2000×1100 → proporción preservada
const ANCHO_IMG = 480;
const ALTO_IMG = Math.round(ANCHO_IMG * (1100 / 2000)); // 264

// ------------------------------------------------------------------ contenido
const cuerpo = [];

// 1. Resumen ejecutivo
cuerpo.push(h1("1. Resumen ejecutivo"));
cuerpo.push(p("Este documento estima el espacio de almacenamiento que el sitio institucional requiere cuando se despliega en contenedor sobre el servidor de la institución, utilizando Podman como motor de contenedores (el servidor no permite Docker). La estimación cubre los cinco componentes que consumen disco en este despliegue: la imagen y cache del contenedor, la base de datos SQLite, los archivos que suben los usuarios, los registros del sistema (logs) y las copias de seguridad. El cálculo se realizó con un modelo de crecimiento por componente y supuestos conservadores, declarados en la sección 3, y es reproducible mediante el script calcular-almacenamiento.py incluido en el kit de despliegue."));
cuerpo.push(pRuns([
  { text: "El resultado principal es el siguiente: al primer año de operación el sitio necesita aproximadamente " },
  { text: "10,08 GB", bold: true },
  { text: "; al tercer año, " },
  { text: "20,08 GB", bold: true },
  { text: "; y al quinto año, " },
  { text: "30,13 GB", bold: true },
  { text: ". El componente dominante no es la base de datos ni el contenedor, sino las copias de seguridad, que representan cerca del 69 % del total al quinto año. Los registros permanecen constantes porque se les asigna un presupuesto fijo mediante rotación, y los archivos subidos crecen de forma lineal con la actividad editorial." },
]));
cuerpo.push(pRuns([
  { text: "La recomendación de dimensionamiento es un " },
  { text: "espacio mínimo operativo de 30 GB", bold: true },
  { text: " (tercer año con un margen del 25 %) y un " },
  { text: "espacio recomendado de 50 GB", bold: true },
  { text: ", que cubre el horizonte de cinco años con holgura para picos, actualizaciones de imagen y el propio sistema operativo. Se recomienda además destinar las copias de seguridad a un dispositivo o volumen separado del disco principal, de modo que un fallo de hardware no destruya simultáneamente los datos y sus respaldos. Las cifras son estimaciones: la sección 6 define las mediciones que deben tomarse durante los primeros seis meses para calibrar el modelo." },
]));

// 2. Alcance y contexto
cuerpo.push(h1("2. Alcance y contexto del despliegue"));
cuerpo.push(p("El sitio institucional se ejecuta como aplicación Node.js (Next.js) con base de datos SQLite gestionada mediante Prisma, dentro de un contenedor construido con el Containerfile del kit de despliegue. Dado que el servidor institucional no permite Docker, el kit emplea Podman en modo rootless, que no requiere un demonio privilegiado y se integra con systemd mediante Quadlet para el arranque automático. El almacenamiento de contenedores (imágenes, capas y cache de construcción) reside en el almacén de Podman del usuario de servicio, típicamente en ~/.local/share/containers/storage."));
cuerpo.push(p("Los datos persistentes del sitio viven en un volumen nombrado de Podman (sitio-db-data) montado en /app/db dentro del contenedor; allí se guarda la base de datos SQLite definida por la variable DATABASE_URL. Las copias de seguridad se realizan con el script deploy/podman-backup.sh, que ejecuta una copia en caliente de la base de datos (comando .backup de sqlite3, sin detener el servicio) y empaqueta los archivos publicados en la carpeta public/ del contenedor. Las mediciones de este informe incluyen los cinco componentes siguientes y excluyen el sistema operativo del servidor y otros servicios institucionales que compartan la misma máquina:"));
cuerpo.push(bullet("Imagen del contenedor y cache de construcción de Podman (presupuesto de podman storage)."));
cuerpo.push(bullet("Base de datos SQLite dentro del volumen sitio-db-data."));
cuerpo.push(bullet("Archivos subidos por los usuarios y contenidos publicados (carpeta public/)."));
cuerpo.push(bullet("Registros del contenedor (journald) y registro de accesos opcional."));
cuerpo.push(bullet("Copias de seguridad generadas por podman-backup.sh con su retención definida."));

// 3. Metodología
cuerpo.push(h1("3. Metodología y supuestos de cálculo"));
cuerpo.push(p("El cálculo sigue un modelo ascendente por componente: para cada componente se define un tamaño unitario y un ritmo de generación anual, se multiplica por el horizonte de tiempo y se aplican los factores de corrección correspondientes. Para la base de datos se aplica un factor de sobrecarga de 1,35 que cubre índices, páginas parcialmente ocupadas y espacio libre interno de SQLite; para las copias de la base de datos se asume una relación de compresión del 40 % del tamaño original. Todos los valores se calcularon con el script de cálculo calcular-almacenamiento.py incluido en el kit, de modo que cualquier supuesto puede modificarse y recalcularse sin ambigüedad."));
cuerpo.push(p("Los supuestos de actividad corresponden a una institución de tamaño medio y se declaran explícitamente para que puedan ajustarse a la realidad de cada organización. La tabla 1 resume los parámetros utilizados. Si la institución prevé valores distintos (por ejemplo, un volumen mayor de documentos o un registro de auditoría más detallado), el efecto sobre el total es lineal y puede recalcularse directamente."));
cuerpo.push(tablaTitulo("Tabla 1. Supuestos de actividad y de contenido"));
cuerpo.push(tabla([
  ["Parámetro", "Valor supuesto"],
  ["Usuarios registrados", "1.000 en el año 1, con crecimiento del 20 % anual"],
  ["Noticias o anuncios", "5 por semana (260 al año), con imagen media de 400 KB"],
  ["Comentarios", "20 por día (7.300 al año)"],
  ["Eventos en la agenda", "2 por mes (24 al año), con 8 fotos de 2 MB por evento"],
  ["Mensajes del formulario de contacto", "30 por día (10.950 al año)"],
  ["Documentos publicados", "5 por semana (260 al año), PDF medio de 1,2 MB"],
  ["Entradas de auditoría o sesiones", "200 por día (73.000 al año), 0,5 KB por fila"],
  ["Tráfico web de referencia", "Pico de 100 usuarios simultáneos, unos 864.000 accesos diarios"],
  ["Retención de copias", "30 copias diarias de base de datos y 4 semanales de archivos"],
], [40, 60]));

// 4. Dimensionamiento por componente
cuerpo.push(h1("4. Dimensionamiento por componente"));

cuerpo.push(h2("4.1 Contenedor e imágenes de Podman"));
cuerpo.push(p("La imagen final del sitio se construye en tres etapas sobre la base node:20-slim y contiene las dependencias de producción completas para maximizar la fiabilidad en el servidor institucional. El desglose estimado es el siguiente: capa base con Node.js, sqlite3 y certificados, unos 230 MB; dependencias de producción (node_modules, incluido el cliente de Prisma), unos 420 MB; y la salida de construcción de la aplicación (.next), unos 130 MB. La imagen final ronda por tanto los 780 MB."));
cuerpo.push(pRuns([
  { text: "A ello se suma la cache de construcción: cada compilación conserva capas intermedias (etapas de dependencias y de construcción) que duplican temporalmente las dependencias y añaden los artefactos de compilación, unos " },
  { text: "1,11 GB adicionales", bold: true },
  { text: ". El presupuesto total para el almacén de contenedores se fija en " },
  { text: "1,88 GB", bold: true },
  { text: ", un valor estable en el tiempo que no crece con la actividad del sitio. La medida operativa correspondiente (ejecutar podman image prune y podman builder prune tras cada actualización de imagen) se detalla en la sección 6." },
]));

cuerpo.push(h2("4.2 Base de datos SQLite"));
cuerpo.push(p("La base de datos crece con el número de filas de cada tabla. La tabla 2 muestra el tamaño medio estimado por fila y el ritmo de creación de registros por año según los supuestos de la sección 3. Aplicando el factor de sobrecarga de 1,35 de SQLite, la base pasa de unos 84 MB al terminar el primer año a unos 250 MB al tercer año y unos 417 MB al quinto. Se trata del componente de crecimiento más predecible del sistema y, en términos absolutos, de impacto reducido: incluso en el horizonte de cinco años su aportación al total es inferior al 2 %."));
cuerpo.push(p("Conviene mantener dos hábitos de administración. Primero, tras cargas masivas de prueba o borrados grandes, ejecutar VACUUM para devolver a el sistema operativo el espacio libre interno que SQLite acumula. Segundo, tras cada simulación de datos del kit, eliminar los registros marcados con el prefijo [SIM] mediante el comando de limpieza que acompaña a los scripts (dejado comentado a propósito en el script 03), para que los datos de prueba no se conviertan en volumen permanente."));
cuerpo.push(tablaTitulo("Tabla 2. Crecimiento estimado de la base de datos por tabla"));
cuerpo.push(tabla([
  ["Tabla", "Tamaño por fila", "Filas por año", "Año 1", "Año 3", "Año 5"],
  ["usuarios (1.000 iniciales)", "1,0 KB", "+20 %/año", "14 KB", "20 KB", "28 KB"],
  ["noticias", "3,0 KB", "260", "1,0 MB", "3,1 MB", "5,1 MB"],
  ["comentarios", "1,2 KB", "7.300", "11,6 MB", "34,9 MB", "58,2 MB"],
  ["eventos", "2,0 KB", "24", "0,1 MB", "0,1 MB", "0,2 MB"],
  ["mensajes de contacto", "1,5 KB", "10.950", "22,5 MB", "67,4 MB", "112,4 MB"],
  ["documentos (metadatos)", "1,0 KB", "260", "0,3 MB", "1,0 MB", "1,7 MB"],
  ["auditoría y sesiones", "0,5 KB", "73.000", "49,4 MB", "148,3 MB", "247,1 MB"],
  ["Total con sobrecarga 1,35", "", "", "84,1 MB", "250,2 MB", "416,5 MB"],
], [34, 14, 14, 12, 13, 13], [3, 4, 5]));
cuerpo.push(p("Los valores individuales de la tabla 2 se muestran sin el factor de sobrecarga y sirven para localizar qué tablas dominan el crecimiento; el total de la última fila sí lo incluye. La tabla de auditoría y sesiones concentra cerca del 60 % del crecimiento, por lo que si la institución decide reducir su período de retención (por ejemplo, purgar entradas de más de un año), la base de datos se mantendría prácticamente plana."));

cuerpo.push(h2("4.3 Archivos subidos por los usuarios"));
cuerpo.push(p("El contenido publicado genera el mayor crecimiento binario: alrededor de 798 MB fijos por año, más los avatares asociados al padrón de usuarios (50 KB por usuario). El desglose anual es el siguiente: imágenes de las noticias, 260 archivos de 400 KB, unos 104 MB; documentos PDF publicados, 260 archivos de 1,2 MB, unos 312 MB; y fotografías de los eventos, 24 eventos con 8 fotos de 2 MB, unos 384 MB. Con los avatares, el acumulado alcanza 846 MB al primer año, 2,41 GB al tercer año y 3,99 GB al quinto."));
cuerpo.push(p("Este componente depende directamente de la política editorial de la institución. Si se publican documentos de gran tamaño (por ejemplo, memorias anuales de decenas de megabytes) o galerías fotográficas amplias, la cifra anual puede multiplicarse; por ello la recomendación de la sección 5 reserva margen adicional sobre la proyección lineal. El script de copias de seguridad empaqueta estos archivos semana a semana, de modo que su crecimiento también eleva el tamaño de los respaldos, efecto que ya está contemplado en la sección 4.5."));

cuerpo.push(h2("4.4 Registros del sistema (logs)"));
cuerpo.push(p("Sin ningún control, los registros serían el componente más peligroso del despliegue: con picos de 100 usuarios simultáneos y unos 864.000 accesos diarios, la salida estándar del contenedor y el registro de accesos generarían unos 206 MB diarios sin comprimir, es decir, más de 70 GB al año. Por esta razón el dimensionamiento no los trata como crecimiento variable sino como un presupuesto fijo, que se garantiza aplicando configuración de rotación y límite."));
cuerpo.push(p("El presupuesto asignado es de 3 GB en total: 1 GB para el diario del sistema (journald) limitado mediante la opción SystemMaxUse, y 2 GB para el registro de accesos si se activa, con rotación de 14 días mediante logrotate. Con esta configuración el componente permanece constante durante toda la vida del servicio, con independencia del tráfico. Si la institución añade análisis de acceso o retención más larga, deberá ampliar el presupuesto en consecuencia; la sección 6 incluye la acción concreta de configuración."));

cuerpo.push(h2("4.5 Copias de seguridad"));
cuerpo.push(p("El script de respaldo mantiene 30 copias diarias de la base de datos (comprimidas a aproximadamente el 40 % de su tamaño) y 4 copias semanales del conjunto de archivos subidos. La combinación de ambos produce el componente de mayor peso del dimensionamiento: 4,29 GB al primer año, 12,55 GB al tercero y 20,85 GB al quinto, es decir, cerca del 69 % del total al final del horizonte. El script aplica la retención automáticamente, por lo que este techo se cumple sin intervención manual."));
cuerpo.push(p("Si el espacio se vuelve limitado, existen tres palancas en orden de preferencia. Primera, reducir la retención de copias de base de datos de 30 a 14 días, lo que recorta a la mitad ese bloque. Segunda, enviar las copias a un almacenamiento externo (NAS o disco dedicado), que además mejora la protección frente a fallos del servidor. Tercera, pasar a copias incrementales de los archivos subidos, que solo empaquetan las novedades semanales. Ninguna de las tres compromete la recuperación del servicio; la figura 1 resume el peso relativo de cada componente en los tres horizontes."));
cuerpo.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  keepNext: true,
  spacing: { before: 120, after: 40 },
  children: [new ImageRun({ data: img, transformation: { width: ANCHO_IMG, height: ALTO_IMG }, type: "png" })],
}));
cuerpo.push(caption("Figura 1. Requisitos estimados por componente y horizonte (GB)."));

// 5. Resumen y recomendación
cuerpo.push(h1("5. Resumen por horizonte y recomendación de dimensionamiento"));
cuerpo.push(p("La tabla 3 consolida los cinco componentes en los tres horizontes de planificación. El total del primer año queda determinado por los presupuestos fijos (contenedor, registros y primeras copias); a partir de ahí el crecimiento anual neto se estabiliza en torno a 5 GB por año, dominado por las copias de seguridad y los archivos subidos."));
cuerpo.push(tablaTitulo("Tabla 3. Requisitos totales por componente y horizonte"));
cuerpo.push(tabla([
  ["Componente", "Año 1", "Año 3", "Año 5"],
  ["Contenedor y cache de Podman", "1,88 GB", "1,88 GB", "1,88 GB"],
  ["Base de datos SQLite", "0,08 GB", "0,25 GB", "0,42 GB"],
  ["Archivos subidos", "0,85 GB", "2,41 GB", "3,99 GB"],
  ["Registros (presupuesto fijo)", "3,00 GB", "3,00 GB", "3,00 GB"],
  ["Copias de seguridad", "4,29 GB", "12,55 GB", "20,85 GB"],
  ["Total", "10,08 GB", "20,08 GB", "30,13 GB"],
], [40, 20, 20, 20], [1, 2, 3]));
cuerpo.push(pRuns([
  { text: "Sobre estos totales, la recomendación oficial es doble. Como " },
  { text: "mínimo operativo", bold: true },
  { text: ", 30 GB de espacio para el servicio (tercer año con un margen del 25 %), cifra que sirve para aprovisionar el servidor si el presupuesto es rígido. Como " },
  { text: "dimensionamiento recomendado", bold: true },
  { text: ", 50 GB, que cubre los cinco años con holgura para el sistema operativo, los picos de publicaciones y la reconstrucción de imágenes. La tabla 4 propone cómo repartir ese espacio de 50 GB." },
]));
cuerpo.push(tablaTitulo("Tabla 4. Reparto sugerido del espacio recomendado (50 GB)"));
cuerpo.push(tabla([
  ["Bloque", "Espacio", "Contenido"],
  ["Almacén de contenedores Podman", "2 GB", "Imagen final, capas y cache de construcción"],
  ["Volumen de datos del sitio", "6 GB", "Base de datos SQLite y archivos subidos (volumen sitio-db-data)"],
  ["Copias de seguridad", "25 GB", "Respaldos del kit con retención completa hasta el año 5"],
  ["Registros con presupuesto fijo", "3 GB", "journald limitado y registro de accesos rotado"],
  ["Margen operativo y sistema", "14 GB", "Sistema operativo, temporales, picos y folgura de administración"],
], [34, 14, 52], [1]));
cuerpo.push(p("Cuando el servidor lo permita, las copias de seguridad deben dirigirse a un segundo dispositivo (disco adicional, NAS o compartido de red institucional). Esta separación no cambia el espacio total necesario, pero evita que un fallo del disco principal afecte a la vez a los datos y a sus respaldos, y simplifica la restauración sobre un servidor de reemplazo."));

// 6. Medidas operativas
cuerpo.push(h1("6. Medidas operativas para contener el crecimiento"));
cuerpo.push(p("El dimensionamiento anterior solo se cumple si las medidas de contención se aplican de forma disciplinada. Ninguna requiere software adicional: se apoya en el propio kit de despliegue (scripts de copia y de limpieza) y en las herramientas estándar del servidor (systemd-journald, logrotate, podman). La tabla 5 recoge cada acción, su periodicidad y el efecto esperado."));
cuerpo.push(tablaTitulo("Tabla 5. Plan de mantenimiento del almacenamiento"));
cuerpo.push(tabla([
  ["Acción", "Periodicidad", "Efecto esperado"],
  ["Copia de seguridad con deploy/podman-backup.sh (programada con cron o temporizador de systemd a las 02:00)", "Diaria", "Mantiene los respaldos dentro del presupuesto de la sección 4.5"],
  ["podman image prune -f y podman builder prune -f tras cada actualización de imagen", "Tras cada despliegue", "Libera la cache de construcción obsoleta (hasta 1,1 GB por ciclo)"],
  ["SystemMaxUse=1G en journald y rotación de 14 días para el registro de accesos", "Configuración única", "Fija el techo de registros en 3 GB con independencia del tráfico"],
  ["Eliminación de los datos simulados [SIM] tras las pruebas de carga y de datos", "Tras cada simulación", "Evita que los datos de prueba ocupen volumen permanente"],
  ["VACUUM de la base de datos SQLite", "Trimestral", "Devuelve el espacio libre interno acumulado por borrados"],
  ["Medición real con podman system df y du sobre el volumen de datos", "Semestral", "Calibra los supuestos del modelo y anticipa ampliaciones"],
], [44, 18, 38]));
cuerpo.push(p("La primera medición semestral es la más importante: comparar el tamaño real de la base de datos y de los archivos subidos con las proyecciones de la tabla 3 permite detectar temprano cualquier supuesto desviado (por ejemplo, documentos más grandes de lo previsto). Si el consumo real supera la proyección en más de un 20 %, conviene ampliar la retención de espacio o revisar la política editorial antes de que el margen de 50 GB se comprometa."));

// 7. Conclusiones
cuerpo.push(h1("7. Conclusiones"));
cuerpo.push(p("El despliegue del sitio institucional en contenedor Podman es exigente en administración pero moderado en almacenamiento: con los supuestos declarados, la operación completa del servicio cabe en 30 GB durante tres años y en algo más de 30 GB a los cinco años. La cifra recomendada de 50 GB ofrece protección suficiente frente a desviaciones del modelo, y el bloque de copias de seguridad es el único componente que justifica atención presupuestaria a medio plazo."));
cuerpo.push(p("El cumplimiento de las cifras depende de tres configuraciones que deben quedar aplicadas desde el primer día: la limitación de journald, la retención automática de los respaldos (ya implementada en el kit) y la limpieza de cache de Podman tras cada actualización. Con ello, el almacenamiento deja de ser un factor de riesgo para el servicio y se convierte en una partida planificable dentro del mantenimiento ordinario del servidor institucional."));

// ------------------------------------------------------------- índice (TOC)
const indice = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Índice de contenidos", bold: true, size: 32,
      font: { eastAsia: "SimHei", ascii: "Times New Roman" }, color: P.headings })],
  }),
  new TableOfContents("Tabla de contenidos", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Nota: este índice se genera mediante campos de Word. Tras editar el documento, haga clic derecho sobre el índice y elija Actualizar campos para refrescar la paginación.",
      italics: true, size: 18, color: "888888", font: { ascii: "Times New Roman" } })],
  }),
  // El salto de página lo aporta la propia sección siguiente (NEXT_PAGE):
  // añadir además un PageBreak aquí provocaría una página en blanco.
];

// ------------------------------------------------------------------ documento
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "Área de Tecnología",
  title: "Estimación de requisitos de almacenamiento — sitio institucional",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: P.headings },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: P.headings },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: P.headings },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    { // Sección 1: portada (sin numeración ni pie)
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Estimación de Requisitos de Almacenamiento",
        subtitle: "Sitio institucional desplegado en contenedor Podman (sin Docker)",
        englishLabel: "DIMENSIONAMIENTO",
        metaLines: [
          "Documento técnico del kit de despliegue kit-despliegue-sitio",
          "Plataforma: servidor institucional con Podman rootless y systemd",
          "Aplicación: sitio web institucional (Node.js, Prisma y SQLite)",
          "Fecha de elaboración: 16 de noviembre de 2026",
        ],
        footerLeft: "Área de Tecnología — uso interno",
        footerRight: "Noviembre de 2026",
        palette: P,
      }),
    },
    { // Sección 2: índice (números romanos)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: cabecera() },
      footers: { default: pie("707070") },
      children: indice,
    },
    { // Sección 3: cuerpo (números arábigos desde 1)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: cabecera() },
      footers: { default: pie("808080") },
      children: cuerpo,
    },
  ],
});

fs.mkdirSync("/home/z/my-project/download/kit-despliegue-sitio/docs", { recursive: true });
const SALIDA = "/home/z/my-project/download/kit-despliegue-sitio/docs/Estimacion_requisitos_almacenamiento.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(SALIDA, buf);
  console.log("Documento generado:", SALIDA, "(" + buf.length + " bytes)");
});
