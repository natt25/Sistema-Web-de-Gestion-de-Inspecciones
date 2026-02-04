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

module.exports = { listarClientes, listarAreas, listarServicios };

