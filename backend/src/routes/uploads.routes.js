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

// PUT /api/uploads/firma  (firma del usuario logueado)
router.put(
  "/firma",
  authMiddleware,
  service.uploadFirmaMiddleware,
  controller.subirFirma
);

// DELETE /api/uploads/acciones/evidencias/:id_acc_evidencia
router.delete(
  "/acciones/evidencias/:id_acc_evidencia",
  authMiddleware,
  controller.eliminarAccEvidencia
);

// (OPCIONAL) DELETE /api/uploads/observaciones/evidencias/:id  (id_obs_evidencia)
router.delete(
  "/observaciones/evidencias/:id",
  authMiddleware,
  controller.eliminarObsEvidencia
);

export default router;
