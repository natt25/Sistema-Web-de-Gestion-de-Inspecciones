const service = require("../services/observaciones.service");

async function crear(req, res) {
  try {
    const { id } = req.params;

    const result = await service.crearObservacion({
      id_inspeccion: id,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("observaciones.crear:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

module.exports = { crear };
