// frontend/src/api/inspecciones.api.js
import http from "./http";

export async function listarInspecciones(params = {}) {
  const res = await http.get("/api/inspecciones", { params });
  return res.data;
}

// ✅ NUEVO: crear inspección + respuestas
export async function crearInspeccion(payload) {
  const res = await http.post("/api/inspecciones", payload);
  return res.data;
}