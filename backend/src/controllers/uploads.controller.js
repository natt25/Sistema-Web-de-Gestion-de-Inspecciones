const service = require("../services/uploads.service");

async function uploadObservacion(req, res) {
  try {
    const { id } = req.params;

    const result = await service.subirEvidenciaObservacion({
      id_observacion: id,
      file: req.file
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    
    console.error("uploads.uploadObservacion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function uploadAccion(req, res) {
  try {
    const { id } = req.params;

    const result = await service.subirEvidenciaAccion({
      id_accion: id,
      file: req.file
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("uploads.uploadAccion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

module.exports = {
  uploadObservacion,
  uploadAccion
};
