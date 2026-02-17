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

export default {
  listarClientes,
  listarAreas,
  listarServicios,
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas,
  listarEstadosObservacion
};