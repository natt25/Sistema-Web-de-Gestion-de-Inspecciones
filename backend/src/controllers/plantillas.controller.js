import repo from "../repositories/plantillas.repository.js";

function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
        const camposLimpios = (campos || []).map((c, idx) => ({
          idx,
          id_campo: Number(c.id_campo),
          item_ref_raw: String(c.item_ref || "").trim(),
          item_ref_num: Number.parseInt(String(c.item_ref || "").replace(/\D/g, ""), 10),
          desc_norm: normalizeText(c.descripcion_item),
        }));

        const byItemRef = new Map();
        const byItemRefNum = new Map();
        const byDesc = new Map();
        for (const c of camposLimpios) {
          if (c.item_ref_raw) byItemRef.set(c.item_ref_raw, c.id_campo);
          if (!Number.isNaN(c.item_ref_num)) byItemRefNum.set(c.item_ref_num, c.id_campo);
          if (c.desc_norm) byDesc.set(c.desc_norm, c.id_campo);
        }

        let firstMissing = null;
        parsed.items = parsed.items.map((it, idx) => {
          const rawIdCampo = Number(it?.id_campo);
          const itemRef = String(it?.item_ref ?? it?.id ?? "").trim();
          const itemNum = Number.parseInt(String(it?.id ?? it?.item_ref ?? "").replace(/\D/g, ""), 10);
          const desc = normalizeText(it?.descripcion ?? it?.texto);

          const mapped =
            (!Number.isNaN(rawIdCampo) && rawIdCampo > 0) ? rawIdCampo :
            (itemRef && byItemRef.get(itemRef)) ? byItemRef.get(itemRef) :
            (!Number.isNaN(itemNum) && byItemRefNum.get(itemNum)) ? byItemRefNum.get(itemNum) :
            (desc && byDesc.get(desc)) ? byDesc.get(desc) :
            (camposLimpios[idx]?.id_campo || null);

          if (!mapped && !firstMissing) {
            firstMissing = {
              idx,
              id: it?.id ?? null,
              item_ref: it?.item_ref ?? null,
              texto: it?.texto ?? it?.descripcion ?? null,
            };
          }

          return { ...it, id_campo: mapped ? Number(mapped) : null };
        });

        if (firstMissing) {
          console.warn("[plantillas.controller] item sin id_campo mapeado", {
            plantilla: id,
            firstMissing,
            totalItems: parsed.items.length,
            totalCampos: camposLimpios.length,
          });
        }
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
