import http from "./http";

export async function crearObservacion(idInspeccion, payload) {
  const res = await http.post(`/api/inspecciones/${idInspeccion}/observaciones`, payload);
  return res.data;
}
