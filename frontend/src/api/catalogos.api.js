import http from "./http.js";

export async function listarClientes() {
  const res = await http.get("/api/catalogos/clientes");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function listarAreas() {
  const res = await http.get("/api/catalogos/areas");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function listarServicios() {
  const res = await http.get("/api/catalogos/servicios");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function listarLugares(id_area) {
  const config = {};
  if (id_area) {
    config.params = { id_area };
  }
  const res = await http.get("/api/catalogos/lugares", config);
  return Array.isArray(res?.data) ? res.data : [];
}

export async function listarCatalogosInspeccion() {
  const [clientes, servicios, areas, lugares] = await Promise.all([
    listarClientes(),
    listarServicios(),
    listarAreas(),
    listarLugares()
      .catch((e) => {
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
