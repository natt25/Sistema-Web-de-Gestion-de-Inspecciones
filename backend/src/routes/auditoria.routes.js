import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import auditoriaController from "../controllers/auditoria.controller.js";
import { audit } from "../middlewares/audit.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  roleMiddleware(["ADMIN_PRINCIPAL", "ADMIN"]),
  audit("AUDITORIA_LIST", { entity: "INS_AUDITORIA_EVENTO" }),
  auditoriaController.list
);

export default router;
