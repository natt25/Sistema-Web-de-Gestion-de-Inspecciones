import repo from "../repositories/catalogos.repository.js";
async function listarClientes() {
  return repo.listarClientes();
}

async function listarAreas() {
  return repo.listarAreas();
}

async function listarServicios() {
  return repo.listarServicios();
}

async function listarLugares(idArea) {
  return repo.listarLugares(idArea);
}

async function listarLugaresPorArea(idArea) {
  return repo.listarLugaresPorArea(idArea);
}

async function listarNivelesRiesgo() {
  return repo.listarNivelesRiesgo();
}

async function listarPlantillas() {
  return repo.listarPlantillas();
}

async function listarEstadosObservacion() {
  return repo.listarEstadosObservacion();
}

async function buscarClientes(q) {
  return repo.buscarClientes(q);
}
async function buscarServicios(q) {
  return repo.buscarServicios(q);
}
async function buscarAreas(q) {
  return repo.buscarAreas(q);
}
async function buscarLugares(q, idArea) {
  return repo.buscarLugares(q, idArea);
}
async function buscarEmpleados(q) {
  return repo.buscarEmpleados(q);
}
async function crearArea(desc_area) {
  return repo.crearArea(desc_area);
}
async function crearLugar(id_area, desc_lugar) {
  return repo.crearLugar(id_area, desc_lugar);
}

export default {
  listarClientes,
  listarAreas,
  listarServicios,
  listarLugares,
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas,
  listarEstadosObservacion,
  buscarClientes,
  buscarServicios,
  buscarAreas,
  buscarLugares,
  buscarEmpleados,
  crearArea,
  crearLugar
};
