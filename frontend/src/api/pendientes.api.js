import http from "./http";

export async function listarPendientes({ dias = 7, solo_mias = 0, estado = "ALL" } = {}) {
  const q = new URLSearchParams();

  if (dias !== null && dias !== undefined) {
    q.set("dias", String(dias));
  }

  q.set("solo_mias", String(solo_mias));

  if (estado && estado !== "ALL") {
    q.set("estado", estado);
  }

  const res = await http.get(`/api/inspecciones/acciones/pendientes?${q.toString()}`);
  return res.data;
}
