import service from "../services/inspecciones.service.js";
import ExcelJS from "exceljs";
import { exportXlsx } from "../controllers/inspecciones.export.controller.js";

async function crear(req, res) {
  try {
    const result = await service.crearInspeccionCompleta({ user: req.user, body: req.body });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message, ...(result.data || {}) });
    }

    console.log("[POST /api/inspecciones] OK ->", result.data);

    return res.status(201).json(result.data);
  } catch (err) {
    console.error("inspecciones.crear FULL ERROR:", {
      message: err?.message,
      id_campo: err?.id_campo ?? null,
      stack: err?.stack,
    });

    const sqlMsg =
      err?.originalError?.info?.message ||
      err?.originalError?.message ||
      err?.message ||
      "Error interno";

    return res.status(500).json({
      message: sqlMsg,
      error: sqlMsg,
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

async function actualizarPorcentajeAccion(req, res) {
  try {
    const { idAccion } = req.params;

    const result = await service.actualizarPorcentajeAccion({
      id_accion: Number(idAccion),
      body: req.body,
      user: req.user,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.actualizarPorcentajeAccion:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

async function actualizarEstadoObservacion(req, res) {
  try {
    const { idObservacion } = req.params;

    const result = await service.actualizarEstadoObservacion({
      id_observacion: Number(idObservacion),
      body: req.body,
      user: req.user,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.actualizarEstadoObservacion:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

async function actualizarEstadoAccion(req, res) {
  try {
    const { idAccion } = req.params;

    const result = await service.actualizarEstadoAccion({
      id_accion: Number(idAccion),
      body: req.body,
      user: req.user,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("inspecciones.actualizarEstadoAccion:", err);
    return res.status(500).json({ message: "Error interno", error: err.message });
  }
}

export default {
  crear,
  listar,
  obtenerDetalle,
  obtenerDetalleFull,
  actualizarEstado,
  actualizarEstadoObservacion,
  actualizarEstadoAccion,
  actualizarPorcentajeAccion
};
