import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import controller from "../controllers/plantillas.controller.js";

const router = Router();
router.use(authMiddleware);

// GET /api/plantillas
router.get("/", controller.list);

// GET /api/plantillas/:id/definicion?version=1
router.get("/:id/definicion", controller.definicion);

export default router;
