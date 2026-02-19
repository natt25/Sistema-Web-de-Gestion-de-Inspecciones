import { Router } from "express";
import authController from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";

const router = Router();

router.post("/login", audit("LOGIN_TRY", { entity: "INS_USUARIO", entityIdFrom: "body.dni" }), authController.login);

// NUEVO: cambiar contraseña (requiere token)
router.post(
  "/change-password",
  authMiddleware,
  audit("PASSWORD_CHANGE", { entity: "INS_USUARIO", entityIdFrom: "params.id" }), // o quítalo
  authController.changePassword
);


export default router;

// import express from "express";
// const router = express.Router();
// import controller from "../controllers/auth.controller.js";
// router.post("/login", controller.login);

// export default router;