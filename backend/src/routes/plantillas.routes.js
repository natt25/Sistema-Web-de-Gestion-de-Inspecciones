import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import controller from "../controllers/plantillas.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/", controller.list);
router.get("/:id/definicion", controller.definicion);

export default router;