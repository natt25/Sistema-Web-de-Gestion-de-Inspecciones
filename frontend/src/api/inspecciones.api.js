import http from "./http";

export async function listarInspecciones(params = {}) {
  // params: { id_area, id_estado, id_usuario, fecha_inicio, fecha_fin }
  const res = await http.get("/api/inspecciones", { params });
  return res.data;
}