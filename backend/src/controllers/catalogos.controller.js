const service = require("../services/catalogos.service");

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



module.exports = { listarClientes, listarAreas, listarServicios };
