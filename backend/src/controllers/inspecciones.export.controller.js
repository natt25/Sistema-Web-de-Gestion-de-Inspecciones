import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import exportRepo from "../repositories/inspecciones.export.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_SRC_ROOT = path.resolve(__dirname, "..");
const FONT_NAME = "Arial";
const BORDER_COLOR = "FF111111";
const TITLE_FILL = "FF1F4E78";
const SECTION_FILL = "FFD9E2F3";
const HEADER_FILL = "FFB4C6E7";
const LABEL_FILL = "FFF3F4F6";

function safeText(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return stringifyRowDataForExport(value) || fallback;
}

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stringifyRowDataForExport(value, indent = 0) {
  const parsed = safeJsonParse(value);
  if (parsed == null) return "";
  if (typeof parsed === "string") return parsed.trim();
  if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => stringifyRowDataForExport(item, indent + 1))
      .filter(Boolean)
      .map((item) => `${" ".repeat(indent * 2)}- ${item}`)
      .join("\n");
  }
  if (typeof parsed === "object") {
    return Object.entries(parsed)
      .filter(([key]) => key !== "__tipo")
      .map(([key, item]) => {
        const text = stringifyRowDataForExport(item, indent + 1);
        if (!text) return "";
        if (text.includes("\n")) {
          return `${" ".repeat(indent * 2)}${key}:\n${text}`;
        }
        return `${" ".repeat(indent * 2)}${key}: ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(parsed);
}

function toDisplayDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return safeText(value);
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDisplayDateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return safeText(value);
  return d.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function sanitizeFileNameSegment(value, fallback = "Inspeccion") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.replace(/[\\/:*?"<>|]/g, "_");
}

function buildDownloadFileName(cabecera, id) {
  const code = sanitizeFileNameSegment(cabecera?.codigo_formato, "Inspeccion");
  return `${code}_Inspeccion_${id}.xlsx`;
}

function normalizeImagePath(value) {
  return String(value || "").trim().split("?")[0].split("#")[0];
}

function resolveStorageFilePath(rawPath) {
  const cleanPath = normalizeImagePath(rawPath);
  if (!cleanPath || /^https?:\/\//i.test(cleanPath)) return null;
  if (path.isAbsolute(cleanPath) && fs.existsSync(cleanPath)) return cleanPath;

  const normalized = cleanPath.replace(/^\/+/, "").replace(/\\/g, "/");
  const candidates = [
    path.resolve(PROJECT_ROOT, normalized),
    path.resolve(PROJECT_ROOT, "backend", normalized),
    path.resolve(PROJECT_ROOT, "backend", "src", normalized),
    path.resolve(PROJECT_ROOT, "src", normalized),
    path.resolve(BACKEND_SRC_ROOT, normalized),
  ];

  if (normalized.toLowerCase().startsWith("storage/")) {
    const withoutStorage = normalized.replace(/^storage\//i, "");
    candidates.push(path.resolve(PROJECT_ROOT, "backend", "src", "storage", withoutStorage));
    candidates.push(path.resolve(BACKEND_SRC_ROOT, "storage", withoutStorage));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function getImageExtension(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".png") return "png";
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  return null;
}

function imageExists(rawPath) {
  const resolved = resolveStorageFilePath(rawPath);
  if (!resolved) return null;
  const extension = getImageExtension(resolved);
  if (!extension) return null;
  return { resolved, extension };
}

function buildCellImageBox(colNumber, rowNumber, { paddingX = 0.14, paddingY = 0.18 } = {}) {
  const col = Math.max(0, Number(colNumber) - 1);
  const row = Math.max(0, Number(rowNumber) - 1);
  return {
    tl: { col: col + paddingX, row: row + paddingY },
    br: { col: col + 1 - paddingX, row: row + 1 - paddingY },
    editAs: "oneCell",
  };
}

function buildSignatureImageBox(rowNumber) {
  const row = Math.max(0, Number(rowNumber) - 1);
  return {
    tl: { col: 6.18, row: row + 0.14 },
    br: { col: 7.82, row: row + 0.86 },
    editAs: "oneCell",
  };
}

function setAllBorders(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER_COLOR } },
    left: { style: "thin", color: { argb: BORDER_COLOR } },
    bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    right: { style: "thin", color: { argb: BORDER_COLOR } },
  };
}

function applyBordersToRange(ws, rowStart, colStart, rowEnd, colEnd) {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      setAllBorders(ws.getRow(row).getCell(col));
    }
  }
}

function styleReportTitle(cell) {
  cell.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
  setAllBorders(cell);
}

function styleSectionHeader(cell) {
  cell.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: "FF111827" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
  setAllBorders(cell);
}

function styleTableHeader(cell) {
  cell.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FF111827" } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  setAllBorders(cell);
}

function styleBodyCell(cell) {
  cell.font = { name: FONT_NAME, size: 10, color: { argb: "FF111827" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  setAllBorders(cell);
}

function styleWrappedCell(cell) {
  styleBodyCell(cell);
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}

function styleLabelCell(cell) {
  styleWrappedCell(cell);
  cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: "FF111827" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LABEL_FILL } };
}

function appendBlankRow(ws) {
  ws.addRow([]);
}

function appendSectionTitle(ws, title, totalColumns = 7) {
  const row = ws.addRow([title]);
  ws.mergeCells(row.number, 1, row.number, totalColumns);
  row.height = 22;
  styleSectionHeader(row.getCell(1));
  applyBordersToRange(ws, row.number, 1, row.number, totalColumns);
  return row.number;
}

function appendKeyValueTable(ws, rows, options = {}) {
  const {
    labelFromCol = 1,
    labelToCol = 1,
    valueFromCol = 2,
    valueToCol = 2,
  } = options;
  const startRow = ws.rowCount + 1;
  for (const [label, value] of rows) {
    const row = ws.addRow([]);
    row.height = 24;
    ws.mergeCells(row.number, labelFromCol, row.number, labelToCol);
    ws.mergeCells(row.number, valueFromCol, row.number, valueToCol);
    row.getCell(labelFromCol).value = safeText(label, "—");
    row.getCell(valueFromCol).value = safeText(value, "—");
    styleLabelCell(row.getCell(labelFromCol));
    styleWrappedCell(row.getCell(valueFromCol));
  }
  const endRow = ws.rowCount;
  applyBordersToRange(ws, startRow, labelFromCol, endRow, valueToCol);
  return { startRow, endRow };
}

function appendTable(ws, columns, rows, options = {}) {
  const {
    rowHeight = 20,
    valueFormatter,
  } = options;

  const startRow = ws.rowCount + 1;
  const header = ws.addRow(columns.map((column) => column.header));
  header.height = 24;
  header.eachCell((cell) => styleTableHeader(cell));

  for (const item of rows) {
    const row = ws.addRow(
      columns.map((column) => {
        const raw = typeof column.value === "function" ? column.value(item) : item?.[column.value];
        return valueFormatter ? valueFormatter(raw, column, item) : raw;
      })
    );
    row.height = rowHeight;
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      if (column.wrap !== false) styleWrappedCell(cell);
      else styleBodyCell(cell);
    });
  }

  if (!rows.length) {
    const row = ws.addRow(["Sin registros"]);
    ws.mergeCells(row.number, 1, row.number, columns.length);
    styleWrappedCell(row.getCell(1));
  }

  const endRow = ws.rowCount;
  applyBordersToRange(ws, startRow, 1, endRow, columns.length);
  return { startRow, endRow };
}

function setColumnWidths(ws, widths) {
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
}

function findRealizadoPor(participantes) {
  return (Array.isArray(participantes) ? participantes : []).find(
    (participante) => String(participante?.tipo || "").trim().toUpperCase() === "REALIZADO_POR"
  ) || null;
}

function buildGeneralRows(cabecera, participantes) {
  const realizadoPor = findRealizadoPor(participantes);
  return [
    ["ID Inspección", cabecera?.id_inspeccion],
    ["Código formato", cabecera?.codigo_formato],
    ["Nombre formato", cabecera?.nombre_formato],
    ["Cliente", cabecera?.raz_social || cabecera?.otro_cliente_texto || cabecera?.id_cliente],
    ["Área", cabecera?.desc_area || cabecera?.area],
    ["Lugar", cabecera?.desc_lugar || cabecera?.lugar || cabecera?.desc_otro],
    ["Fecha inspección", toDisplayDate(cabecera?.fecha_inspeccion || cabecera?.created_at)],
    ["Servicio", cabecera?.nombre_servicio || cabecera?.otro_servicio_texto || cabecera?.servicio_detalle || cabecera?.id_servicio],
    ["Estado", cabecera?.estado_inspeccion_calculado || cabecera?.estado_inspeccion || cabecera?.nombre_estado],
    ["Modo", cabecera?.modo_registro || cabecera?.nombre_modo || cabecera?.id_modo_registro],
    ["Versión", cabecera?.version || cabecera?.version_formato || cabecera?.version_plantilla],
    ["Realizado por", getParticipantName(realizadoPor)],
    ["Cargo", safeText(realizadoPor?.cargo, "—")],
  ];
}

function getParticipantName(participante) {
  return safeText(
    participante?.nombre ||
    participante?.nombre_completo ||
    [participante?.nombres, participante?.apellidos].filter(Boolean).join(" "),
    "—"
  );
}

function getResponseValue(respuesta) {
  const candidate =
    respuesta?.valor ??
    respuesta?.valor_opcion ??
    respuesta?.estado ??
    respuesta?.accion_json ??
    "";
  if (candidate && typeof candidate === "object") return stringifyRowDataForExport(candidate);
  return safeText(candidate, "—");
}

function getRiskLevelValue(respuesta) {
  const rowData = safeJsonParse(respuesta?.row_data);
  if (rowData && typeof rowData === "object") {
    const candidates = [
      rowData.nivel_riesgo,
      rowData.riesgo,
      rowData.risk,
      rowData.valor,
      rowData.estado,
      rowData.calificacion,
    ];
    for (const candidate of candidates) {
      const text = safeText(candidate);
      if (text) return text;
    }
  }

  const fallback = [
    respuesta?.nivel_riesgo,
    respuesta?.riesgo,
    respuesta?.estado,
    getResponseValue(respuesta),
  ];
  for (const candidate of fallback) {
    const text = safeText(candidate);
    if (text) return text;
  }
  return "—";
}

function buildStructuredDetailRows(respuestas) {
  return (Array.isArray(respuestas) ? respuestas : [])
    .filter((respuesta) => respuesta?.row_data && typeof respuesta.row_data === "object")
    .map((respuesta, index) => ({
      index: index + 1,
      item: safeText(respuesta?.item_ref || respuesta?.item_id || respuesta?.id, "—"),
      tipo: safeText(respuesta?.row_data?.__tipo, "GENERAL"),
      detalle: stringifyRowDataForExport(respuesta?.row_data),
    }))
    .filter((item) => item.detalle);
}

async function addImageIfPossible(workbook, worksheet, rawPath, anchor, dimensions) {
  const image = imageExists(rawPath);
  if (!image) return false;
  try {
    const buffer = fs.readFileSync(image.resolved);
    const imageId = workbook.addImage({ buffer, extension: image.extension });
    if (anchor?.tl && anchor?.br) {
      worksheet.addImage(imageId, anchor);
    } else {
      worksheet.addImage(imageId, {
        tl: anchor,
        ext: dimensions,
        editAs: "oneCell",
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function appendParticipantsSection(workbook, ws, participantes) {
  appendSectionTitle(ws, "Realizado por / Inspectores", 8);
  const header = ws.addRow([]);
  header.height = 26;
  ws.mergeCells(header.number, 2, header.number, 3);
  ws.mergeCells(header.number, 5, header.number, 6);
  ws.mergeCells(header.number, 7, header.number, 8);
  header.getCell(1).value = "N°";
  header.getCell(2).value = "Inspector";
  header.getCell(4).value = "Cargo";
  header.getCell(5).value = "Tipo";
  header.getCell(7).value = "Firma";
  [1, 2, 4, 5, 7].forEach((col) => styleTableHeader(header.getCell(col)));

  const list = Array.isArray(participantes) ? participantes : [];
  if (!list.length) {
    const row = ws.addRow(["Sin participantes"]);
    ws.mergeCells(row.number, 1, row.number, 8);
    styleWrappedCell(row.getCell(1));
    applyBordersToRange(ws, header.number, 1, row.number, 8);
    return;
  }

  for (let index = 0; index < list.length; index += 1) {
    const participante = list[index];
    const row = ws.addRow([]);
    row.height = 72;
    ws.mergeCells(row.number, 2, row.number, 3);
    ws.mergeCells(row.number, 5, row.number, 6);
    ws.mergeCells(row.number, 7, row.number, 8);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = getParticipantName(participante);
    row.getCell(4).value = safeText(participante?.cargo, "—");
    row.getCell(5).value = safeText(participante?.tipo, participante?.es_creador ? "REALIZADO_POR" : "INSPECTOR");
    row.getCell(7).value = "";
    [1, 2, 4, 5, 7].forEach((col) => styleWrappedCell(row.getCell(col)));
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(7).alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    const hasImage = await addImageIfPossible(
      workbook,
      ws,
      participante?.firma_path || participante?.firma_url,
      buildSignatureImageBox(row.number)
    );
    if (!hasImage) {
      row.getCell(7).value = "Sin firma";
    }
  }

  applyBordersToRange(ws, header.number, 1, ws.rowCount, 8);
}

function appendResponsesSection(ws, respuestas) {
  appendSectionTitle(ws, "Respuestas", 8);
  const header = ws.addRow([]);
  header.height = 24;
  ws.mergeCells(header.number, 2, header.number, 3);
  ws.mergeCells(header.number, 4, header.number, 5);
  ws.mergeCells(header.number, 7, header.number, 8);
  header.getCell(1).value = "N°";
  header.getCell(2).value = "Categoría / Sección";
  header.getCell(4).value = "Descripción";
  header.getCell(6).value = "NIVEL DE RIESGO";
  header.getCell(7).value = "Observación";
  [1, 2, 4, 6, 7].forEach((col) => styleTableHeader(header.getCell(col)));

  const list = (Array.isArray(respuestas) ? respuestas : []).map((respuesta, index) => ({
    index: index + 1,
    categoria: safeText(respuesta?.categoria, "SIN CATEGORÍA"),
    descripcion: safeText(respuesta?.descripcion || respuesta?.texto, "—"),
    nivel_riesgo: getRiskLevelValue(respuesta),
    observacion: safeText(respuesta?.observacion, "—"),
  }));

  if (!list.length) {
    const row = ws.addRow(["Sin registros"]);
    ws.mergeCells(row.number, 1, row.number, 8);
    styleWrappedCell(row.getCell(1));
    applyBordersToRange(ws, header.number, 1, row.number, 8);
    return;
  }

  for (const item of list) {
    const row = ws.addRow([]);
    row.height = 40;
    ws.mergeCells(row.number, 2, row.number, 3);
    ws.mergeCells(row.number, 4, row.number, 5);
    ws.mergeCells(row.number, 7, row.number, 8);
    row.getCell(1).value = item.index;
    row.getCell(2).value = item.categoria;
    row.getCell(4).value = item.descripcion;
    row.getCell(6).value = item.nivel_riesgo;
    row.getCell(7).value = item.observacion;
    [1, 2, 4, 6, 7].forEach((col) => styleWrappedCell(row.getCell(col)));
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(6).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  applyBordersToRange(ws, header.number, 1, ws.rowCount, 8);
}

function appendStructuredDetailSection(ws, respuestas) {
  const details = buildStructuredDetailRows(respuestas);
  if (!details.length) return;
  appendBlankRow(ws);
  appendSectionTitle(ws, "Detalle estructurado", 7);
  const header = ws.addRow([]);
  header.height = 24;
  ws.mergeCells(header.number, 2, header.number, 3);
  ws.mergeCells(header.number, 4, header.number, 7);
  header.getCell(1).value = "N°";
  header.getCell(2).value = "Tipo";
  header.getCell(4).value = "Detalle";
  [1, 2, 4].forEach((col) => styleTableHeader(header.getCell(col)));

  for (const item of details) {
    const row = ws.addRow([]);
    row.height = 52;
    ws.mergeCells(row.number, 2, row.number, 3);
    ws.mergeCells(row.number, 4, row.number, 7);
    row.getCell(1).value = item.index;
    row.getCell(2).value = item.tipo;
    row.getCell(4).value = item.detalle;
    [1, 2, 4].forEach((col) => styleWrappedCell(row.getCell(col)));
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  }

  applyBordersToRange(ws, header.number, 1, ws.rowCount, 7);
}

function appendObservacionesSection(ws, observaciones) {
  appendBlankRow(ws);
  appendSectionTitle(ws, "Observaciones", 6);
  appendTable(
    ws,
    [
      { header: "ID Observación", value: "id_observacion", wrap: false },
      { header: "Ítem", value: "item_ref" },
      { header: "Descripción", value: "desc_observacion" },
      { header: "Riesgo", value: "nivel_riesgo" },
      { header: "Estado", value: "estado_observacion" },
      { header: "Cant. evidencias", value: "cant_evidencias", wrap: false },
    ],
    (Array.isArray(observaciones) ? observaciones : []).map((obs) => ({
      ...obs,
      cant_evidencias: Array.isArray(obs?.evidencias) ? obs.evidencias.length : 0,
    })),
    { rowHeight: 32 }
  );
}

function appendAccionesSection(ws, acciones) {
  appendBlankRow(ws);
  appendSectionTitle(ws, "Acciones", 10);
  const header = ws.addRow([]);
  header.height = 24;
  ws.mergeCells(header.number, 3, header.number, 4);
  ws.mergeCells(header.number, 5, header.number, 6);
  header.getCell(1).value = "ID Acción";
  header.getCell(2).value = "ID Observación";
  header.getCell(3).value = "Descripción";
  header.getCell(5).value = "Responsable";
  header.getCell(7).value = "Fecha compromiso";
  header.getCell(8).value = "Estado";
  header.getCell(9).value = "% cumplimiento";
  header.getCell(10).value = "Cant. evidencias";
  [1, 2, 3, 5, 7, 8, 9, 10].forEach((col) => styleTableHeader(header.getCell(col)));

  const list = (Array.isArray(acciones) ? acciones : []).map((accion) => ({
    ...accion,
    responsable: safeText(accion?.responsable_display, "—"),
    fecha_compromiso: toDisplayDateOnly(accion?.fecha_compromiso),
    porcentaje_cumplimiento: accion?.porcentaje_cumplimiento ?? "—",
    cant_evidencias: Array.isArray(accion?.evidencias) ? accion.evidencias.length : 0,
  }));

  if (!list.length) {
    const row = ws.addRow(["Sin registros"]);
    ws.mergeCells(row.number, 1, row.number, 10);
    styleWrappedCell(row.getCell(1));
    applyBordersToRange(ws, header.number, 1, row.number, 10);
    return;
  }

  for (const item of list) {
    const row = ws.addRow([]);
    row.height = 38;
    ws.mergeCells(row.number, 3, row.number, 4);
    ws.mergeCells(row.number, 5, row.number, 6);
    row.getCell(1).value = item.id_accion ?? "—";
    row.getCell(2).value = item.id_observacion ?? "—";
    row.getCell(3).value = safeText(item.desc_accion, "—");
    row.getCell(5).value = item.responsable;
    row.getCell(7).value = item.fecha_compromiso;
    row.getCell(8).value = safeText(item.estado_accion, "—");
    row.getCell(9).value = item.porcentaje_cumplimiento;
    row.getCell(10).value = item.cant_evidencias;
    [1, 2, 3, 5, 7, 8, 9, 10].forEach((col) => styleWrappedCell(row.getCell(col)));
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(7).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row.getCell(9).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row.getCell(10).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  applyBordersToRange(ws, header.number, 1, ws.rowCount, 10);
}

function appendEvidenceSummarySection(ws, evidenciasObservaciones, evidenciasAcciones) {
  appendBlankRow(ws);
  appendSectionTitle(ws, "Evidencias", 5);
  appendTable(
    ws,
    [
      { header: "Tipo", value: "tipo_padre", wrap: false },
      { header: "ID padre", value: "id_padre", wrap: false },
      { header: "Nombre archivo", value: "archivo_nombre" },
      { header: "Ruta", value: "archivo_ruta" },
      { header: "Fecha captura", value: "capturada_en" },
    ],
    [
      ...(Array.isArray(evidenciasObservaciones) ? evidenciasObservaciones : []),
      ...(Array.isArray(evidenciasAcciones) ? evidenciasAcciones : []),
    ].map((item) => ({
      ...item,
      capturada_en: toDisplayDate(item?.capturada_en),
    })),
    { rowHeight: 28 }
  );
}

async function appendEvidenceGallery(ws, workbook, title, evidencias) {
  appendSectionTitle(ws, title, 6);
  const header = ws.addRow(["Tipo", "ID padre", "Nombre archivo", "Ruta", "Fecha captura", "Vista previa"]);
  header.height = 24;
  header.eachCell((cell) => styleTableHeader(cell));

  const list = Array.isArray(evidencias) ? evidencias : [];
  if (!list.length) {
    const row = ws.addRow(["Sin evidencias"]);
    ws.mergeCells(row.number, 1, row.number, 6);
    styleWrappedCell(row.getCell(1));
    return;
  }

  for (const item of list) {
    const row = ws.addRow([
      safeText(item?.tipo_padre, "—"),
      safeText(item?.id_padre, "—"),
      safeText(item?.archivo_nombre, "—"),
      safeText(item?.archivo_ruta, "—"),
      toDisplayDate(item?.capturada_en),
      "",
    ]);
    row.height = 76;
    for (let col = 1; col <= 6; col += 1) {
      styleWrappedCell(row.getCell(col));
    }
    const hasImage = await addImageIfPossible(
      workbook,
      ws,
      item?.archivo_ruta,
      buildCellImageBox(6, row.number, { paddingX: 0.12, paddingY: 0.12 })
    );
    if (!hasImage) {
      row.getCell(6).value = "Imagen no disponible";
      styleWrappedCell(row.getCell(6));
      row.getCell(6).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
  }
  applyBordersToRange(ws, header.number, 1, ws.rowCount, 6);
}

async function buildWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Web de Gestion de Inspecciones";
  wb.created = new Date();

  const ws = wb.addWorksheet("Inspección", {
    views: [{ state: "frozen", ySplit: 2 }],
    properties: { defaultRowHeight: 20 },
  });

  setColumnWidths(ws, [14, 14, 22, 18, 18, 18, 18, 18, 14, 16]);

  const title = `INSPECCIÓN #${safeText(data?.cabecera?.id_inspeccion, "")} - ${safeText(data?.cabecera?.nombre_formato, "SIN FORMATO")}`;
  const titleRow = ws.addRow([title]);
  ws.addRow([]);
  ws.mergeCells(titleRow.number, 1, titleRow.number + 1, 10);
  ws.getRow(titleRow.number).height = 24;
  ws.getRow(titleRow.number + 1).height = 24;
  styleReportTitle(titleRow.getCell(1));
  applyBordersToRange(ws, titleRow.number, 1, titleRow.number + 1, 10);
  appendBlankRow(ws);

  appendSectionTitle(ws, "Datos generales", 5);
  appendKeyValueTable(ws, buildGeneralRows(data?.cabecera, data?.participantes), {
    labelFromCol: 1,
    labelToCol: 2,
    valueFromCol: 3,
    valueToCol: 5,
  });
  appendBlankRow(ws);

  await appendParticipantsSection(wb, ws, data?.participantes);
  appendBlankRow(ws);

  appendResponsesSection(ws, data?.respuestas);
  appendStructuredDetailSection(ws, data?.respuestas);
  appendObservacionesSection(ws, data?.observaciones);
  appendAccionesSection(ws, data?.acciones);
  appendEvidenceSummarySection(ws, data?.evidenciasObservaciones, data?.evidenciasAcciones);

  const evidenciasSheet = wb.addWorksheet("Evidencias", {
    properties: { defaultRowHeight: 20 },
  });
  setColumnWidths(evidenciasSheet, [12, 14, 28, 48, 18, 22]);
  const evidenceTitle = evidenciasSheet.addRow(["Galería de evidencias"]);
  evidenciasSheet.addRow([]);
  evidenciasSheet.mergeCells(evidenceTitle.number, 1, evidenceTitle.number + 1, 6);
  evidenciasSheet.getRow(evidenceTitle.number).height = 24;
  evidenciasSheet.getRow(evidenceTitle.number + 1).height = 24;
  styleReportTitle(evidenceTitle.getCell(1));
  applyBordersToRange(evidenciasSheet, evidenceTitle.number, 1, evidenceTitle.number + 1, 6);
  appendBlankRow(evidenciasSheet);
  await appendEvidenceGallery(evidenciasSheet, wb, "Evidencias de observaciones", data?.evidenciasObservaciones);
  appendBlankRow(evidenciasSheet);
  await appendEvidenceGallery(evidenciasSheet, wb, "Evidencias de acciones", data?.evidenciasAcciones);

  return wb;
}

export async function exportXlsx(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: "id_inspeccion invalido" });
    }

    const data = await exportRepo.obtenerDataParaExport(id);
    if (!data?.cabecera) {
      return res.status(404).json({ message: "Inspección no encontrada" });
    }

    const wb = await buildWorkbook(data);
    const fileName = buildDownloadFileName(data.cabecera, id);
    const buffer = await wb.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error("[xlsx-export] error:", err?.message, err?.stack);
    return res.status(500).json({
      message: "Error exportando Excel",
      detail: err?.message || "Error interno",
    });
  }
}
