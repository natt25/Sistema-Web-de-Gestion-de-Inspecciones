import { sql, getPool } from "../config/database.js";

function normalizeFirmaRuta(raw) {
  const path = String(raw || "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  return `/storage/firmas/${path}`;
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

async function findByDni(dni) {
  const query = `
    SELECT
      u.id_usuario,
      u.dni,
      u.id_estado_usuario,
      u.password_hash,
      u.debe_cambiar_password,
      u.failed_attempts,
      u.locked_until,
      u.password_expires_at,
      r.nombre_rol AS rol,
      eu.nombre_estado AS estado
    FROM SSOMA.INS_USUARIO u
    JOIN SSOMA.INS_CAT_ROL r ON r.id_rol = u.id_rol
    JOIN SSOMA.INS_CAT_ESTADO_USUARIO eu ON eu.id_estado_usuario = u.id_estado_usuario
    WHERE u.dni = @dni;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("dni", sql.NVarChar(15), dni);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function onLoginSuccess(id_usuario) {
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET failed_attempts = 0,
        locked_until = NULL,
        last_login_at = SYSDATETIME()
    WHERE id_usuario = @id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  await req.query(query);
}

async function onLoginFail(id_usuario, { maxAttempts = 5, lockMinutes = 10 } = {}) {
  // incrementa y si llega al máximo, bloquea
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE
          WHEN failed_attempts + 1 >= @maxAttempts THEN DATEADD(MINUTE, @lockMinutes, SYSDATETIME())
          ELSE locked_until
        END
    WHERE id_usuario = @id_usuario;

    SELECT failed_attempts, locked_until
    FROM SSOMA.INS_USUARIO
    WHERE id_usuario = @id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  req.input("maxAttempts", sql.Int, maxAttempts);
  req.input("lockMinutes", sql.Int, lockMinutes);

  const result = await req.query(query);
  return result.recordset[0] || null;
}

async function getEmpleadoProfileByDni(dni) {
  if (!dni) return null;

  const cols = await getColumns("SSOMA", "V_EMPLEADO");
  if (!cols.size) return null;

  const colDni =
    cols.has("dni") ? "dni" :
    cols.has("num_doc") ? "num_doc" :
    cols.has("documento") ? "documento" : null;

  if (!colDni) return null;

  const colNombres =
    cols.has("nombres") ? "nombres" :
    cols.has("nombre") ? "nombre" :
    cols.has("nombres_empleado") ? "nombres_empleado" : null;

  const colApellidoPaterno =
    cols.has("apellido_paterno") ? "apellido_paterno" :
    cols.has("ape_paterno") ? "ape_paterno" :
    cols.has("ape_pat") ? "ape_pat" :
    cols.has("apepat") ? "apepat" : null;

  const colApellidoMaterno =
    cols.has("apellido_materno") ? "apellido_materno" :
    cols.has("ape_materno") ? "ape_materno" :
    cols.has("ape_mat") ? "ape_mat" :
    cols.has("apemat") ? "apemat" : null;

  const colApellidos =
    cols.has("apellidos") ? "apellidos" :
    cols.has("apellido") ? "apellido" :
    cols.has("apellido_paterno") ? "apellido_paterno" : null;

  const colCargo =
    cols.has("cargo") ? "cargo" :
    cols.has("desc_cargo") ? "desc_cargo" :
    cols.has("nombre_cargo") ? "nombre_cargo" : null;
  const colIdCargo = cols.has("id_cargo") ? "id_cargo" : null;

  const selectSql = [
    `${colDni} AS dni`,
    colNombres ? `${colNombres} AS nombres` : `CAST('' AS NVARCHAR(150)) AS nombres`,
    colApellidoPaterno ? `${colApellidoPaterno} AS apellido_paterno` : `CAST('' AS NVARCHAR(150)) AS apellido_paterno`,
    colApellidoMaterno ? `${colApellidoMaterno} AS apellido_materno` : `CAST('' AS NVARCHAR(150)) AS apellido_materno`,
    colApellidos ? `${colApellidos} AS apellidos` : `CAST('' AS NVARCHAR(150)) AS apellidos`,
    colCargo ? `${colCargo} AS cargo` : `CAST('' AS NVARCHAR(150)) AS cargo`,
    colIdCargo ? `CAST(${colIdCargo} AS NVARCHAR(50)) AS id_cargo` : `CAST('' AS NVARCHAR(50)) AS id_cargo`,
  ].join(", ");

  const pool = await getPool();
  const request = pool.request();
  request.input("dni", sql.NVarChar(20), String(dni));

  const result = await request.query(`
    SELECT TOP (1) ${selectSql}
    FROM SSOMA.V_EMPLEADO
    WHERE CAST(${colDni} AS NVARCHAR(20)) = @dni
  `);

  const row = result.recordset?.[0];
  if (!row) return null;

  const nombres = String(row.nombres || "").trim();
  const apellidoPaterno = String(row.apellido_paterno || "").trim();
  const apellidoMaterno = String(row.apellido_materno || "").trim();
  const apellidos = String(row.apellidos || "").trim();
  const cargoRaw = String(row.cargo || "").trim();
  const cargo = cargoRaw || await resolveCargoNombre(pool, row.id_cargo);
  const firma_ruta = await getFirmaRutaByDni(pool, row.dni || dni);
  const nombreCompleto =
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim() ||
    [nombres, apellidos].filter(Boolean).join(" ").trim() ||
    row.dni ||
    "";
  return {
    dni: row.dni || String(dni),
    nombres,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    apellidos,
    nombreCompleto,
    cargo,
    firma_ruta,
  };
}

async function updateFirma({ id_usuario, dni, firma_path, firma_mime, firma_size }) {
  try {
    // Usa el identificador que tengas disponible
    // Si tienes id_usuario úsalo, si no usa dni
    const where = id_usuario ? "id_usuario = @id_usuario" : "dni = @dni";

    const q = `
      UPDATE INS_USUARIOS
      SET firma_path = @firma_path,
          firma_mime = @firma_mime,
          firma_size = @firma_size,
          firma_updated_at = GETDATE()
      WHERE ${where}
    `;

    const params = {
      id_usuario,
      dni,
      firma_path,
      firma_mime,
      firma_size
    };

    await db.query(q, params);

    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export default { findByDni, onLoginSuccess, onLoginFail, getEmpleadoProfileByDni, updateFirma };
