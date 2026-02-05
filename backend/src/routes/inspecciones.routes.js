const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/inspecciones.controller");

// POST /api/inspecciones
router.post("/", authMiddleware, controller.crear);

module.exports = router;
