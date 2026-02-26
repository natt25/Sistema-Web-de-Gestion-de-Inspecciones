import repo from "../repositories/plantillas.repository.js";

function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRefKey(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRefNum(v) {
  const n = Number.parseInt(String(v || "").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
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
    let unmappedItems = [];
    try {
      const parsed =
        typeof row.json_definicion === "string"
          ? JSON.parse(row.json_definicion)
          : row.json_definicion;

      // Sembrar campos SOLO si no hay registros aún (idempotente)
      const nCampos = await repo.countCamposPorDef(row.id_plantilla_def);
      if (nCampos === 0) {
        try {
          await repo.ensureCamposFromJsonDefinicion(row.id_plantilla_def, parsed);
        } catch (e) {
          const num = e?.originalError?.number || e?.number;
          if (num !== 2627) throw e; // 2627 = duplicate key
          console.warn("[plantillas.controller] seed duplicado (2627) ignorado");
        }
      }
      
      if (parsed && Array.isArray(parsed.items)) {
        const campos = await repo.listarCamposPorPlantilla(id, row.id_plantilla_def);
        const camposLimpios = (campos || []).map((c, idx) => ({
          idx,
          id_campo: Number(c.id_campo),
          item_ref_raw: normalizeRefKey(c.item_ref),
          item_ref_num: normalizeRefNum(c.item_ref),
          desc_norm: normalizeText(c.descripcion_item),
        }));

        const byItemRef = new Map();
        const byItemRefNum = new Map();
        const byDesc = new Map();
        for (const c of camposLimpios) {
          if (c.item_ref_raw) byItemRef.set(c.item_ref_raw, c.id_campo);
          if (c.item_ref_num != null) byItemRefNum.set(c.item_ref_num, c.id_campo);
          if (c.desc_norm) byDesc.set(c.desc_norm, c.id_campo);
        }

        const missingItems = [];
        let mappedCount = 0;
        parsed.items = parsed.items.map((it, idx) => {
          const rawIdCampo = Number(it?.id_campo);
          const refCandidates = [it?.item_ref, it?.ref, it?.id, it?.codigo, it?.numero];
          const refKey = refCandidates
            .map((v) => normalizeRefKey(v))
            .find((v) => v);
          const refNum = refCandidates
            .map((v) => normalizeRefNum(v))
            .find((v) => v != null);
          const desc = normalizeText(it?.descripcion ?? it?.texto);

          const mapped =
            (!Number.isNaN(rawIdCampo) && rawIdCampo > 0) ? rawIdCampo :
            (refKey && byItemRef.get(refKey)) ? byItemRef.get(refKey) :
            (refNum != null && byItemRefNum.get(refNum)) ? byItemRefNum.get(refNum) :
            (desc && byDesc.get(desc)) ? byDesc.get(desc) :
            (camposLimpios[idx]?.id_campo || null);

          if (!mapped) {
            const missing = {
              idx,
              id: it?.id ?? null,
              ref: it?.ref ?? null,
              item_ref: it?.item_ref ?? null,
              descripcion: it?.descripcion ?? it?.texto ?? null,
            };
            missingItems.push(missing);
            console.warn("[definicion] item sin id_campo", {
              plantilla: id,
              item_ref: missing.item_ref ?? missing.ref,
              desc: missing.descripcion,
            });
          } else {
            mappedCount += 1;
          }

          return { ...it, id_campo: mapped ? Number(mapped) : null };
        });

        if (missingItems.length > 0) {
          console.warn("[plantillas.controller] item sin id_campo mapeado", {
            plantilla: id,
            firstMissing: missingItems[0],
            totalMissing: missingItems.length,
            totalItems: parsed.items.length,
            totalCampos: camposLimpios.length,
          });
        }

        unmappedItems = missingItems;
        const sample = missingItems.slice(0, 10);
        console.log("[plantillas.controller] definicion mapping", {
          plantilla: id,
          totalItems: parsed.items.length,
          mapped: mappedCount,
          unmapped: missingItems.length,
          sampleUnmapped: sample,
        });
      }
      jsonDef = parsed;
    } catch (e) {
      console.error("[plantillas.controller] definicion parse/seed error:", e);
    }

    return res.json({
      id_plantilla_def: row.id_plantilla_def,
      id_plantilla_inspec: row.id_plantilla_inspec,
      version: row.version,
      checksum: row.checksum,
      fecha_creacion: row.fecha_creacion,
      json_definicion: jsonDef,
      unmapped_items: unmappedItems,
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
