import ExcelJS from "exceljs";
import { obtenerDataParaExport } from "../repositories/inspecciones.export.repository.js";
import { resolveCorporateTemplatePath } from "../utils/excelTemplatePath.js";

const BASE_TABLE_ROW = 17;
const PLANES_TITLE_ROW = 40;
const MAX_TABLE_COL = 19; // A..S

function normalizeEstado(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (["BUENO", "B", "OK", "SI", "SÍ", "1", "TRUE"].includes(value)) return "BUENO";
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

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
    dstCell.style = deepClone(srcCell.style) || {};
    dstCell.value = null;
  }

  const existingMerges = new Set(worksheet.model?.merges || []);
  for (const pattern of mergePatterns) {
    const range = `${toColLetter(pattern.startCol)}${toRow}:${toColLetter(pattern.endCol)}${toRow}`;
    if (!existingMerges.has(range)) {
      worksheet.mergeCells(range);
      existingMerges.add(range);
    }
  }
}

function cloneTemplateRowFromSource(worksheet, fromRow, toRow) {
  const mergePatterns = getBaseRowMergePatterns(worksheet, fromRow);
  cloneTemplateRow(worksheet, fromRow, toRow, mergePatterns);
}

function setEstadoCellValue(cell, estadoNormalizado) {
  if (estadoNormalizado === "BUENO") {
    cell.value = "✓";
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
  worksheet.getCell("D6").value = cab.raz_social || cab.id_cliente || "";
  worksheet.getCell("L6").value = cab.desc_area || "";
  worksheet.getCell("S6").value = cab.fecha_inspeccion ? new Date(cab.fecha_inspeccion) : "";
  worksheet.getCell("D7").value = cab.nombre_servicio || cab.servicio_detalle || "";
  worksheet.getCell("L7").value = cab.lugar || cab.desc_otro || "";

  const list = Array.isArray(participantes) ? participantes : [];
  const realizadoPor = list.find(
    (item) => String(item?.tipo || "").trim().toUpperCase() === "REALIZADO_POR"
  );
  worksheet.getCell("B9").value = realizadoPor?.nombre || realizadoPor?.dni || "";
  worksheet.getCell("G9").value = realizadoPor?.cargo || "";
}

function parseAccionJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatResponsable(accion) {
  const interno = String(accion?.dni || "").trim();
  if (interno) return interno;

  const externoNombre = String(accion?.externo_responsable_nombre || "").trim();
  const externoCargo = String(accion?.externo_responsable_cargo || "").trim();
  if (externoNombre && externoCargo) return `${externoNombre} (${externoCargo})`;
  return externoNombre || externoCargo || "";
}

function formatFecha(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function normalizeItemRef(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function mapAccionesPorItem(acciones) {
  const map = new Map();
  for (const acc of Array.isArray(acciones) ? acciones : []) {
    const key = normalizeItemRef(acc?.item_ref);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(acc);
  }
  return map;
}

function buildObservacionCellText(row, accionesByItem) {
  const baseObs = String(row?.observacion || "").trim();
  const accionesFromJson = [];
  const jsonAccion = parseAccionJson(row?.accion_json);
  if (jsonAccion) {
    const que = String(jsonAccion?.que || "").trim();
    const quien = String(jsonAccion?.quien || "").trim();
    const cuando = String(jsonAccion?.cuando || "").trim();
    if (que || quien || cuando) {
      accionesFromJson.push(
        [que ? `Que: ${que}` : "", quien ? `Quien: ${quien}` : "", cuando ? `Cuando: ${cuando}` : ""]
          .filter(Boolean)
          .join(" | ")
      );
    }
  }

  const accionesFromObs = [];
  const key = normalizeItemRef(row?.item_id);
  if (key && accionesByItem.has(key)) {
    for (const acc of accionesByItem.get(key)) {
      const que = String(acc?.desc_accion || "").trim();
      const quien = formatResponsable(acc);
      const cuando = formatFecha(acc?.fecha_compromiso);
      if (que || quien || cuando) {
        accionesFromObs.push(
          [que ? `Que: ${que}` : "", quien ? `Quien: ${quien}` : "", cuando ? `Cuando: ${cuando}` : ""]
            .filter(Boolean)
            .join(" | ")
        );
      }
    }
  }

  const parts = [baseObs, ...accionesFromJson, ...accionesFromObs].filter(Boolean);
  return parts.join("\n");
}

function fillTablaConObservaciones(worksheet, respuestas, acciones) {
  const list = Array.isArray(respuestas) ? respuestas : [];
  const accionesByItem = mapAccionesPorItem(acciones);
  const capacityBeforePlanes = PLANES_TITLE_ROW - BASE_TABLE_ROW; // filas 17..39
  let insertedExtraRows = 0;

  for (let i = 0; i < list.length; i++) {
    let rowNumber;
    if (i < capacityBeforePlanes) {
      rowNumber = BASE_TABLE_ROW + i;
    } else {
      // Inserta filas extra justo antes del bloque de planes de acción.
      rowNumber = PLANES_TITLE_ROW + insertedExtraRows;
      worksheet.insertRow(rowNumber, []);
      cloneTemplateRowFromSource(worksheet, rowNumber - 1, rowNumber);
      insertedExtraRows += 1;
    }

    const row = list[i] || {};
    const estado = normalizeEstado(row.estado ?? row.valor ?? row.valor_opcion);

    worksheet.getCell(`A${rowNumber}`).value = i + 1;
    worksheet.getCell(`B${rowNumber}`).value = row.categoria || "";
    worksheet.getCell(`D${rowNumber}`).value = row.descripcion || row.texto || "";
    setEstadoCellValue(worksheet.getCell(`L${rowNumber}`), estado);
    worksheet.getCell(`Q${rowNumber}`).value = buildObservacionCellText(row, accionesByItem);
  }

  return insertedExtraRows;
}

function fillPlanesDeAccion(worksheet, acciones, rowOffset = 0) {
  const list = Array.isArray(acciones) ? acciones.slice(0, 20) : [];
  for (let i = 0; i < list.length; i++) {
    const acc = list[i];
    const row = 43 + rowOffset + (i % 10);
    const rightSide = i >= 10;

    const queCell = rightSide ? `M${row}` : `B${row}`;
    const quienCell = rightSide ? `S${row}` : `H${row}`;
    const cuandoCell = rightSide ? `U${row}` : `J${row}`;

    worksheet.getCell(queCell).value = String(acc?.desc_accion || "").trim();
    worksheet.getCell(quienCell).value = formatResponsable(acc);
    worksheet.getCell(cuandoCell).value = acc?.fecha_compromiso ? new Date(acc.fecha_compromiso) : "";
  }
}

export async function exportXlsx(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: "id_inspeccion invalido" });
    }

    const data = await obtenerDataParaExport(id);
    if (!data?.cabecera) {
      return res.status(404).json({ message: "Inspeccion no encontrada" });
    }

    const { templatePath } = resolveCorporateTemplatePath();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets?.[0];
    if (!ws) {
      return res.status(500).json({ message: "Hoja de plantilla no encontrada" });
    }

    fillCabecera(ws, data.cabecera, data.participantes);
    const insertedExtraRows = fillTablaConObservaciones(ws, data.respuestas, data.acciones);
    fillPlanesDeAccion(ws, data.acciones, insertedExtraRows);

    console.log("[xlsx-export] templatePath:", templatePath);
    console.log("[xlsx-export] worksheet:", ws.name);
    console.log("[xlsx-export] respuestas impresas:", Array.isArray(data.respuestas) ? data.respuestas.length : 0);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="AQP-SSOMA-FOR-013_Inspeccion_${id}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    if (err?.code === "TEMPLATE_NOT_FOUND") {
      return res.status(500).json({
        message: "Plantilla no encontrada",
        resolvedPath: err?.resolvedPath,
        templatesDir: err?.templatesDir,
        files: err?.files || [],
      });
    }

    console.error("[xlsx-export] error:", err?.message, err?.stack);
    return res.status(500).json({
      message: "Error exportando Excel",
      detail: err?.message || "Error interno",
    });
  }
}
