import { sql, getPool } from "../config/database.js";

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

  const colApellidos =
    cols.has("apellidos") ? "apellidos" :
    cols.has("apellido") ? "apellido" :
    cols.has("apellido_paterno") ? "apellido_paterno" : null;

  const colCargo =
    cols.has("cargo") ? "cargo" :
    cols.has("desc_cargo") ? "desc_cargo" :
    cols.has("nombre_cargo") ? "nombre_cargo" : null;

  const colFirma =
    cols.has("firma_ruta") ? "firma_ruta" :
    cols.has("firma_path") ? "firma_path" :
    cols.has("ruta_firma") ? "ruta_firma" : null;

  const selectSql = [
    `${colDni} AS dni`,
    colNombres ? `${colNombres} AS nombres` : `CAST('' AS NVARCHAR(150)) AS nombres`,
    colApellidos ? `${colApellidos} AS apellidos` : `CAST('' AS NVARCHAR(150)) AS apellidos`,
    colCargo ? `${colCargo} AS cargo` : `CAST('' AS NVARCHAR(150)) AS cargo`,
    colFirma ? `${colFirma} AS firma_ruta` : `CAST('' AS NVARCHAR(250)) AS firma_ruta`,
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

  const nombreCompleto = `${row.apellidos || ""} ${row.nombres || ""}`.trim() || row.dni || "";
  return {
    dni: row.dni || String(dni),
    nombres: row.nombres || "",
    apellidos: row.apellidos || "",
    nombreCompleto,
    cargo: row.cargo || "",
    firma_ruta: row.firma_ruta || "",
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
