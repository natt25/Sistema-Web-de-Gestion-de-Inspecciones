import service from "../services/observaciones.service.js";
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

async function crearAccion(req, res) {
  try {
    const { id } = req.params; // id_observacion
    const result = await service.crearAccionObservacion({
      id_observacion: id,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("observaciones.crearAccion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarAcciones(req, res) {
  try {
    const { id } = req.params; // id_observacion
    const result = await service.listarAccionesPorObservacion(id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("observaciones.listarAcciones:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function crearEvidenciaAccion(req, res) {
  try {
    const { id } = req.params; // id_accion
    const result = await service.crearEvidenciaAccion({
      id_accion: id,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("observaciones.crearEvidenciaAccion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function listarEvidenciasAccion(req, res) {
  try {
    const { id } = req.params; // id_accion
    const result = await service.listarEvidenciasPorAccion(id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("observaciones.listarEvidenciasAccion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function actualizarEstadoObservacion(req, res) {
  try {
    const { id } = req.params; // id_observacion
    const result = await service.actualizarEstadoObservacion({
      id_observacion: id,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("observaciones.actualizarEstadoObservacion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function actualizarEstadoAccion(req, res) {
  try {
    const { id } = req.params; // id_accion
    const result = await service.actualizarEstadoAccion({
      id_accion: id,
      body: req.body
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("observaciones.actualizarEstadoAccion:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}


export default {
  crear,
  listar,
  crearEvidencia,
  listarEvidencias,
  crearAccion,
  listarAcciones,
  crearEvidenciaAccion,
  listarEvidenciasAccion,
  actualizarEstadoObservacion,
  actualizarEstadoAccion
};