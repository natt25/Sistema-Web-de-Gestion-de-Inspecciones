import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { deleteEvidenciaAcc } from "../controllers/evidencias.controller.js";

const router = express.Router();

// eliminar evidencia de acción
router.delete("/acciones/:id", authMiddleware, deleteEvidenciaAcc);

export default router;