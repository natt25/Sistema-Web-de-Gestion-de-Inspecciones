import express from "express";
const router = express.Router();

import authMiddleware from "../middlewares/auth.middleware.js";
import controller from "../controllers/catalogos.controller.js";
// GET /api/catalogos/clientes
router.get("/clientes", authMiddleware, controller.listarClientes);

// GET /api/catalogos/servicios
router.get("/servicios", authMiddleware, controller.listarServicios);

// GET /api/catalogos/areas
router.get("/areas", authMiddleware, controller.listarAreas);

// GET /api/catalogos/lugares?id_area=1
router.get("/lugares", authMiddleware, controller.listarLugares);

// GET /api/catalogos/areas/:id/lugares
router.get("/areas/:id/lugares", authMiddleware, controller.listarLugaresPorArea);

// GET /api/catalogos/niveles-riesgo
router.get("/niveles-riesgo", authMiddleware, controller.listarNivelesRiesgo);

// GET /api/catalogos/plantillas
router.get("/plantillas", authMiddleware, controller.listarPlantillas);

router.get("/estados-observacion", authMiddleware, controller.listarEstadosObservacion);

export default router;
