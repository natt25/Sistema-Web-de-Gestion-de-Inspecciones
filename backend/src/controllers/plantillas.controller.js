import repo from "../repositories/plantillas.repository.js";

async function list(req, res) {
  try {
    const data = await repo.listPlantillas();
    console.log(
      `[plantillas.controller] GET /api/plantillas -> ${Array.isArray(data) ? data.length : 0} registros`
    );
    return res.json(data);
  } catch (error) {
    console.error("[plantillas.controller] list error:", error);
    return res.status(500).json({ message: "Error al listar plantillas" });
  }
}

async function definicion(req, res) {
  const started = Date.now();
  const id = Number(req.params.id);
  const version = req.query.version ? Number(req.query.version) : null;

  console.log(`[plantillas.controller] GET /api/plantillas/${req.params.id}/definicion start`, {
    version,
    user: req.user?.id_usuario ?? null,
  });

  try {
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: "id_plantilla_inspec invalido" });
    }

    const row = version
      ? await repo.getDefinicionByVersion(id, version)
      : await repo.getDefinicion(id);

    if (!row) return res.status(404).json({ message: "Definicion no encontrada" });

    let jsonDef = row.json_definicion;
    try {
      const parsed = typeof row.json_definicion === "string"
        ? JSON.parse(row.json_definicion)
        : row.json_definicion;

      if (parsed && Array.isArray(parsed.items)) {
        parsed.items = parsed.items.map((it, idx) => {
          const idCampo = Number(it?.id_campo ?? it?.id ?? (idx + 1));
          return {
            ...it,
            id_campo: Number.isNaN(idCampo) ? (idx + 1) : idCampo,
          };
        });
      }
      jsonDef = parsed;
    } catch {
      // si json_definicion no parsea, se devuelve tal cual
    }

    return res.json({
      id_plantilla_inspec: row.id_plantilla_inspec,
      version: row.version,
      checksum: row.checksum,
      fecha_creacion: row.fecha_creacion,
      json_definicion: jsonDef,
    });
  } catch (error) {
    console.error("[plantillas.controller] definicion error:", error);
    return res.status(500).json({ message: "Error al obtener definicion de plantilla" });
  } finally {
    console.log(`[plantillas.controller] GET /api/plantillas/${req.params.id}/definicion end`, {
      durationMs: Date.now() - started,
    });
  }
}

export default { list, definicion };
