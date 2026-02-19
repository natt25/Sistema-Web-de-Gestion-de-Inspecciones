import http from "./http";

export async function listarPendientes({ dias = 7, solo_mias = 0 } = {}) {
  const q = new URLSearchParams({ dias: String(dias), solo_mias: String(solo_mias) });
  const res = await http.get(`/api/inspecciones/acciones/pendientes?${q.toString()}`);
  return res.data;
}
