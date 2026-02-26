import path from "path";
import ExcelJS from "exceljs";
import service from "../services/inspecciones.service.js";

export async function exportXlsx(req, res) {
  try {
    const { id } = req.params;

    const result = await service.obtenerDetalleInspeccionFull(id);
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    const data = result.data;

    // ✅ Coloca tu plantilla en: backend/src/templates/AQP-SSOMA-FOR-013 Inspección General.xlsx
    const templatePath = path.resolve(process.cwd(), "src", "templates", "AQP-SSOMA-FOR-013 Inspección General.xlsx");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets[0]; // primera hoja

    // ======================
    // 1) Rellenar cabecera
    // ======================
    const cab = data.cabecera || {};

    // ⚠️ Ajusta estas celdas a tu plantilla real
    // (yo te dejo ejemplo, tú cambias coordenadas cuando mires la plantilla en Excel)
    ws.getCell("C6").value = cab?.desc_area || "";
    ws.getCell("C7").value = cab?.nombre_formato || cab?.codigo_formato || "";
    ws.getCell("C8").value = cab?.fecha_inspeccion ? new Date(cab.fecha_inspeccion) : null;

    ws.getCell("C9").value = cab?.raz_social || cab?.id_cliente || "";
    ws.getCell("C10").value = cab?.nombre_servicio || cab?.servicio_detalle || "";

    // ======================
    // 2) Participantes
    // ======================
    const parts = Array.isArray(data.participantes) ? data.participantes : [];
    const realizado = parts.find((p) => p.tipo === "REALIZADO_POR");
    const inspectores = parts.filter((p) => p.tipo === "INSPECTOR");

    ws.getCell("C12").value = realizado?.nombre || "";
    ws.getCell("C13").value = realizado?.cargo || "";

    // Ejemplo: lista inspectores desde fila 15
    let rowIns = 15;
    for (const ins of inspectores) {
      ws.getCell(`B${rowIns}`).value = ins.nombre || ins.dni || "";
      ws.getCell(`E${rowIns}`).value = ins.cargo || "";
      rowIns++;
    }

    // ======================
    // 3) Respuestas (JSON)
    // ======================
    const respuestas = Array.isArray(data.respuestas) ? data.respuestas : [];

    // Ejemplo: tabla de respuestas desde fila 25
    // Columnas ejemplo: Item | Descripción | Estado | Observación
    let row = 25;
    for (const r of respuestas) {
      ws.getCell(`A${row}`).value = r.item_id || "";
      ws.getCell(`B${row}`).value = r.descripcion || "";
      ws.getCell(`F${row}`).value = r.estado || "";
      ws.getCell(`G${row}`).value = r.observacion || "";
      row++;
    }

    // Output
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Inspeccion_${id}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportXlsx error:", err);
    return res.status(500).json({ message: "Error exportando Excel", error: err?.message });
  }
}