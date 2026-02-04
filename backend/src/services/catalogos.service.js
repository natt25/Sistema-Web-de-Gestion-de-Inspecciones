const repo = require("../repositories/catalogos.repository");

async function listarClientes() {
  return repo.listarClientes();
}

module.exports = { listarClientes };
