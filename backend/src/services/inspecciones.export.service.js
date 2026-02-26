import ExcelJS from "exceljs";
import { getTemplatePath } from "../utils/excel.template.js";
import exportRepo from "../repositories/inspecciones.export.repository.js";

const TEMPLATE_NAME = "1. AQP-SSOMA-FOR-013 Inspecci\u00f3n General.xlsx";
const BASE_TABLE_ROW = 17;
const MAX_TABLE_COL = 19; // A..S

function normalizeEstado(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (["BUENO", "B", "OK", "SI", "S\u00cd", "1", "TRUE"].includes(value)) return "BUENO";
  if (["MALO", "M", "NO", "0", "FALSE"].includes(value)) return "MALO";
  return "NA";
}

function toColNum(col) {
  return String(col)
    .toUpperCase()
    .split("")
    .reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0);
}

function toColLetter(num) {
  let n = Number(num);
  let out = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function getBaseRowMergePatterns(worksheet, rowNumber) {
  const merges = worksheet.model?.merges || [];
  return merges
    .map((range) => {
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(String(range));
      if (!m) return null;
      const startRow = Number(m[2]);
      const endRow = Number(m[4]);
      if (startRow !== rowNumber || endRow !== rowNumber) return null;
      return { startCol: toColNum(m[1]), endCol: toColNum(m[3]) };
    })
    .filter(Boolean);
}

function cloneTemplateRow(worksheet, fromRow, toRow, mergePatterns) {
  const src = worksheet.getRow(fromRow);
  const dst = worksheet.getRow(toRow);
  dst.height = src.height;

  for (let col = 1; col <= MAX_TABLE_COL; col++) {
    const srcCell = src.getCell(col);
    const dstCell = dst.getCell(col);
    dstCell.style = srcCell.style ? JSON.parse(JSON.stringify(srcCell.style)) : {};
    dstCell.value = null;
  }

  const existingMerges = new Set(worksheet.model?.merges || []);
  for (const p of mergePatterns) {
    const range = `${toColLetter(p.startCol)}${toRow}:${toColLetter(p.endCol)}${toRow}`;
    if (!existingMerges.has(range)) {
      worksheet.mergeCells(range);
      existingMerges.add(range);
    }
  }
}

function setEstadoCellValue(cell, estadoNormalizado) {
  if (estadoNormalizado === "BUENO") {
    cell.value = "\u2713";
    return;
  }
  if (estadoNormalizado === "MALO") {
    cell.value = "X";
    return;
  }
  cell.value = "NA";
}

function fillCabecera(worksheet, cabecera, participantes) {
  const cab = cabecera || {};

  worksheet.getCell("D6").value = cab.raz_social || "";
  worksheet.getCell("L6").value = cab.desc_area || "";
  worksheet.getCell("S6").value = cab.fecha_inspeccion ? new Date(cab.fecha_inspeccion) : "";
  worksheet.getCell("D7").value = cab.nombre_servicio || cab.servicio_detalle || "";
  worksheet.getCell("L7").value = cab.lugar || cab.desc_otro || cab.servicio_detalle || "";

  const list = Array.isArray(participantes) ? participantes : [];
  const realizadoPor = list.find(
    (p) => String(p?.tipo || "").trim().toUpperCase() === "REALIZADO_POR"
  );
  worksheet.getCell("B9").value = realizadoPor?.nombre || realizadoPor?.dni || "";
  worksheet.getCell("G9").value = realizadoPor?.cargo || "";
}

function fillRespuestas(worksheet, respuestas) {
  const list = Array.isArray(respuestas) ? respuestas : [];
  const mergePatterns = getBaseRowMergePatterns(worksheet, BASE_TABLE_ROW);

  for (let i = 0; i < list.length; i++) {
    const rowNumber = BASE_TABLE_ROW + i;
    if (i > 0) {
      worksheet.insertRow(rowNumber, []);
      cloneTemplateRow(worksheet, BASE_TABLE_ROW, rowNumber, mergePatterns);
    }

    const r = list[i] || {};
    const estado = normalizeEstado(r.estado ?? r.valor ?? r.valor_opcion);

    worksheet.getCell(`A${rowNumber}`).value = i + 1;
    worksheet.getCell(`B${rowNumber}`).value = r.categoria || "";
    worksheet.getCell(`D${rowNumber}`).value = r.descripcion || r.texto || "";
    setEstadoCellValue(worksheet.getCell(`L${rowNumber}`), estado);
    worksheet.getCell(`Q${rowNumber}`).value = r.observacion || "";
  }
}

export async function generarInspeccionXlsx(id_inspeccion) {
  const data = await exportRepo.obtenerDataParaExport(id_inspeccion);
  if (!data?.cabecera) return null;

  const templatePath = getTemplatePath(TEMPLATE_NAME);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const worksheet = workbook.worksheets?.[0];
  if (!worksheet) {
    const error = new Error("Hoja de plantilla no encontrada");
    error.code = "TEMPLATE_SHEET_NOT_FOUND";
    throw error;
  }

  fillCabecera(worksheet, data.cabecera, data.participantes);
  fillRespuestas(worksheet, data.respuestas);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export default {
  generarInspeccionXlsx,
};
