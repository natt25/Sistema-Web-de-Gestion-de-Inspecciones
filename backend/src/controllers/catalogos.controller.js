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

async function listarLugares(req, res) {
  try {
    const idArea = req.query.id_area ? Number(req.query.id_area) : null;
    const data = await service.listarLugares(idArea);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.listarLugares:", err);
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

async function buscarClientes(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const data = await service.buscarClientes(q);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.buscarClientes:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function buscarServicios(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const data = await service.buscarServicios(q);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.buscarServicios:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function buscarAreas(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const data = await service.buscarAreas(q);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.buscarAreas:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function buscarLugares(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const id_area = req.query.id_area ? Number(req.query.id_area) : null;
    const data = await service.buscarLugares(q, id_area);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.buscarLugares:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function buscarEmpleados(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const data = await service.buscarEmpleados(q);
    return res.json(data);
  } catch (err) {
    console.error("catalogos.buscarEmpleados:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function crearArea(req, res) {
  try {
    const desc_area = (req.body?.desc_area || "").trim();
    if (!desc_area) return res.status(400).json({ message: "desc_area requerido" });
    const data = await service.crearArea(desc_area);
    return res.status(201).json(data);
  } catch (err) {
    console.error("catalogos.crearArea:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function crearLugar(req, res) {
  try {
    const id_area = Number(req.body?.id_area);
    const desc_lugar = (req.body?.desc_lugar || "").trim();
    if (!id_area || !desc_lugar) return res.status(400).json({ message: "id_area y desc_lugar requeridos" });
    const data = await service.crearLugar(id_area, desc_lugar);
    return res.status(201).json(data);
  } catch (err) {
    console.error("catalogos.crearLugar:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default {
  listarClientes,
  listarAreas,
  listarServicios,
  listarLugares,
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas,
  listarEstadosObservacion,
  buscarClientes,
  buscarServicios,
  buscarAreas,
  buscarLugares,
  buscarEmpleados,
  crearArea,
  crearLugar,
};
