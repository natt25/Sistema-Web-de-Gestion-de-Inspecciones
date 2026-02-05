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

async function listarLugaresPorArea(idArea) {
  const query = `
    SELECT
      id_lugar,
      id_area,
      desc_lugar
    FROM SSOMA.INS_LUGAR
    WHERE id_area = @idArea;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("idArea", idArea);

  const result = await request.query(query);
  return result.recordset;
}

async function listarNivelesRiesgo() {
  const query = `SELECT * FROM SSOMA.INS_CAT_NIVEL_RIESGO;`;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

async function listarPlantillas() {
  const query = `
    SELECT
      id_plantilla_inspec,
      codigo_formato,
      nombre_formato,
      estado,
      version_actual
    FROM SSOMA.INS_PLANTILLA_INSPECCION
    WHERE estado = 1
    ORDER BY nombre_formato;
  `;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

module.exports = { 
  listarClientes, 
  listarAreas, 
  listarServicios, 
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas
};
