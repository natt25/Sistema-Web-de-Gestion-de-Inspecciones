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

async function listar(req, res) {
  try {
    const { id } = req.params;
    const result = await service.listarPorInspeccion(id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("observaciones.listar:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function crearEvidencia(req, res) {
  try {
    const { id } = req.params; // id_observacion
    const result = await service.crearEvidenciaObservacion({
      id_observacion: id,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("observaciones.crearEvidencia:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarEvidencias(req, res) {
  try {
    const { id } = req.params; // id_observacion
    const result = await service.listarEvidenciasPorObservacion(id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("observaciones.listarEvidencias:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}


module.exports = { crear, listar, crearEvidencia, listarEvidencias };
