import repo from "../repositories/plantillas.repository.js";

async function list(req, res) {
  const data = await repo.listPlantillas();
  return res.json(data);
}

async function definicion(req, res) {
  const id = Number(req.params.id);
  const version = req.query.version ? Number(req.query.version) : null;

  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ message: "id_plantilla_inspec inválido" });
  }

  const row = version
    ? await repo.getDefinicionByVersion(id, version)
    : await repo.getDefinicion(id);

  if (!row) return res.status(404).json({ message: "Definición no encontrada" });

  let json = row.json_definicion;
  // si viene como string, lo dejamos; frontend puede parsear
  return res.json({
    id_plantilla_inspec: row.id_plantilla_inspec,
    version: row.version,
    checksum: row.checksum,
    fecha_creacion: row.fecha_creacion,
    json_definicion: json
  });
}

export default { list, definicion };