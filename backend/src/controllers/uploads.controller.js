const service = require("../services/uploads.service");

async function subirObs(req, res) {
  try {
    const { id } = req.params; // id_observacion
    const result = await service.subirEvidenciaObservacion({
      id_observacion: id,
      file: req.file
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("uploads.subirObs:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

async function subirAcc(req, res) {
  try {
    const { id } = req.params; // id_accion
    const result = await service.subirEvidenciaAccion({
      id_accion: id,
      file: req.file
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("uploads.subirAcc:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

module.exports = { subirObs, subirAcc };
