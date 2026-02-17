import express from "express";
const router = express.Router();

import authMiddleware from "../middlewares/auth.middleware.js";
import controller from "../controllers/uploads.controller.js";
import service from "../services/uploads.service.js";
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

export default router;