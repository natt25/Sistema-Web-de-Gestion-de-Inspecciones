import express from "express";
const router = express.Router();
import controller from "../controllers/auth.controller.js";
router.post("/login", controller.login);

export default router;