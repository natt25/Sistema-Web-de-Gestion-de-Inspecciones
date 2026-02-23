import http from "./http.js";

export async function listarPlantillas() {
  const { data } = await http.get("/api/plantillas");
  return data;
}

export async function obtenerDefinicionPlantilla(id, version, options = {}) {
  const qs = version ? `?version=${encodeURIComponent(version)}` : "";
  const { data } = await http.get(`/api/plantillas/${id}/definicion${qs}`, {
    signal: options.signal,
  });
  return data;
}

// alias compat
export async function getDefinicionPlantilla(id, version) {
  return obtenerDefinicionPlantilla(id, version);
}