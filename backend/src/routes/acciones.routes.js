import { Router } from "express";
import accionesController from "../controllers/acciones.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";

const router = Router();

// GET /api/inspecciones/acciones/pendientes?dias=7&solo_mias=0
router.get(
  "/acciones/pendientes",
  authMiddleware,
  audit("ACC_PENDIENTES_VIEW", { entity: "INS_ACCION", entityIdFrom: "user.id_usuario" }),
  accionesController.pendientes
);

export default router;
