import repo from "../repositories/plantillas.repository.js";

async function listarPlantillas() {
  try {
    const rows = await repo.listPlantillas();
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error("[plantillas.service] listarPlantillas error:", error);
    return [];
  }
}

async function obtenerDefinicionPlantilla(id_plantilla_inspec) {
  const def = await repo.obtenerDefinicionPlantilla(id_plantilla_inspec);
  if (!def) return { ok: false, status: 404, message: "Definicion no encontrada" };
  return { ok: true, status: 200, data: def };
}

export default { listarPlantillas, obtenerDefinicionPlantilla };
