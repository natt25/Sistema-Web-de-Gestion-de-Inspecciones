import express from "express";
import controller from "../controllers/health.controller.js";
const router = express.Router();
router.get("/", controller.health);

import authMiddleware from "../middlewares/auth.middleware.js";
router.get("/protegido", authMiddleware, (req, res) => {
  res.json({ message: "Acceso OK", user: req.user });
});

export default router;