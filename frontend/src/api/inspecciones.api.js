import http from "./http";

export async function listarInspecciones(params = {}) {
  const res = await http.get("/api/inspecciones", {
    params: { ...params, _ts: Date.now() }, // 👈 cache buster
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  return res.data;
}

// crear inspección + respuestas
export async function crearInspeccion(payload) {
  const res = await http.post("/api/inspecciones", payload);
  return res.data;
}