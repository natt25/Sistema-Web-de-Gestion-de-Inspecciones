import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import inspeccionesService from "../services/inspecciones.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "..", "templates");

const TEMPLATE_HINTS_BY_PLANTILLA = {
  1: [/FOR[-_ ]?013/i, /INSPECCION GENERAL/i],
  2: [/FOR[-_ ]?014/i, /SEGURIDAD/i],
  3: [/FOR[-_ ]?034/i],
};

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normalizeEstado(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (["BUENO", "B", "OK", "SI", "SÍ", "TRUE", "1"].includes(raw)) return "BUENO";
  if (["MALO", "M", "NO", "FALSE", "0"].includes(raw)) return "MALO";
  if (["N/A", "NA"].includes(raw)) return "NA";
  return raw || "NA";
}

function getTemplateCandidates() {
  try {
    return fs
      .readdirSync(templatesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.xlsx$/i.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function resolveTemplateForCabecera(cabecera) {
  const files = getTemplateCandidates();
  if (!files.length) return null;

  const plantillaId = Number(cabecera?.id_plantilla_inspec);
  const formatToken = normalizeToken(cabecera?.codigo_formato);

  let match = null;
  if (Number.isInteger(plantillaId) && TEMPLATE_HINTS_BY_PLANTILLA[plantillaId]) {
    const hints = TEMPLATE_HINTS_BY_PLANTILLA[plantillaId];
    match = files.find((name) => hints.some((rx) => rx.test(name)));
  }

  if (!match && formatToken) {
    match = files.find((name) => normalizeToken(name).includes(formatToken));
  }

  if (!match) return null;
  return {
    fileName: match,
    templatePath: path.resolve(templatesDir, match),
  };
}

function findRealizadoPor(participantes) {
  const list = Array.isArray(participantes) ? participantes : [];
  return list.find((p) => String(p?.tipo || "").trim().toUpperCase() === "REALIZADO_POR") || null;
}

function formatResponsable(accion) {
  const interno = String(accion?.dni || accion?.responsable_interno_dni || "").trim();
  if (interno) return interno;

  const externoNombre = String(accion?.externo_responsable_nombre || "").trim();
  const externoCargo = String(accion?.externo_responsable_cargo || "").trim();
  if (externoNombre && externoCargo) return `${externoNombre} (${externoCargo})`;
  return externoNombre || externoCargo || "";
}

function getObservacionDescripcion(obs) {
  return String(
    obs?.desc_observacion ??
    obs?.descripcion ??
    obs?.observacion ??
    ""
  ).trim();
}

function getRespuestaDescripcion(r) {
  return String(r?.descripcion ?? r?.texto ?? "").trim();
}

function addCabeceraRows(ws, cabecera, participantes) {
  const realizadoPor = findRealizadoPor(participantes);

  ws.addRow(["Inspeccion"]);
  ws.addRow([]);
  ws.addRow(["ID Inspeccion", cabecera?.id_inspeccion ?? ""]);
  ws.addRow(["Codigo formato", cabecera?.codigo_formato ?? ""]);
  ws.addRow(["Nombre formato", cabecera?.nombre_formato ?? ""]);
  ws.addRow(["Cliente", cabecera?.raz_social ?? cabecera?.id_cliente ?? ""]);
  ws.addRow(["Area", cabecera?.desc_area ?? ""]);
  ws.addRow(["Lugar", cabecera?.lugar ?? cabecera?.desc_otro ?? ""]);
  ws.addRow(["Fecha", cabecera?.fecha_inspeccion ?? ""]);
  ws.addRow(["Servicio", cabecera?.nombre_servicio ?? cabecera?.servicio_detalle ?? ""]);
  ws.addRow(["Estado", cabecera?.estado_inspeccion ?? ""]);
  ws.addRow(["Realizado por", realizadoPor?.nombre ?? realizadoPor?.dni ?? ""]);
  ws.addRow(["Cargo", realizadoPor?.cargo ?? ""]);
  ws.addRow([]);
}

function addRespuestasTable(ws, respuestas) {
  ws.addRow(["Respuestas"]);
  ws.addRow(["N°", "Categoria/Seccion", "Descripcion", "Estado", "Observacion"]);
  const list = Array.isArray(respuestas) ? respuestas : [];
  list.forEach((r, index) => {
    ws.addRow([
      index + 1,
      r?.categoria ?? "SIN CATEGORIA",
      getRespuestaDescripcion(r),
      normalizeEstado(r?.estado ?? r?.valor ?? r?.valor_opcion),
      r?.observacion ?? "",
    ]);
  });
  ws.addRow([]);
}

function addObservacionesTable(ws, observaciones) {
  ws.addRow(["Observaciones"]);
  ws.addRow(["ID Observacion", "Descripcion", "Estado", "Evidencias"]);
  const list = Array.isArray(observaciones) ? observaciones : [];
  list.forEach((obs) => {
    ws.addRow([
      obs?.id_observacion ?? "",
      getObservacionDescripcion(obs),
      obs?.estado_observacion ?? obs?.id_estado_observacion ?? "",
      Array.isArray(obs?.evidencias) ? obs.evidencias.length : 0,
    ]);
  });
  ws.addRow([]);
}

function addAccionesTable(ws, observaciones) {
  ws.addRow(["Acciones"]);
  ws.addRow(["ID Accion", "ID Observacion", "Descripcion", "Responsable", "Fecha compromiso", "Estado", "Evidencias"]);

  const obsList = Array.isArray(observaciones) ? observaciones : [];
  for (const obs of obsList) {
    const acciones = Array.isArray(obs?.acciones) ? obs.acciones : [];
    for (const accion of acciones) {
      ws.addRow([
        accion?.id_accion ?? "",
        obs?.id_observacion ?? "",
        accion?.desc_accion ?? "",
        formatResponsable(accion),
        accion?.fecha_compromiso ?? "",
        accion?.estado_accion ?? accion?.id_estado_accion ?? "",
        Array.isArray(accion?.evidencias) ? accion.evidencias.length : 0,
      ]);
    }
  }
}

function applyBasicSheetStyle(ws) {
  ws.columns = [
    { width: 18 },
    { width: 28 },
    { width: 48 },
    { width: 18 },
    { width: 24 },
    { width: 20 },
    { width: 14 },
  ];

  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getColumn(1).font = { bold: false };
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

async function buildWorkbook(data) {
  const cabecera = data?.cabecera || {};
  const template = resolveTemplateForCabecera(cabecera);
  const wb = new ExcelJS.Workbook();

  if (template) {
    console.log("[xlsx-export] using-template:", template.fileName);
    await wb.xlsx.readFile(template.templatePath);
  } else {
    console.log("[xlsx-export] using-template: NONE (fallback generic workbook)");
  }

  const ws = wb.addWorksheet("Inspección");
  addCabeceraRows(ws, cabecera, data?.participantes);
  addRespuestasTable(ws, data?.respuestas);
  addObservacionesTable(ws, data?.observaciones);
  addAccionesTable(ws, data?.observaciones);
  applyBasicSheetStyle(ws);

  return wb;
}

export async function exportXlsx(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: "id_inspeccion invalido" });
    }

    const detail = await inspeccionesService.obtenerDetalleInspeccionFull(id);
    if (!detail?.ok) {
      return res.status(detail?.status || 500).json({ message: detail?.message || "No se pudo obtener la inspeccion" });
    }

    const data = detail.data || {};
    if (!data?.cabecera) {
      return res.status(404).json({ message: "Inspeccion no encontrada" });
    }

    const wb = await buildWorkbook(data);
    const fileName = buildDownloadFileName(data.cabecera, id);
    const buffer = await wb.xlsx.writeBuffer();

    console.log("[xlsx-export] generated", {
      id_inspeccion: id,
      respuestas: Array.isArray(data.respuestas) ? data.respuestas.length : 0,
      observaciones: Array.isArray(data.observaciones) ? data.observaciones.length : 0,
      fileName,
    });

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
