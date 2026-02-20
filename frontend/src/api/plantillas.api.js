import http from "./http";

export async function listarPlantillas() {
  const { data } = await http.get("/api/plantillas");
  return data;
}

export async function getDefinicionPlantilla(id) {
  const { data } = await http.get(`/api/plantillas/${id}/definicion`);
  return data; // { id_plantilla_inspec, version, definicion }
}