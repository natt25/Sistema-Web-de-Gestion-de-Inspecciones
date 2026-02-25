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

async function buscarClientes(q) {
  const pool = await getPool();
  const request = pool.request();
  request.input("q", sql.VarChar, `%${q}%`);
  const result = await request.query(`
    SELECT TOP (20) *
    FROM SSOMA.V_CLIENTE
    WHERE raz_social LIKE @q
    ORDER BY raz_social;
  `);
  return result.recordset;
}

async function buscarServicios(q) {
  const pool = await getPool();
  const request = pool.request();
  request.input("q", sql.VarChar, `%${q}%`);
  const result = await request.query(`
    SELECT TOP (20) *
    FROM SSOMA.V_SERVICIO
    WHERE nombre_servicio LIKE @q
    ORDER BY nombre_servicio;
  `);
  return result.recordset;
}

async function buscarAreas(q) {
  const pool = await getPool();
  const request = pool.request();
  request.input("q", sql.VarChar, `%${q}%`);
  const result = await request.query(`
    SELECT TOP (20) *
    FROM SSOMA.INS_AREA
    WHERE desc_area LIKE @q
    ORDER BY desc_area;
  `);
  return result.recordset;
}

async function buscarLugares(q, idArea) {
  const pool = await getPool();
  const request = pool.request();
  request.input("q", sql.VarChar, `%${q}%`);

  let where = `WHERE desc_lugar LIKE @q`;
  if (idArea && !Number.isNaN(Number(idArea))) {
    request.input("idArea", sql.Int, Number(idArea));
    where += ` AND id_area = @idArea`;
  }

  const result = await request.query(`
    SELECT TOP (20) id_lugar, id_area, desc_lugar
    FROM SSOMA.INS_LUGAR
    ${where}
    ORDER BY desc_lugar;
  `);
  return result.recordset;
}

async function crearArea(desc_area) {
  const pool = await getPool();
  const request = pool.request();
  request.input("desc_area", sql.VarChar, desc_area);

  const result = await request.query(`
    INSERT INTO SSOMA.INS_AREA (desc_area)
    OUTPUT INSERTED.*
    VALUES (@desc_area);
  `);
  return result.recordset?.[0];
}

async function crearLugar(id_area, desc_lugar) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id_area", sql.Int, id_area);
  request.input("desc_lugar", sql.VarChar, desc_lugar);

  const result = await request.query(`
    INSERT INTO SSOMA.INS_LUGAR (id_area, desc_lugar)
    OUTPUT INSERTED.*
    VALUES (@id_area, @desc_lugar);
  `);
  return result.recordset?.[0];
}

async function getColumns(schema, tableOrView) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("schema", sql.NVarChar, schema)
      .input("name", sql.NVarChar, tableOrView)
      .query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @name
      `);
    return new Set((r.recordset || []).map((x) => String(x.COLUMN_NAME || "").toLowerCase()));
  } catch {
    return new Set();
  }
}

async function tableExists(schema, name) {
  const pool = await getPool();
  const r = await pool.request()
    .input("schema", sql.NVarChar, schema)
    .input("name", sql.NVarChar, name)
    .query(`
      SELECT 1 AS ok
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE s.name = @schema AND t.name = @name;
    `);
  return (r.recordset?.length || 0) > 0;
}

async function getParticipantesTable() {
  // orden de preferencia: la real que tienes en DB
  if (await tableExists("SSOMA", "INS_PARTICIPANTE_CARGO")) return "SSOMA.INS_PARTICIPANTE_CARGO";
  if (await tableExists("SSOMA", "INS_INSPECCION_PARTICIPANTE")) return "SSOMA.INS_INSPECCION_PARTICIPANTE";
  return null;
}

async function buscarEmpleados(q) {
  const pool = await getPool();
  const cols = await getColumns("SSOMA", "V_EMPLEADO");

  // candidatos de nombres de columnas según vistas típicas
  const cDni =
    cols.has("dni") ? "dni" :
    cols.has("num_doc") ? "num_doc" :
    cols.has("documento") ? "documento" : null;

  const cNombres =
    cols.has("nombres") ? "nombres" :
    cols.has("nombre") ? "nombre" :
    cols.has("nombres_empleado") ? "nombres_empleado" :
    cols.has("nom") ? "nom" : null;

  const cApellidos =
    cols.has("apellidos") ? "apellidos" :
    cols.has("apellido") ? "apellido" :
    cols.has("apellido_paterno") ? "apellido_paterno" :
    cols.has("ape_paterno") ? "ape_paterno" :
    cols.has("ape_pat") ? "ape_pat" :
    cols.has("apepat") ? "apepat" : null;

  // si tu vista ya trae cargo en una columna directa
  const cCargo =
    cols.has("cargo") ? "cargo" :
    cols.has("desc_cargo") ? "desc_cargo" :
    cols.has("nombre_cargo") ? "nombre_cargo" : null;

  if (!cDni) {
    // sin dni no tiene sentido buscar
    return [];
  }

  // armamos select con alias estables
  const selectParts = [
    `${cDni} AS dni`,
    cNombres ? `${cNombres} AS nombres` : `CAST('' AS NVARCHAR(150)) AS nombres`,
    cApellidos ? `${cApellidos} AS apellidos` : `CAST('' AS NVARCHAR(150)) AS apellidos`,
    cCargo ? `${cCargo} AS cargo` : `CAST('' AS NVARCHAR(150)) AS cargo`,
  ].join(", ");

  // filtro
  const like = `%${(q || "").trim()}%`;
  const whereParts = [];

  // si q viene vacío, devolvemos TOP por defecto
  if ((q || "").trim()) {
    whereParts.push(`CAST(${cDni} AS VARCHAR(20)) LIKE @q`);
    if (cNombres) whereParts.push(`${cNombres} LIKE @q`);
    if (cApellidos) whereParts.push(`${cApellidos} LIKE @q`);
  }

  const whereSql = whereParts.length ? `WHERE (${whereParts.join(" OR ")})` : "";
  const orderSql = cApellidos ? `ORDER BY ${cApellidos}, ${cNombres || cDni}` : `ORDER BY ${cNombres || cDni}`;

  const request = pool.request();
  request.input("q", sql.NVarChar, like);

  const result = await request.query(`
    SELECT TOP (20) ${selectParts}
    FROM SSOMA.V_EMPLEADO
    ${whereSql}
    ${orderSql};
  `);

  return (result.recordset || []).map((r) => {
    const nombres = r.nombres || "";
    const apellidos = r.apellidos || "";
    const nombreCompleto = `${apellidos} ${nombres}`.trim() || (r.dni ? String(r.dni) : "");
    return {
      dni: r.dni ? String(r.dni) : "",
      nombres,
      apellidos,
      cargo: r.cargo || "",
      nombreCompleto,
    };
  });
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
