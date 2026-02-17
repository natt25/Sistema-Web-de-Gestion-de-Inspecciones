import http from "./http";

export async function crearAccion(idObservacion, payload) {
  const res = await http.post(`/api/inspecciones/observaciones/${idObservacion}/acciones`, payload);
  return res.data;
}
