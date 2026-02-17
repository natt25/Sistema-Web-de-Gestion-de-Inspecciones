import express from "express";
const router = express.Router();

import authMiddleware from "../middlewares/auth.middleware.js";
import controller from "../controllers/inspecciones.controller.js";
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

export default router;