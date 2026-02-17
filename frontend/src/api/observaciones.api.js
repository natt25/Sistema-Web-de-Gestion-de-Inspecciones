import http from "./http";

export async function crearObservacion(idInspeccion, payload) {
  const res = await http.post(`/api/inspecciones/${idInspeccion}/observaciones`, payload);
  return res.data;
}

export async function actualizarEstadoObservacion(idObservacion, id_estado_observacion) {
  const res = await http.patch(`/api/inspecciones/observaciones/${idObservacion}/estado`, {
    id_estado_observacion,
  });
  return res.data;
}
