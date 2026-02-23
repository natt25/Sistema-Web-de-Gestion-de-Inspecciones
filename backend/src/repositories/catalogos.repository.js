import { sql, getPool } from "../config/database.js";
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

async function listarLugares(idArea) {
  const baseQuery = `
    SELECT
      id_lugar,
      id_area,
      desc_lugar
    FROM SSOMA.INS_LUGAR
  `;

  const pool = await getPool();
  const request = pool.request();

  if (idArea && !Number.isNaN(Number(idArea))) {
    request.input("idArea", sql.Int, Number(idArea));
    const result = await request.query(`${baseQuery} WHERE id_area = @idArea ORDER BY desc_lugar;`);
    return result.recordset;
  }

  const result = await request.query(`${baseQuery} ORDER BY id_area, desc_lugar;`);
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
  request.input("idArea", sql.Int, Number(idArea));

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
    ORDER BY nombre_formato;
  `;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

async function listarEstadosObservacion() {
  const query = `SELECT * FROM SSOMA.INS_CAT_ESTADO_OBSERVACION ORDER BY id_estado_observacion;`;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

export default { 
  listarClientes, 
  listarAreas, 
  listarServicios, 
  listarLugares,
  listarLugaresPorArea,
  listarNivelesRiesgo,
  listarPlantillas,
  listarEstadosObservacion
};
