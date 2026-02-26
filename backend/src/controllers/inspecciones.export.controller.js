import exportService from "../services/inspecciones.export.service.js";

export async function exportXlsx(req, res) {
  try {
    const { id } = req.params;
    const buffer = await exportService.generarInspeccionXlsx(id);
    if (!buffer) {
      return res.status(404).json({ message: "Inspeccion no encontrada" });
    }

    res.status(200);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="AQP-SSOMA-FOR-013_Inspeccion_${id}.xlsx"`
    );
    return res.send(buffer);
  } catch (err) {
    if (err?.code === "INVALID_ID") {
      return res.status(400).json({ message: "id_inspeccion invalido" });
    }
    if (err?.code === "TEMPLATE_NOT_FOUND") {
      return res.status(500).json({ message: "Plantilla no encontrada", path: err?.templatePath });
    }

    console.error("[xlsx-export] error no controlado", { message: err?.message, stack: err?.stack });
    return res.status(500).json({
      message: "Error exportando Excel",
      detail: err?.message || "Error interno",
    });
  }
}
