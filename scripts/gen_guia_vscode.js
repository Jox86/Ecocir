// Generador de la guía: Ejecución del proyecto en Visual Studio Code
// Sitio institucional + kit de despliegue Podman — skill docx (receta R1 + DS-1)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents, SectionType, TableLayoutType,
} = require("docx");
const fs = require("fs");

// ---------------------------------------------------------------- paleta DS-1
const P = {
  bg: "0B1C2C", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", innerLine: "BECFCC", surface: "E8ECEB" },
  headings: "0B1C2C", body: "000000", gray: "606060", code: "1C2A3D",
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
    const dos = wrapWords(title, maxWidthTwips, titlePt - 2);
    if (dos.length <= 2) { titlePt -= 2; lines = dos; break; }
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

function bulletRuns(runs) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 80 },
    children: runs.map(r => new TextRun({ size: 24, color: P.body,
      font: { ascii: "Times New Roman", eastAsia: "SimSun" }, ...r })),
  });
}

// bloque de comandos/código: monoespaciada sobre fondo claro
function bloque(lines) {
  return lines.map((line, idx) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "F0F4F3" },
    indent: { left: 240, right: 240 },
    spacing: { line: 312, before: idx === 0 ? 80 : 0, after: idx === lines.length - 1 ? 160 : 0 },
    children: [new TextRun({ text: line.length ? line : " ", size: 18,
      color: P.code, font: { ascii: "Courier New", eastAsia: "SimSun" } })],
  }));
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
          alignment: AlignmentType.LEFT,
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

function cabecera() {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8C8C8", space: 4 } },
    children: [new TextRun({ text: "Guía de ejecución en VS Code — sitio institucional y kit de despliegue",
      size: 18, color: "808080", font: { ascii: "Times New Roman" } })],
  })] });
}

function pie(colorMarca) {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: colorMarca,
      font: { ascii: "Times New Roman" } })],
  })] });
}

// ------------------------------------------------------------------- contenido
const cuerpo = [];

// 1. Objetivo y alcance
cuerpo.push(h1("1. Objetivo y alcance"));
cuerpo.push(p("Esta guía explica, paso a paso y desde cero, cómo ejecutar el sitio institucional en Visual Studio Code (VS Code) en el equipo de desarrollo, incluyendo la instalación de todas las herramientas necesarias. Al terminar, el lector tendrá el sitio funcionando en modo desarrollo en http://localhost:3000, el kit de despliegue ejecutándose contra él (testing, simulación de carga con 100 usuarios y simulación de datos en todas las interfaces) y, opcionalmente, el mismo sitio empaquetado en un contenedor Podman sin Docker, tal como se despliega en el servidor institucional."));
cuerpo.push(p("La guía cubre dos modos de ejecución complementarios. El modo desarrollo (npm run dev) se usa para programar y verificar cambios con recarga automática; es el modo natural de trabajo dentro de VS Code. El modo contenedor (Podman) reproduce el entorno del servidor institucional y se usa para validar el sitio tal y como llegará a producción. Los comandos de terminal se muestran en formato Linux/macOS; los equivalentes de Windows se indican en cada apartado (PowerShell para Node y npm, y Git Bash o WSL para los scripts del kit)."));

// 2. Instalación de herramientas
cuerpo.push(h1("2. Instalación de herramientas"));
cuerpo.push(h2("2.1 Componentes obligatorios"));
cuerpo.push(p("Antes de abrir el proyecto, instale los cinco componentes de la tabla 1. En Windows, la vía más cómoda es el gestor winget que incluye el propio sistema; en macOS, los instaladores oficiales; en Linux, el gestor de paquetes de la distribución. Tras cada instalación, cierre y vuelva a abrir la terminal para que se actualice la variable PATH, y ejecute el comando de verificación indicado: si responde con un número de versión, la herramienta quedó bien registrada."));
cuerpo.push(tablaTitulo("Tabla 1. Herramientas obligatorias y su verificación"));
cuerpo.push(tabla([
  ["Componente", "Versión", "Instalación", "Verificación"],
  ["Visual Studio Code", "Última estable", "Instalador oficial de code.visualstudio.com (o winget install Microsoft.VisualStudioCode)", "code --version"],
  ["Git", "2.30 o superior", "git-scm.com o winget install Git.Git", "git --version"],
  ["Node.js", "20 LTS", "nodejs.org (instalador LTS) o winget install OpenJS.NodeJS.LTS", "node -v"],
  ["npm", "Incluido con Node", "No requiere paso adicional", "npm -v"],
  ["Python 3", "3.10 o superior", "python.org o winget install Python.Python.3.12", "python3 --version"],
  ["curl", "Cualquiera", "Incluido en Linux/macOS; en Windows 10+ viene con el sistema", "curl --version"],
], [20, 16, 42, 22]));
cuerpo.push(p("En Linux, las mismas herramientas se instalan con un solo bloque de comandos en las distribuciones basadas en Debian o en Red Hat:"));
cuerpo.push(...bloque([
  "# Debian / Ubuntu",
  "sudo apt update && sudo apt install -y git curl python3 python3-pip",
  "",
  "# RHEL / Alma / Rocky",
  "sudo dnf install -y git curl python3",
  "",
  "# Node.js 20 LTS (vía nvm, para cualquier sistema UNIX)",
  "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash",
  "source ~/.bashrc && nvm install 20 && nvm use 20",
  "",
  "# Verificación",
  "node -v && npm -v && git --version && python3 --version && curl --version | head -1",
]));
cuerpo.push(h2("2.2 Visual Studio Code y extensiones recomendadas"));
cuerpo.push(p("Abra VS Code y, desde el panel de extensiones (icono de bloques en la barra lateral izquierda o Ctrl+Shift+X), instale las siguientes. Todas son gratuitas y oficiales: Prisma (resaltado y autocompletado del esquema de base de datos), ESLint y Prettier (calidad y formato de código), GitLens (historial de cambios) y, si va a usar contenedores, la extensión Podman o la de Docker, que también funciona apuntando al socket de Podman. En el equipo del sitio institucional esta última no es necesaria."));
cuerpo.push(h2("2.3 Podman (solo para el modo contenedor)"));
cuerpo.push(p("Podman es el motor de contenedores del kit y no necesita demonio ni privilegios de administrador. En Linux se instala con sudo dnf install podman (familia Red Hat) o sudo apt install podman (Debian/Ubuntu). En Windows, la vía recomendada es Podman Desktop, que instala y gestiona la máquina de contenedores; en macOS, brew install podman seguido de podman machine init y podman machine start. Verifique con podman --version; si se instala después de abrir VS Code, reinicie la aplicación para que la terminal integrada lo detecte."));

// 3. Abrir y preparar el sitio
cuerpo.push(h1("3. Abrir y preparar el sitio en VS Code"));
cuerpo.push(p("Con las herramientas instaladas, el flujo en VS Code es el siguiente. Cada paso incluye el comando exacto y el resultado esperado."));
cuerpo.push(pRuns([
  { text: "Paso 1. Abrir la carpeta del proyecto. ", bold: true },
  { text: "Si el código está en un repositorio Git, clónelo desde la terminal integrada (menú Ver → Terminal, atajo Ctrl+`) o desde la vista de control de código fuente de VS Code. Después, menú Archivo → Abrir carpeta y seleccione la carpeta raíz del sitio (la que contiene package.json)." },
]));
cuerpo.push(...bloque([
  "git clone <URL-DEL-REPOSITORIO-DEL-SITIO>",
  "cd <carpeta-del-sitio>",
]));
cuerpo.push(pRuns([
  { text: "Paso 2. Instalar dependencias. ", bold: true },
  { text: "En la terminal integrada de VS Code, descargue las librerías del proyecto. Esto crea la carpeta node_modules (no se versiona en Git) y puede tardar unos minutos la primera vez." },
]));
cuerpo.push(...bloque([
  "npm install",
]));
cuerpo.push(pRuns([
  { text: "Paso 3. Configurar la base de datos. ", bold: true },
  { text: "El proyecto usa SQLite mediante Prisma. Cree la carpeta de la base de datos y revise el archivo .env de la raíz: la variable DATABASE_URL debe apuntar a un archivo dentro del proyecto. Mantenga el valor que traiga el repositorio; el formato típico es el siguiente." },
]));
cuerpo.push(...bloque([
  "mkdir -p db",
  "# contenido del archivo .env",
  'DATABASE_URL="file:./db/custom.db"',
]));
cuerpo.push(pRuns([
  { text: "Paso 4. Generar el cliente y crear las tablas. ", bold: true },
  { text: "El primer comando genera el cliente tipado de Prisma a partir del esquema (prisma/schema.prisma); el segundo aplica las migraciones y crea el archivo de base de datos. Si el proyecto no incluye migraciones, use npx prisma db push en su lugar. Si define un semillero (prisma/seed), ejecútelo para tener datos iniciales." },
]));
cuerpo.push(...bloque([
  "npx prisma generate",
  "npx prisma migrate dev        # o: npx prisma db push",
  "npx prisma db seed            # opcional, si el proyecto define seed",
]));
cuerpo.push(pRuns([
  { text: "Paso 5. Arrancar el sitio en modo desarrollo. ", bold: true },
  { text: "Levante el servidor con recarga automática. VS Code mostrará en la terminal la URL local; ábrala con Ctrl+clic o en el navegador." },
]));
cuerpo.push(...bloque([
  "npm run dev",
  "# esperado: ready - started server on 0.0.0.0:3000",
  "# verificar desde otra terminal (Ctrl+` abre una nueva):",
  "curl -I http://localhost:3000",
]));
cuerpo.push(p("Si el puerto 3000 está ocupado, arranque en otro (npm run dev -- -p 3001) y anote el cambio: los scripts del kit apuntan por defecto a la URL configurada, y en el siguiente apartado se muestra cómo sobrescribirla con la variable BASE_URL."));

// 4. Ejecutar el kit
cuerpo.push(h1("4. Ejecutar el kit de despliegue contra el sitio"));
cuerpo.push(h2("4.1 Colocar el kit en el área de trabajo"));
cuerpo.push(p("La carpeta kit-despliegue-sitio puede vivir dentro del proyecto (por ejemplo, sitio/kit-despliegue-sitio) o abrirse como segunda carpeta del mismo espacio de trabajo con Archivo → Agregar carpeta al área de trabajo. La primera opción es la más simple, porque las rutas relativas de los scripts y del archivo de configuración funcionan sin ajustes; en los ejemplos siguientes se asume que la terminal está situada en la raíz del kit."));
cuerpo.push(h2("4.2 Testing y pruebas contra el sitio en desarrollo"));
cuerpo.push(p("Con el sitio corriendo en modo desarrollo (terminal 1), abra una segunda terminal en VS Code (botón + del panel de terminal), sitúese en la carpeta del kit y ejecute las tres pruebas. La variable BASE_URL indica el destino; no es necesaria si el sitio corre en el puerto 8080 del contenedor, pero sí en desarrollo."));
cuerpo.push(...bloque([
  "cd kit-despliegue-sitio",
  "chmod +x *.sh scripts/*.sh scripts/*.py    # solo la primera vez (Linux/macOS)",
  "export BASE_URL=http://localhost:3000",
  "",
  "./01-testing.sh                 # entrada, rutas e interfaces: OK / avisos / fallos",
  "./02-simulacion-carga.sh        # 100 usuarios simultáneos, 60 s, veredicto APTO/NO APTO",
  "./03-simular-datos.sh           # crea registros [SIM] en todas las interfaces",
]));
cuerpo.push(p("El script 02 guarda un informe JSON con percentiles y tasa de error en la carpeta reportes/ del kit, y el script 03 deja el manifiesto datos-simulados-manifiesto.json con todos los registros creados. Para limpiar los datos de prueba, el comando de eliminación está comentado a propósito (en 03-simular-datos.sh, al final del propio script de datos y en el README); descomente y ejecute:"));
cuerpo.push(...bloque([
  "# ./scripts/eliminar-datos-simulados.py --confirmar",
]));
cuerpo.push(p("En Windows, los scripts .sh deben ejecutarse desde Git Bash o desde WSL (bash ./01-testing.sh); npm, npx y los scripts Python funcionan igualmente desde PowerShell. Si un script falla por finales de línea (errores con \\r), configure el repositorio con git config core.autocrlf input antes de clonar."));
cuerpo.push(p("Una advertencia importante: el modo desarrollo de Next.js compila las páginas bajo demanda y es mucho más lento que producción, por lo que una prueba de carga en desarrollo puede marcar NO APTO sin que ello indique un problema del sitio. Use el modo desarrollo para validar que los scripts funcionan; el veredicto de capacidad debe tomarse contra el contenedor construido (apartado 5) o contra el servidor institucional."));

// 5. Modo contenedor
cuerpo.push(h1("5. Ejecutar el sitio en contenedor con Podman"));
cuerpo.push(p("Este modo reproduce el despliegue del servidor institucional sin Docker. Construya la imagen desde el código del sitio y arránquela con el volumen persistente; ambos pasos son los mismos scripts que se usan en el servidor, por lo que cualquier fallo aquí se reproduce allí."));
cuerpo.push(...bloque([
  "# desde la raíz del kit (APP_DIR apunta al código del sitio)",
  "APP_DIR=../<carpeta-del-sitio> ./deploy/podman-build.sh",
  "",
  "# arranque: publica http://localhost:8080 con volumen sitio-db-data",
  "./deploy/podman-run.sh",
  "",
  "# verificar y detener",
  "BASE_URL=http://localhost:8080 ./01-testing.sh",
  "./deploy/podman-logs.sh",
  "./deploy/podman-stop.sh",
]));
cuerpo.push(p("La primera construcción descarga la imagen base node:20-slim y tarda varios minutos; las siguientes aprovechan la cache de capas. El script de arranque aplica las migraciones de Prisma dentro del contenedor y deja la base de datos en el volumen sitio-db-data, que sobrevive a reinicios. Las pruebas del kit se ejecutan igual que en desarrollo, solo cambiando BASE_URL al puerto 8080. El servicio systemd con Quadlet descrito en el README no aplica en el equipo de desarrollo: es para el arranque automático en el servidor institucional."));

// 6. tasks.json
cuerpo.push(h1("6. Automatizar las tareas dentro de VS Code"));
cuerpo.push(p("Para no repetir comandos, defina las tareas en el archivo .vscode/tasks.json dentro de la carpeta del proyecto (créelo si no existe; se accede con Terminal → Configurar tareas). Después, cada acción se lanza con Terminal → Ejecutar tarea. El siguiente bloque asume el kit dentro del proyecto; ajuste las rutas si lo abre como carpeta independiente."));
cuerpo.push(...bloque([
  "{",
  '  "version": "2.0.0",',
  '  "tasks": [',
  '    { "label": "sitio: servidor de desarrollo", "type": "shell", "command": "npm run dev",',
  '      "isBackground": true, "problemMatcher": [] },',
  '    { "label": "kit: testing", "type": "shell", "command": "./kit-despliegue-sitio/01-testing.sh",',
  '      "options": { "env": { "BASE_URL": "http://localhost:3000" } }, "problemMatcher": [] },',
  '    { "label": "kit: carga 100 usuarios", "type": "shell",',
  '      "command": "./kit-despliegue-sitio/02-simulacion-carga.sh",',
  '      "options": { "env": { "BASE_URL": "http://localhost:3000" } }, "problemMatcher": [] },',
  '    { "label": "kit: simular datos", "type": "shell", "command": "./kit-despliegue-sitio/03-simular-datos.sh",',
  '      "options": { "env": { "BASE_URL": "http://localhost:3000" } }, "problemMatcher": [] },',
  '    { "label": "podman: construir imagen", "type": "shell",',
  '      "command": "APP_DIR=${workspaceFolder} ./kit-despliegue-sitio/deploy/podman-build.sh",',
  '      "problemMatcher": [] }',
  "  ]",
  "}",
]));
cuerpo.push(p("Con esto, el ciclo habitual de trabajo queda en dos clics: ejecutar la tarea del servidor de desarrollo, y en paralelo las tareas del kit. La tarea del servidor permanece activa en su propia terminal (isBackground), y las del kit terminan mostrando su veredicto en la terminal de salida."));

// 7. Problemas frecuentes
cuerpo.push(h1("7. Problemas frecuentes y su solución"));
cuerpo.push(p("Los fallos más habituales al ejecutar el proyecto por primera vez son de entorno (permisos, finales de línea, puertos ocupados) y tienen solución inmediata. La tabla 2 agrupa los síntomas típicos con la acción correctiva; si aparece un error de Prisma con código P1xxx, el mensaje incluye la causa exacta y la solución recomendada por la propia herramienta."));
cuerpo.push(tablaTitulo("Tabla 2. Diagnóstico rápido de problemas"));
cuerpo.push(tabla([
  ["Síntoma", "Causa habitual", "Solución"],
  ["Permiso denegado al ejecutar un .sh", "El archivo perdió el bit de ejecución", "chmod +x *.sh scripts/*.sh scripts/*.py; en Windows, usar Git Bash o WSL"],
  ["El .sh falla con errores que contienen \\r", "Finales de línea CRLF de Windows", "git config core.autocrlf input y re-clonar; o dos2unix sobre los scripts"],
  ["El puerto 3000 ya está en uso", "Otro proceso ocupa el puerto", "npm run dev -- -p 3001 y export BASE_URL=http://localhost:3001"],
  ["Cannot find module al arrancar", "node_modules incompleto o dañado", "Borrar node_modules y package-lock.json; npm install de nuevo"],
  ["Prisma no encuentra la base de datos", "Carpeta db sin crear o DATABASE_URL mal escrita", "Crear la carpeta, revisar .env y ejecutar npx prisma migrate dev"],
  ["podman: permiso denegado en puertos menores de 1024", "Rootless no puede enlazar puertos privilegiados", "Usar el 8080 (por defecto del kit) o elevar el límite con sysctl"],
  ["La carga marca NO APTO en desarrollo", "El modo dev compila bajo demanda", "Probar la carga contra el contenedor construido o el servidor"],
  ["Extensiones de Docker no conectan con Podman", "Socket no configurado", "Instalar Podman Desktop o apuntar la extensión al socket de Podman"],
], [28, 30, 42]));

// 8. Checklist
cuerpo.push(h1("8. Checklist final de verificación"));
cuerpo.push(p("Recorra esta lista en orden después de completar los apartados anteriores; cada punto debe cumplirse antes de pasar al siguiente. Si todos se verifican, el proyecto queda correctamente configurado en el equipo y cualquier cambio posterior solo requiere repetir los pasos 5 (arranque) y 4 (pruebas)."));
cuerpo.push(bullet("node -v responde con una versión v20.x y npm -v con la versión de npm."));
cuerpo.push(bullet("npm run dev levanta el sitio y http://localhost:3000 responde HTTP 200."));
cuerpo.push(bullet("./01-testing.sh termina con RESULTADO: APTO (avisos permitidos)."));
cuerpo.push(bullet("./02-simulacion-carga.sh sostiene 100 usuarios simultáneos y guarda el informe JSON en reportes/."));
cuerpo.push(bullet("./03-simular-datos.sh crea registros en las interfaces activas y genera el manifiesto; el comando de limpieza comentado funciona tras descomentarlo."));
cuerpo.push(bullet("Opcional: podman build y podman run dejan el sitio en http://localhost:8080 y el testing pasa contra ese puerto."));
cuerpo.push(p("Si algún punto falla, consulte la tabla 2 del apartado anterior; la mayoría de los problemas se resuelven con una de las ocho acciones listadas allí."));

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
  // El salto de página lo aporta la sección siguiente (NEXT_PAGE).
];

// ------------------------------------------------------------------ documento
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "Área de Tecnología",
  title: "Guía de ejecución en Visual Studio Code — sitio institucional",
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
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Guía de Ejecución en Visual Studio Code",
        subtitle: "Del código al contenedor: desarrollo local, kit de despliegue y Podman",
        englishLabel: "GUIA PASO A PASO",
        metaLines: [
          "Documento operativo del kit de despliegue kit-despliegue-sitio",
          "Modos cubiertos: desarrollo local (npm run dev) y contenedor (Podman)",
          "Audiencia: equipo de desarrollo y administración de TI",
          "Fecha de elaboración: 16 de noviembre de 2026",
        ],
        footerLeft: "Área de Tecnología — uso interno",
        footerRight: "Noviembre de 2026",
        palette: P,
      }),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: cabecera() },
      footers: { default: pie("707070") },
      children: indice,
    },
    {
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

const SALIDA = "/home/z/my-project/download/kit-despliegue-sitio/docs/Guia_ejecucion_VS_Code.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(SALIDA, buf);
  console.log("Documento generado:", SALIDA, "(" + buf.length + " bytes)");
});
