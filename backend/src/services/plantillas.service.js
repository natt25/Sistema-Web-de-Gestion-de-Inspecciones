import repo from "../repositories/plantillas.repository.js";

async function obtenerDefinicionPlantilla(id_plantilla_inspec) {
  const def = await repo.obtenerDefinicionPlantilla(id_plantilla_inspec);
  if (!def) return { ok: false, status: 404, message: "Definicion no encontrada" };
  return { ok: true, status: 200, data: def };
}

export default { obtenerDefinicionPlantilla };