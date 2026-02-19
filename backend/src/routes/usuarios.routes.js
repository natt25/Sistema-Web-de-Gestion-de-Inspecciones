import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import usuariosController from "../controllers/usuarios.controller.js";
import { audit } from "../middlewares/audit.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get(
  "/",
  roleMiddleware(["ADMIN_PRINCIPAL", "ADMIN"]),
  audit("USUARIO_LIST", { entity: "INS_USUARIO" }),
  usuariosController.list
);

router.post(
  "/",
  roleMiddleware(["ADMIN_PRINCIPAL", "ADMIN"]),
  audit("USUARIO_CREATE", { entity: "INS_USUARIO", entityIdFrom: "body.dni" }),
  usuariosController.create
);

router.put(
  "/:id",
  roleMiddleware(["ADMIN_PRINCIPAL", "ADMIN"]),
  audit("USUARIO_UPDATE", { entity: "INS_USUARIO", entityIdFrom: "params.id" }),
  usuariosController.update
);

router.patch(
  "/:id/estado",
  roleMiddleware(["ADMIN_PRINCIPAL", "ADMIN"]),
  audit("USUARIO_ESTADO", { entity: "INS_USUARIO", entityIdFrom: "params.id" }),
  usuariosController.changeStatus
);

router.post(
  "/:id/reset-password",
  roleMiddleware(["ADMIN_PRINCIPAL", "ADMIN"]),
  audit("USUARIO_RESET_PASSWORD", { entity: "INS_USUARIO", entityIdFrom: "params.id" }),
  usuariosController.resetPassword
);

export default router;
