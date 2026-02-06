const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/uploads.controller");
const service = require("../services/uploads.service");

// POST /api/uploads/observaciones/:id
router.post(
  "/observaciones/:id",
  authMiddleware,
  service.uploadObsMiddleware,
  controller.subirObs
);

// POST /api/uploads/acciones/:id
router.post(
  "/acciones/:id",
  authMiddleware,
  service.uploadAccMiddleware,
  controller.subirAcc
);

module.exports = router;
