const repo = require("../repositories/catalogos.repository");

async function listarClientes() {
  return repo.listarClientes();
}

async function listarAreas() {
  return repo.listarAreas();
}

async function listarServicios() {
  return repo.listarServicios();
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

module.exports = {
  listarClientes,
  listarAreas,
  listarServicios,
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas
};

