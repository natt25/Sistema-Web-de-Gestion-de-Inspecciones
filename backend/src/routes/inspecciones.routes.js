import express from "express";
import { exportXlsx } from "../controllers/inspecciones.export.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import guestReadOnlyMiddleware from "../middlewares/guest-readonly.middleware.js";
import controller from "../controllers/inspecciones.controller.js";

const router = express.Router();

// POST /api/inspecciones
router.post("/", authMiddleware, guestReadOnlyMiddleware, controller.crear);

// GET /api/inspecciones
router.get("/", authMiddleware, controller.listar);

// ✅ EXPORT DEBE IR ANTES QUE "/:id"
router.get("/:id/export/xlsx", authMiddleware, exportXlsx);

// GET /api/inspecciones/:id/full
router.get("/:id/full", authMiddleware, controller.obtenerDetalleFull);

// GET /api/inspecciones/:id
router.get("/:id", authMiddleware, controller.obtenerDetalle);

// PATCH /api/inspecciones/:id/estado
router.patch("/:id/estado", authMiddleware, guestReadOnlyMiddleware, controller.actualizarEstado);

// OBSERVACIONES / ACCIONES...
router.patch("/observaciones/:idObservacion/estado", authMiddleware, guestReadOnlyMiddleware, controller.actualizarEstadoObservacion);
router.patch("/acciones/:idAccion/estado", authMiddleware, guestReadOnlyMiddleware, controller.actualizarEstadoAccion);

router.patch("/acciones/:idAccion/porcentaje", authMiddleware, guestReadOnlyMiddleware, controller.actualizarPorcentajeAccion);

export default router;
