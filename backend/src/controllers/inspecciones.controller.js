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

async function listar(req, res) {
  try {
    const result = await service.listarInspecciones({ user: req.user, query: req.query });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.listar:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

async function obtenerDetalle(req, res) {
  try {
    const { id } = req.params;

    const result = await service.obtenerDetalleInspeccion(id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.obtenerDetalle:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function obtenerDetalleFull(req, res) {
  try {
    const { id } = req.params;
    const result = await service.obtenerDetalleInspeccionFull(id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.obtenerDetalleFull:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;

    const result = await service.actualizarEstadoInspeccion({
      id_inspeccion: id,
      body: req.body,
      user: req.user
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.actualizarEstado:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}


module.exports = { crear, listar, obtenerDetalle, obtenerDetalleFull, actualizarEstado };
