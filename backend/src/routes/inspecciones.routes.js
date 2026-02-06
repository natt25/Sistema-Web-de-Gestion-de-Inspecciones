const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/inspecciones.controller");

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

module.exports = router;
