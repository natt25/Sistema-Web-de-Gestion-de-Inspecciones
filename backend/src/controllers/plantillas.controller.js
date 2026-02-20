import repo from "../repositories/plantillas.repository.js";

async function list(req, res) {
  const data = await repo.listActivas();
  res.json(data);
}

async function definicion(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "id inválido" });

  const row = await repo.getDefinicionActual(id);
  if (!row) return res.status(404).json({ message: "Plantilla/definición no encontrada" });

  // json_definicion puede venir como string
  let json = row.json_definicion;
  try {
    if (typeof json === "string") json = JSON.parse(json);
  } catch {
    return res.status(500).json({ message: "json_definicion inválido en BD" });
  }

  res.json({ id_plantilla_inspec: id, version: row.version, definicion: json });
}

export default { list, definicion };