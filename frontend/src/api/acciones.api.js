import http from "./http";

export async function crearAccion(idObservacion, payload) {
  const res = await http.post(`/api/inspecciones/observaciones/${idObservacion}/acciones`, payload);
  return res.data;
}

export async function actualizarEstadoAccion(idAccion, id_estado_accion) {
  const res = await http.patch(`/api/inspecciones/acciones/${idAccion}/estado`, {
    id_estado_accion,
  });
  return res.data;
}
