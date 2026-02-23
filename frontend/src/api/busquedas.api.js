import http from "./http";

// q = texto que escribe el usuario
export const buscarEmpleados = async (q) =>
  http.get("/api/catalogos/empleados/buscar", { params: { q } }).then(r => r.data);

export const buscarCargos = async (q) =>
  http.get("/api/catalogos/cargos/buscar", { params: { q } }).then(r => r.data);

export const buscarClientes = async (q) =>
  http.get("/api/catalogos/clientes/buscar", { params: { q } }).then(r => r.data);

export const buscarServicios = async (q) =>
  http.get("/api/catalogos/servicios/buscar", { params: { q } }).then(r => r.data);

export const buscarAreas = async (q) =>
  http.get("/api/catalogos/areas/buscar", { params: { q } }).then(r => r.data);

export const buscarLugares = async ({ q, id_area }) =>
  http.get("/api/catalogos/lugares/buscar", { params: { q, id_area } }).then(r => r.data);

// creación (solo para area/lugar si no existe)
export const crearArea = async (desc_area) =>
  http.post("/api/catalogos/areas", { desc_area }).then(r => r.data);

export const crearLugar = async ({ id_area, desc_lugar }) =>
  http.post("/api/catalogos/lugares", { id_area, desc_lugar }).then(r => r.data);