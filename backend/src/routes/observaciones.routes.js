const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/observaciones.controller");

// POST /api/inspecciones/:id/observaciones
router.post(
  "/:id/observaciones",
  authMiddleware,
  controller.crear
);

// GET /api/inspecciones/:id/observaciones
router.get(
  "/:id/observaciones",
  authMiddleware,
  controller.listar
);


module.exports = router;
