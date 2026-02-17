import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Carga y valida variables de entorno al inicio
import "./config/env.js";

// Rutas
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import catalogosRoutes from "./routes/catalogos.routes.js";
import inspeccionesRoutes from "./routes/inspecciones.routes.js";
import observacionesRoutes from "./routes/observaciones.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares globales
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// =======================
// Rutas de la API
// =======================
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/inspecciones", inspeccionesRoutes);
app.use("/api/inspecciones", observacionesRoutes);
app.use("/storage", express.static(path.join(__dirname, "./storage")));
app.use("/api/uploads", uploadsRoutes);

// =======================
// Ruta ra?z (solo informativa)
// =======================
app.get("/", (req, res) => {
  res.send("SSOMA Inspecciones API OK. Usa /api/health");
});

// =======================
// Handler de rutas no encontradas (SIEMPRE AL FINAL)
// =======================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada",
  });
});

export default app;
