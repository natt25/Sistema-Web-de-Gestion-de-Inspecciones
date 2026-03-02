// backend/src/server.js
import app from "./app.js";
import evidenciasRoutes from "./routes/evidencias.routes.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[backend] running on http://localhost:${PORT}`);
});

app.use("/api/evidencias", evidenciasRoutes);
