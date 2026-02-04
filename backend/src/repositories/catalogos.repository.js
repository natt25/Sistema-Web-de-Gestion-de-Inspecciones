const { getPool } = require("../config/database");

async function listarClientes() {
  const query = `SELECT * FROM SSOMA.V_CLIENTE;`;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

async function listarAreas() {
  const query = `SELECT * FROM SSOMA.INS_AREA;`;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

async function listarServicios() {
  const query = `SELECT * FROM SSOMA.V_SERVICIO;`;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}


module.exports = { listarClientes, listarAreas, listarServicios };
