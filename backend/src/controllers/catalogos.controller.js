import service from "../services/catalogos.service.js";
async function listarClientes(req, res) {
  try {
    const data = await service.listarClientes();
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarClientes:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarAreas(req, res) {
  try {
    const data = await service.listarAreas();
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarAreas:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarServicios(req, res) {
  try {
    const data = await service.listarServicios();
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarServicios:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarLugaresPorArea(req, res) {
  try {
    const { id } = req.params;
    const data = await service.listarLugaresPorArea(id);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarLugaresPorArea:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarNivelesRiesgo(req, res) {
  try {
    const data = await service.listarNivelesRiesgo();
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarNivelesRiesgo:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarPlantillas(req, res) {
  try {
    const data = await service.listarPlantillas();
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarPlantillas:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarEstadosObservacion(req, res) {
  try {
    const data = await service.listarEstadosObservacion();
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarEstadosObservacion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default {
  listarClientes,
  listarAreas,
  listarServicios,
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas,
  listarEstadosObservacion
};