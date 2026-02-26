import express from "express";
import { exportXlsx } from "../controllers/inspecciones.export.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import controller from "../controllers/inspecciones.controller.js";

const router = express.Router();

// POST /api/inspecciones
router.post("/", authMiddleware, controller.crear);

// GET /api/inspecciones
router.get("/", authMiddleware, controller.listar);

// GET /api/inspecciones/:id
router.get("/:id", authMiddleware, controller.obtenerDetalle);

// GET /api/inspecciones/:id/full
router.get("/:id/full", authMiddleware, controller.obtenerDetalleFull);

// PATCH /api/inspecciones/:id/estado
router.patch("/:id/estado", authMiddleware, controller.actualizarEstado);

// --- OBSERVACIONES: cambiar estado (ej: cerrar) ---
router.patch(
  "/observaciones/:idObservacion/estado",
  authMiddleware,
  controller.actualizarEstadoObservacion
);

// --- ACCIONES: cambiar estado (ej: cumplir) ---
router.patch(
  "/acciones/:idAccion/estado",
  authMiddleware,
  controller.actualizarEstadoAccion
);

router.get("/:id/export/xlsx", authMiddleware, exportXlsx);

export default router;