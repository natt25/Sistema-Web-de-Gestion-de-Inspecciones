import http from "./http";

export async function getInspeccionFull(id) {
  const res = await http.get(`/api/inspecciones/${id}/full`);
  return res.data;
}
