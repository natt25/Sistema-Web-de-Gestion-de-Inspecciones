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

async function buscarEmpleados(q) {
  const pool = await getPool();
  const request = pool.request();
  request.input("q", sql.VarChar, `%${q}%`);

  // 1) Detecta columnas disponibles en la vista
  const colsRes = await request.query(`
    SELECT c.name AS col
    FROM sys.columns c
    JOIN sys.objects o ON o.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = o.schema_id
    WHERE s.name = 'SSOMA' AND o.name = 'V_EMPLEADO'
    ORDER BY c.column_id;
  `);
  const cols = new Set((colsRes.recordset || []).map(r => String(r.col).toLowerCase()));

  // helpers para elegir la 1ra que exista
  const pick = (cands) => cands.find(x => cols.has(x.toLowerCase())) || null;

  const colDni = pick(["dni", "num_documento", "documento", "nro_documento"]);
  const colNombres = pick(["nombres", "nombre", "nom_empleado", "empleado_nombres", "nombres_empleado"]);
  const colApellidos = pick(["apellidos", "apellido", "ape_empleado", "empleado_apellidos", "apellidos_empleado"]);
  const colCargo = pick(["cargo", "desc_cargo", "nombre_cargo", "cargo_desc"]);

  // 2) arma SELECT y WHERE solo con columnas existentes
  //    Si no hay nombres/apellidos, igual busca por dni y/o por un campo "empleado" si existe.
  const colEmpleado = pick(["empleado", "nombre_completo", "nom_completo", "full_name"]);

  const selectDni = colDni ? `CAST(${colDni} AS VARCHAR(20)) AS dni` : `'' AS dni`;
  const selectNombres = colNombres ? `${colNombres} AS nombres` : `'' AS nombres`;
  const selectApellidos = colApellidos ? `${colApellidos} AS apellidos` : `'' AS apellidos`;
  const selectCargo = colCargo ? `${colCargo} AS cargo` : `'' AS cargo`;
  const selectEmpleado = colEmpleado ? `${colEmpleado} AS empleado` : `'' AS empleado`;

  const whereParts = [];
  if (colDni) whereParts.push(`CAST(${colDni} AS VARCHAR(20)) LIKE @q`);
  if (colNombres) whereParts.push(`${colNombres} LIKE @q`);
  if (colApellidos) whereParts.push(`${colApellidos} LIKE @q`);
  if (colEmpleado) whereParts.push(`${colEmpleado} LIKE @q`);

  // si no hay ninguna columna para filtrar, devuelve vacío (evita romper)
  if (whereParts.length === 0) return [];

  const orderBy = colApellidos && colNombres
    ? `${colApellidos}, ${colNombres}`
    : (colEmpleado ? colEmpleado : (colDni ? colDni : "1"));

  const result = await request.query(`
    SELECT TOP (20)
      ${selectDni},
      ${selectNombres},
      ${selectApellidos},
      ${selectCargo},
      ${selectEmpleado}
    FROM SSOMA.V_EMPLEADO
    WHERE ${whereParts.join(" OR ")}
    ORDER BY ${orderBy};
  `);

  // Normaliza: si no hay apellidos/nombres pero sí "empleado", intenta partirlo
  return (result.recordset || []).map(r => {
    const dni = r.dni ?? "";
    let nombres = r.nombres ?? "";
    let apellidos = r.apellidos ?? "";
    const cargo = r.cargo ?? "";

    if ((!nombres || !apellidos) && r.empleado) {
      // simple: si viene "APELLIDOS, NOMBRES" o "NOMBRES APELLIDOS"
      const txt = String(r.empleado).trim();
      if (txt.includes(",")) {
        const [a, n] = txt.split(",").map(x => x.trim());
        apellidos = apellidos || a;
        nombres = nombres || n;
      } else {
        // deja todo en apellidos si no podemos separar bien
        apellidos = apellidos || txt;
      }
    }

    return { dni, nombres, apellidos, cargo };
  });
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
