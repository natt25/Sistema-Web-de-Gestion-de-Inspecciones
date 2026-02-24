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
        const campos = await repo.listarCamposPorPlantilla(id);
        const byItemRef = new Map((campos || []).map((c) => [String(c.item_ref || "").trim(), Number(c.id_campo)]));
        const byDesc = new Map((campos || []).map((c) => [String(c.descripcion_item || "").trim().toLowerCase(), Number(c.id_campo)]));

        parsed.items = parsed.items.map((it) => {
          const rawIdCampo = Number(it?.id_campo);
          const itemRef = String(it?.item_ref ?? it?.id ?? "").trim();
          const desc = String(it?.descripcion ?? it?.texto ?? "").trim().toLowerCase();
          const mapped =
            (!Number.isNaN(rawIdCampo) && rawIdCampo > 0) ? rawIdCampo :
            (itemRef && byItemRef.get(itemRef)) ? byItemRef.get(itemRef) :
            (desc && byDesc.get(desc)) ? byDesc.get(desc) :
            null;

          return { ...it, id_campo: mapped ? Number(mapped) : null };
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
