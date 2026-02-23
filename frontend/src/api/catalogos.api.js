import http from "./http.js";

export async function listarCatalogosInspeccion() {
  const [clientes, servicios, areas, lugares] = await Promise.all([
    http.get("/api/catalogos/clientes").then((r) => r.data),
    http.get("/api/catalogos/servicios").then((r) => r.data),
    http.get("/api/catalogos/areas").then((r) => r.data),
    http
      .get("/api/catalogos/lugares")
      .then((r) => r.data)
      .catch((e) => {
        // si no existe, no rompas todo
        if (e?.response?.status === 404) return [];
        throw e;
      }),
  ]);

  return {
    clientes: Array.isArray(clientes) ? clientes : [],
    servicios: Array.isArray(servicios) ? servicios : [],
    areas: Array.isArray(areas) ? areas : [],
    lugares: Array.isArray(lugares) ? lugares : [],
  };
}