import ExcelJS from "exceljs";
import service from "../services/inspecciones.service.js";

/**
 * Export AQP-SSOMA-FOR-014 (Inspección de Seguridad) en formato GENÉRICO (sin plantilla).
 * Estructura basada en el PDF del formato: cabecera + tabla de observaciones/acciones + planes de acción. :contentReference[oaicite:1]{index=1}
 */

function safeStr(v) {
  return v == null ? "" : String(v);
}

function asDate(v) {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

// arma filas a partir de observaciones + acciones
function buildRowsFromFull(data) {
  const out = [];

  const observaciones = Array.isArray(data?.observaciones) ? data.observaciones : [];
  let correlativo = 1;

  for (const obs of observaciones) {
    const acciones = Array.isArray(obs?.acciones) ? obs.acciones : [];

    // evidencia de observación (foto de observación encontrada)
    const evidObs = Array.isArray(obs?.evidencias) ? obs.evidencias : [];
    const fotoObs = evidObs[0]?.ruta || evidObs[0]?.path || evidObs[0]?.url || "";

    if (!acciones.length) {
      out.push({
        n: correlativo++,
        observacion: safeStr(obs?.descripcion || obs?.observacion || obs?.detalle || ""),
        accion: "",
        evidenciaObs: safeStr(fotoObs),
        fechaEjec: "",
        cumplimiento: "",
        evidenciaLev: "",
        responsable: safeStr(obs?.responsable || obs?.usuario || ""),
      });
      continue;
    }

    for (const acc of acciones) {
      const evidAcc = Array.isArray(acc?.evidencias) ? acc.evidencias : [];
      const fotoLev = evidAcc[0]?.ruta || evidAcc[0]?.path || evidAcc[0]?.url || "";

      out.push({
        n: correlativo++,
        observacion: safeStr(obs?.descripcion || obs?.observacion || obs?.detalle || ""),
        accion: safeStr(acc?.descripcion || acc?.accion || acc?.detalle || ""),
        evidenciaObs: safeStr(fotoObs),
        fechaEjec: safeStr(acc?.fecha_ejecucion || acc?.fecha_compromiso || acc?.fecha || ""),
        cumplimiento: safeStr(acc?.porcentaje_cumplimiento ?? acc?.porcentaje ?? acc?.cumplimiento ?? ""),
        evidenciaLev: safeStr(fotoLev),
        responsable: safeStr(
          acc?.responsable_nombre ||
          acc?.responsable ||
          acc?.dni_responsable ||
          acc?.externo_responsable_nombre ||
          ""
        ),
      });
    }
  }

  return out;
}

export async function exportSeguridadXlsx(req, res) {
  try {
    const { id } = req.params;

    const result = await service.obtenerDetalleInspeccionFull(id);
    if (!result?.ok) {
      return res.status(result?.status || 500).json({ message: result?.message || "Error obteniendo inspección" });
    }

    const data = result.data;
    const cab = data?.cabecera || {};

    // ===== Workbook =====
    const wb = new ExcelJS.Workbook();
    wb.creator = "SSOMA";
    wb.created = new Date();

    const ws = wb.addWorksheet("INSPECCION_SEGURIDAD", {
      properties: { defaultRowHeight: 18 },
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ state: "frozen", ySplit: 9 }],
    });

    // Columnas (ajusta anchos a gusto)
    ws.columns = [
      { header: "Nº", key: "n", width: 6 },
      { header: "OBSERVACIÓN ENCONTRADA", key: "observacion", width: 45 },
      { header: "ACCIÓN CORRECTIVA", key: "accion", width: 35 },
      { header: "EVIDENCIA FOTOGRÁFICA (OBS.)", key: "evidObs", width: 35 },
      { header: "FECHA DE EJECUCIÓN", key: "fecha", width: 16 },
      { header: "% CUMPLIMIENTO", key: "pct", width: 16 },
      { header: "EVIDENCIA FOTOGRÁFICA (LEV.)", key: "evidLev", width: 35 },
      { header: "RESPONSABLE", key: "resp", width: 22 },
    ];

    // ===== Encabezado (genérico) =====
    ws.mergeCells("A1:H1");
    ws.getCell("A1").value = "INSPECCIÓN DE SEGURIDAD";
    ws.getCell("A1").font = { bold: true, size: 16 };
    ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

    ws.mergeCells("A2:H2");
    ws.getCell("A2").value = "AQP-SSOMA-FOR-014";
    ws.getCell("A2").font = { bold: true, size: 11 };
    ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };

    // Datos generales (según el PDF) :contentReference[oaicite:2]{index=2}
    ws.getCell("A4").value = "Cliente / Unidad Minera:";
    ws.getCell("A5").value = "Servicio:";
    ws.getCell("D4").value = "Área:";
    ws.getCell("D5").value = "Lugar:";
    ws.getCell("F4").value = "Fecha de Inspección:";
    ws.getCell("F5").value = "Realizado por:";
    ws.getCell("G5").value = "Cargo:";

    ws.getCell("B4").value = safeStr(cab?.raz_social || cab?.id_cliente || "");
    ws.getCell("B5").value = safeStr(cab?.nombre_servicio || cab?.servicio_detalle || "");
    ws.getCell("E4").value = safeStr(cab?.desc_area || "");
    ws.getCell("E5").value = safeStr(cab?.lugar || cab?.desc_otro || "");
    ws.getCell("G4").value = asDate(cab?.fecha_inspeccion) || safeStr(cab?.fecha_inspeccion || "");

    const participantes = Array.isArray(data?.participantes) ? data.participantes : [];
    const realizadoPor = participantes.find((p) => String(p?.tipo || "").toUpperCase() === "REALIZADO_POR");
    ws.getCell("G5").value = safeStr(realizadoPor?.nombre || realizadoPor?.dni || "");
    ws.getCell("H5").value = safeStr(realizadoPor?.cargo || "");

    // estilos básicos de “datos generales”
    for (const addr of ["A4", "A5", "D4", "D5", "F4", "F5", "G5"]) {
      ws.getCell(addr).font = { bold: true };
    }

    // ===== Cabecera de tabla =====
    const headerRowNum = 9;
    const headerRow = ws.getRow(headerRowNum);
    headerRow.values = ws.columns.map((c) => c.header);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 28;

    // bordes para header
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // ===== Filas =====
    const rows = buildRowsFromFull(data);

    let r = headerRowNum + 1;
    for (const item of rows) {
      const row = ws.getRow(r++);
      row.getCell(1).value = item.n;
      row.getCell(2).value = item.observacion;
      row.getCell(3).value = item.accion;
      row.getCell(4).value = item.evidenciaObs; // aquí puedes poner URL/ruta
      row.getCell(5).value = item.fechaEjec;
      row.getCell(6).value = item.cumplimiento;
      row.getCell(7).value = item.evidenciaLev; // URL/ruta
      row.getCell(8).value = item.responsable;

      row.alignment = { vertical: "top", wrapText: true };

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    // ===== Planes de acción (sección simple) =====
    // El PDF muestra “PLANES DE ACCION” con columnas ¿QUÉ? ¿QUIÉN? ¿CUÁNDO? (repetido). :contentReference[oaicite:3]{index=3}
    const startPlanes = r + 2;
    ws.mergeCells(`A${startPlanes}:H${startPlanes}`);
    ws.getCell(`A${startPlanes}`).value = "PLANES DE ACCIÓN (si aplica)";
    ws.getCell(`A${startPlanes}`).font = { bold: true };
    ws.getCell(`A${startPlanes}`).alignment = { horizontal: "left" };

    const hdr2 = startPlanes + 1;
    ws.getCell(`A${hdr2}`).value = "¿QUÉ?";
    ws.getCell(`C${hdr2}`).value = "¿QUIÉN?";
    ws.getCell(`E${hdr2}`).value = "¿CUÁNDO?";
    ws.getCell(`F${hdr2}`).value = "¿QUÉ?";
    ws.getCell(`G${hdr2}`).value = "¿QUIÉN?";
    ws.getCell(`H${hdr2}`).value = "¿CUÁNDO?";

    for (const a of [`A${hdr2}`, `C${hdr2}`, `E${hdr2}`, `F${hdr2}`, `G${hdr2}`, `H${hdr2}`]) {
      ws.getCell(a).font = { bold: true };
    }

    // ===== Response =====
    const buffer = await wb.xlsx.writeBuffer();
    res.status(200);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="FOR-014_InspeccionSeguridad_${id}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("[exportSeguridadXlsx] error", err?.message, err?.stack);
    return res.status(500).json({ message: "Error exportando Excel (FOR-014)", detail: err?.message || "Error interno" });
  }
}