import http from "./http";

export async function listarInspecciones(params) {
  const config = {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  };

  if (params && Object.keys(params).length > 0) {
    config.params = params;
  }

  const res = await http.get("/api/inspecciones", config);
  return res.data;
}

// crear inspeccion + respuestas
export async function crearInspeccion(payload) {
  const res = await http.post("/api/inspecciones", payload);
  return res.data;
}

export function descargarInspeccionXlsx(id) {
  return http.get(`/api/inspecciones/${id}/export/xlsx`, {
    responseType: "blob",
  });
}
