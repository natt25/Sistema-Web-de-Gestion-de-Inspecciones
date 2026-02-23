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
import usuariosRoutes from "./routes/usuarios.routes.js";
import auditoriaRoutes from "./routes/auditoria.routes.js";
import accionesRoutes from "./routes/acciones.routes.js";
import plantillasRoutes from "./routes/plantillas.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_DEV = process.env.NODE_ENV !== "production";

const app = express();

// Middlewares globales
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(cors({
  origin(origin, callback) {
    // Permite requests sin Origin (curl/postman/server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Client-Mode"],
}));
app.use(express.json());
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    console.log("[http] request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });
  next();
});

if (IS_DEV) {
  app.use((req, res, next) => {
    const timeoutMs = 12000;
    const timer = setTimeout(() => {
      if (res.headersSent) return;
      console.error("[http] request timeout", {
        method: req.method,
        url: req.originalUrl,
        timeoutMs,
      });
      res.status(504).json({
        ok: false,
        message: "Timeout de servidor (watchdog dev)",
      });
    }, timeoutMs);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  });
}

// =======================
// Rutas de la API
// =======================
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/inspecciones", inspeccionesRoutes);
app.use("/api/inspecciones", observacionesRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/storage", express.static(path.join(__dirname, "./storage")));
app.use("/api/inspecciones", accionesRoutes);
app.use("/api/plantillas", (req, _res, next) => {
  console.log("[app] mount /api/plantillas", { method: req.method, path: req.path });
  next();
}, plantillasRoutes);

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
