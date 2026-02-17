import http from "./http";

/**
 * Sube evidencia REAL (multipart) para una OBSERVACIÓN
 * Backend: POST /api/uploads/observaciones/:id
 */
export async function uploadEvidenciaObs(idObservacion, file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await http.post(`/api/uploads/observaciones/${idObservacion}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

/**
 * Sube evidencia REAL (multipart) para una ACCIÓN
 * Backend: POST /api/uploads/acciones/:id
 */
export async function uploadEvidenciaAcc(idAccion, file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await http.post(`/api/uploads/acciones/${idAccion}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
