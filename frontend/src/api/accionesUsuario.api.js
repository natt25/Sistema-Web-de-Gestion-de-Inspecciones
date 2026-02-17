import http from "./http";

// OBSERVACIONES
export async function crearObservacion(idInspeccion, payload) {
  const res = await http.post(`/api/inspecciones/${idInspeccion}/observaciones`, payload);
  return res.data;
}

export async function patchEstadoObservacion(idObservacion, id_estado_observacion) {
  const res = await http.patch(`/api/inspecciones/observaciones/${idObservacion}/estado`, {
    id_estado_observacion,
  });
  return res.data;
}

// ACCIONES
export async function crearAccion(idObservacion, payload) {
  const res = await http.post(`/api/inspecciones/observaciones/${idObservacion}/acciones`, payload);
  return res.data;
}

export async function patchEstadoAccion(idAccion, id_estado_accion) {
  const res = await http.patch(`/api/inspecciones/acciones/${idAccion}/estado`, {
    id_estado_accion,
  });
  return res.data;
}

// INSPECCION
export async function patchEstadoInspeccion(idInspeccion, id_estado_inspeccion) {
  const res = await http.patch(`/api/inspecciones/${idInspeccion}/estado`, {
    id_estado_inspeccion,
  });
  return res.data;
}

// UPLOADS (archivo real)
export async function subirEvidenciaObservacion(idObservacion, file) {
  const form = new FormData();
  form.append("file", file);

  const res = await http.post(`/api/uploads/observaciones/${idObservacion}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // incluye archivo_ruta, hash, etc.
}

export async function subirEvidenciaAccion(idAccion, file) {
  const form = new FormData();
  form.append("file", file);

  const res = await http.post(`/api/uploads/acciones/${idAccion}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
