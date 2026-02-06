const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/uploads.controller");

const {
  uploadObsMiddleware,
  uploadAccMiddleware
} = require("../services/uploads.service");

// POST /api/uploads/observaciones/:id
router.post(
  "/observaciones/:id",
  authMiddleware,
  uploadObsMiddleware,
  controller.uploadObservacion
);

// POST /api/uploads/acciones/:id
router.post(
  "/acciones/:id",
  authMiddleware,
  uploadAccMiddleware,
  controller.uploadAccion
);

module.exports = router;
