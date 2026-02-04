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

module.exports = { listarClientes };
