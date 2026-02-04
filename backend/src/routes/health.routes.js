const express = require("express");
const controller = require("../controllers/health.controller");

const router = express.Router();
router.get("/", controller.health);

const authMiddleware = require("../middlewares/auth.middleware");
router.get("/protegido", authMiddleware, (req, res) => {
  res.json({ message: "Acceso OK", user: req.user });
});

module.exports = router;
