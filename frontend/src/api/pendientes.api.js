import http from "./http";

export async function listarPendientes({ dias = 7, solo_mias = 0, estado = "ALL" } = {}) {
  const q = new URLSearchParams();

  // ✅ si dias es null (3+ meses), NO lo mandes
  if (dias !== null && dias !== undefined) q.set("dias", String(dias));

  q.set("solo_mias", String(solo_mias));

  // ✅ estado opcional
  if (estado && estado !== "ALL") q.set("estado", String(estado));

  const res = await http.get(`/api/inspecciones/acciones/pendientes?${q.toString()}`);
  return res.data;
}