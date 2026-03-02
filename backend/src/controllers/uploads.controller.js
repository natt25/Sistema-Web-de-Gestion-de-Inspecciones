import service from "../services/uploads.service.js";
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

async function subirFirma(req, res) {
  try {
    const id_usuario = req.user?.id_usuario;

    const result = await service.subirFirmaUsuario({
      id_usuario,
      file: req.file
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("uploads.subirFirma:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

async function eliminarAccEvidenciaAcc(req, res) {
  try {
    const { id_acc_evidencia } = req.params;
    const result = await service.eliminarEvidenciaAccion({ id_acc_evidencia });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("uploads.eliminarAccEvidenciaAcc:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

async function eliminarObsEvidencia(req, res) {
  try {
    const { id } = req.params; // id_obs_evidencia
    const result = await service.eliminarEvidenciaObservacion({ id_obs_evidencia: id });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("uploads.eliminarObsEvidencia:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

export default { subirObs, subirAcc, subirFirma, eliminarAccEvidenciaAcc, eliminarObsEvidencia };
