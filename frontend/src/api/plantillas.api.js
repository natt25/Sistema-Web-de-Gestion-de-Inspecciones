import http from "./http";

export async function listarPlantillas() {
  const { data } = await http.get("/api/plantillas");
  return data;
}

export async function obtenerDefinicionPlantilla(id, version) {
  const qs = version ? `?version=${encodeURIComponent(version)}` : "";
  const { data } = await http.get(`/api/plantillas/${id}/definicion${qs}`);
  return data;
}

// Alias de compatibilidad: varias pantallas importan este nombre.
export async function getDefinicionPlantilla(id, version) {
  return obtenerDefinicionPlantilla(id, version);
}
