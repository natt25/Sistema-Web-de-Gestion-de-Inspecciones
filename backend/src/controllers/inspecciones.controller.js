const service = require("../services/inspecciones.service");

async function crear(req, res) {
  try {
    const result = await service.crearInspeccionCabecera({ user: req.user, body: req.body });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("inspecciones.crear:", err);
    return res.status(500).json({
        message: "Error interno",
        error: err.message,
    });

  }
}

module.exports = { crear };
