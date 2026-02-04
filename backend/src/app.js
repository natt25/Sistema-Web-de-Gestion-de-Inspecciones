const express = require("express");
const cors = require("cors");

// Carga y valida variables de entorno al inicio
require("./config/env");

// Rutas
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const catalogosRoutes = require("./routes/catalogos.routes");

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// =======================
// Rutas de la API
// =======================
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/catalogos", catalogosRoutes);

// =======================
// Ruta raíz (solo informativa)
// =======================
app.get("/", (req, res) => {
  res.send("SSOMA Inspecciones API OK. Usa /api/health");
});

// =======================
// Handler de rutas no encontradas
// =======================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada"
  });
});

module.exports = app;
