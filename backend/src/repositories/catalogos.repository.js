import { sql, getPool } from "../config/database.js";

function normalizeFirmaRuta(raw) {
  const path = String(raw || "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  return `/storage/firmas/${path}`;
}
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

async function buscarAreas(q, id_empresa) {
  const pool = await getPool();
  const request = pool.request();
  request.input("q", sql.VarChar, `%${q}%`);
  request.input("id_empresa", sql.NVarChar(20), String(id_empresa || "").trim());

  const result = await request.query(`
    SELECT TOP (20) *
    FROM SSOMA.INS_AREA
    WHERE id_empresa = @id_empresa
      AND desc_area LIKE @q
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

async function crearArea({ desc_area, id_empresa }) {
  const pool = await getPool();
  const request = pool.request();
  const clean = String(desc_area || "").trim();
  const empresa = String(id_empresa || "").trim();

  request.input("desc_area", sql.VarChar, clean);
  request.input("id_empresa", sql.NVarChar(20), empresa);

  const result = await request.query(`
    DECLARE @desc_clean NVARCHAR(300) = LTRIM(RTRIM(@desc_area));
    DECLARE @empresa_clean NVARCHAR(20) = LTRIM(RTRIM(@id_empresa));

    IF EXISTS (
      SELECT 1
      FROM SSOMA.INS_AREA
      WHERE id_empresa = @empresa_clean
        AND UPPER(LTRIM(RTRIM(desc_area))) = UPPER(@desc_clean)
    )
    BEGIN
      SELECT TOP 1 *
      FROM SSOMA.INS_AREA
      WHERE id_empresa = @empresa_clean
        AND UPPER(LTRIM(RTRIM(desc_area))) = UPPER(@desc_clean)
      ORDER BY id_area;
      RETURN;
    END

    INSERT INTO SSOMA.INS_AREA (desc_area, id_empresa)
    OUTPUT INSERTED.*
    VALUES (@desc_clean, @empresa_clean);
  `);

  return result.recordset?.[0];
}

async function crearLugar(id_area, desc_lugar) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id_area", sql.Int, id_area);
  const clean = String(desc_lugar || "").trim();
  request.input("desc_lugar", sql.VarChar, clean);

  const result = await request.query(`
    DECLARE @desc_clean NVARCHAR(300) = LTRIM(RTRIM(@desc_lugar));

    IF EXISTS (
      SELECT 1
      FROM SSOMA.INS_LUGAR
      WHERE id_area = @id_area
        AND UPPER(LTRIM(RTRIM(desc_lugar))) = UPPER(@desc_clean)
    )
    BEGIN
      SELECT TOP 1 *
      FROM SSOMA.INS_LUGAR
      WHERE id_area = @id_area
        AND UPPER(LTRIM(RTRIM(desc_lugar))) = UPPER(@desc_clean)
      ORDER BY id_lugar;
      RETURN;
    END

    INSERT INTO SSOMA.INS_LUGAR (id_area, desc_lugar)
    OUTPUT INSERTED.*
    VALUES (@id_area, @desc_clean);
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

async function getCargoCatalogConfig() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'SSOMA'
      AND (
        TABLE_NAME LIKE '%CARGO%'
        OR COLUMN_NAME IN ('id_cargo', 'nombre_cargo', 'desc_cargo', 'nombre', 'descripcion')
      );
  `);

  const grouped = new Map();
  for (const row of result.recordset || []) {
    const table = String(row.TABLE_NAME || "").trim();
    const column = String(row.COLUMN_NAME || "").trim().toLowerCase();
    if (!table) continue;
    if (!grouped.has(table)) grouped.set(table, new Set());
    grouped.get(table).add(column);
  }

  const preferred = ["INS_CAT_CARGO", "CAT_CARGO", "MAE_CARGO", "EMP_CARGO"];
  const tables = [
    ...preferred.filter((name) => grouped.has(name)),
    ...Array.from(grouped.keys()).filter((name) => !preferred.includes(name) && name !== "V_EMPLEADO"),
  ];

  for (const table of tables) {
    const cols = grouped.get(table);
    if (!cols?.has("id_cargo")) continue;
    const labelCol =
      cols.has("nombre_cargo") ? "nombre_cargo" :
      cols.has("desc_cargo") ? "desc_cargo" :
      cols.has("nombre") ? "nombre" :
      cols.has("descripcion") ? "descripcion" :
      null;

    if (labelCol) return { table, labelCol };
  }

  return null;
}

async function resolveCargoNombre(pool, idCargo) {
  const cleanIdCargo = String(idCargo ?? "").trim();
  if (!cleanIdCargo) return "";

  const config = await getCargoCatalogConfig();
  if (!config) return cleanIdCargo;

  const request = pool.request();
  request.input("id_cargo", sql.NVarChar(50), cleanIdCargo);
  const result = await request.query(`
    SELECT TOP 1 CAST(${config.labelCol} AS NVARCHAR(150)) AS cargo
    FROM SSOMA.${config.table}
    WHERE LTRIM(RTRIM(CAST(id_cargo AS NVARCHAR(50)))) = LTRIM(RTRIM(@id_cargo));
  `);

  return String(result.recordset?.[0]?.cargo || "").trim() || cleanIdCargo;
}

async function getFirmaRutaByDni(pool, dni) {
  const cleanDni = String(dni ?? "").trim();
  if (!cleanDni) return "";

  const colsUsuario = await getColumns("SSOMA", "INS_USUARIO");
  const firmaCol =
    colsUsuario.has("firma_path") ? "firma_path" :
    colsUsuario.has("firma_ruta") ? "firma_ruta" :
    colsUsuario.has("ruta_firma") ? "ruta_firma" :
    null;

  if (!firmaCol) return "";

  const request = pool.request();
  request.input("dni_usuario", sql.NVarChar(20), cleanDni);
  const result = await request.query(`
    SELECT TOP 1 CAST(${firmaCol} AS NVARCHAR(300)) AS firma_ruta
    FROM SSOMA.INS_USUARIO
    WHERE LTRIM(RTRIM(CAST(dni AS NVARCHAR(20)))) = LTRIM(RTRIM(@dni_usuario));
  `);

  return normalizeFirmaRuta(result.recordset?.[0]?.firma_ruta);
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

  const cApellidoPaterno =
    cols.has("apellido_paterno") ? "apellido_paterno" :
    cols.has("ape_paterno") ? "ape_paterno" :
    cols.has("ape_pat") ? "ape_pat" :
    cols.has("apepat") ? "apepat" : null;

  const cApellidoMaterno =
    cols.has("apellido_materno") ? "apellido_materno" :
    cols.has("ape_materno") ? "ape_materno" :
    cols.has("ape_mat") ? "ape_mat" :
    cols.has("apemat") ? "apemat" : null;

  const cApellidos =
    cols.has("apellidos") ? "apellidos" :
    cols.has("apellido") ? "apellido" : null;

  // si tu vista ya trae cargo en una columna directa
  const cCargo =
    cols.has("cargo") ? "cargo" :
    cols.has("desc_cargo") ? "desc_cargo" :
    cols.has("nombre_cargo") ? "nombre_cargo" : null;
  const cIdCargo = cols.has("id_cargo") ? "id_cargo" : null;

  if (!cDni) {
    // sin dni no tiene sentido buscar
    return [];
  }

  // armamos select con alias estables
  const selectParts = [
    `${cDni} AS dni`,
    cNombres ? `${cNombres} AS nombres` : `CAST('' AS NVARCHAR(150)) AS nombres`,
    cApellidoPaterno ? `${cApellidoPaterno} AS apellido_paterno` : `CAST('' AS NVARCHAR(150)) AS apellido_paterno`,
    cApellidoMaterno ? `${cApellidoMaterno} AS apellido_materno` : `CAST('' AS NVARCHAR(150)) AS apellido_materno`,
    cApellidos ? `${cApellidos} AS apellidos` : `CAST('' AS NVARCHAR(150)) AS apellidos`,
    cCargo ? `${cCargo} AS cargo` : `CAST('' AS NVARCHAR(150)) AS cargo`,
    cIdCargo ? `CAST(${cIdCargo} AS NVARCHAR(50)) AS id_cargo` : `CAST('' AS NVARCHAR(50)) AS id_cargo`,
  ].join(", ");

  // filtro
  const like = `%${(q || "").trim()}%`;
  const whereParts = [];

  // si q viene vacío, devolvemos TOP por defecto
  if ((q || "").trim()) {
    whereParts.push(`CAST(${cDni} AS VARCHAR(20)) LIKE @q`);
    if (cNombres) whereParts.push(`${cNombres} LIKE @q`);
    if (cApellidoPaterno) whereParts.push(`${cApellidoPaterno} LIKE @q`);
    if (cApellidoMaterno) whereParts.push(`${cApellidoMaterno} LIKE @q`);
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

  return Promise.all((result.recordset || []).map(async (r) => {
    const nombres = String(r.nombres || "").trim();
    const apellido_paterno = String(r.apellido_paterno || "").trim();
    const apellido_materno = String(r.apellido_materno || "").trim();
    const apellidos = String(r.apellidos || "").trim();
    const cargoRaw = String(r.cargo || "").trim();
    const cargo = cargoRaw || await resolveCargoNombre(pool, r.id_cargo);
    const firma_ruta = await getFirmaRutaByDni(pool, r.dni);
    const nombreCompleto =
      [nombres, apellido_paterno, apellido_materno].filter(Boolean).join(" ").trim() ||
      [nombres, apellidos].filter(Boolean).join(" ").trim() ||
      (r.dni ? String(r.dni) : "");
    return {
      dni: r.dni ? String(r.dni) : "",
      nombres,
      apellido_paterno,
      apellido_materno,
      apellidos,
      cargo,
      firma_ruta,
      nombreCompleto,
    };
  }));
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
