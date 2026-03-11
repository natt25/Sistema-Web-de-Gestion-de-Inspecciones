import { sql, getPool } from "../config/database.js";

function normalizeFirmaRuta(raw) {
  const path = String(raw || "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  return `/storage/firmas/${path}`;
}

function normalizeDni(dni) {
  return String(dni ?? "").trim();
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

async function list() {
  const query = `
    SELECT
      u.id_usuario, u.dni,
      r.nombre_rol AS rol,
      eu.nombre_estado AS estado,
      u.debe_cambiar_password,
      u.last_login_at,
      u.locked_until,
      u.password_expires_at
    FROM SSOMA.INS_USUARIO u
    JOIN SSOMA.INS_CAT_ROL r ON r.id_rol = u.id_rol
    JOIN SSOMA.INS_CAT_ESTADO_USUARIO eu ON eu.id_estado_usuario = u.id_estado_usuario
    ORDER BY u.id_usuario DESC;
  `;
  const pool = await getPool();
  const result = await pool.request().query(query);
  return result.recordset;
}

async function create({ dni, id_rol, id_estado_usuario, password_hash, debe_cambiar_password, password_expires_at }) {
  const query = `
    INSERT INTO SSOMA.INS_USUARIO
      (dni, id_rol, id_estado_usuario, password_hash, debe_cambiar_password, password_updated_at, password_expires_at)
    VALUES
      (@dni, @id_rol, @id_estado_usuario, @password_hash, @debe_cambiar_password, SYSDATETIME(), @password_expires_at);

    SELECT SCOPE_IDENTITY() AS id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("dni", sql.NVarChar(15), dni);
  req.input("id_rol", sql.Int, id_rol);
  req.input("id_estado_usuario", sql.Int, id_estado_usuario);
  req.input("password_hash", sql.NVarChar(255), password_hash);
  req.input("debe_cambiar_password", sql.Bit, debe_cambiar_password ? 1 : 0);
  req.input("password_expires_at", sql.DateTime2, password_expires_at ?? null);

  const result = await req.query(query);
  return Number(result.recordset[0]?.id_usuario);
}

async function update(id_usuario, { id_rol, id_estado_usuario }) {
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET
      id_rol = COALESCE(@id_rol, id_rol),
      id_estado_usuario = COALESCE(@id_estado_usuario, id_estado_usuario)
    WHERE id_usuario = @id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  req.input("id_rol", sql.Int, id_rol ?? null);
  req.input("id_estado_usuario", sql.Int, id_estado_usuario ?? null);
  await req.query(query);
}

async function setEstado(id_usuario, id_estado_usuario) {
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET id_estado_usuario = @id_estado_usuario
    WHERE id_usuario = @id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  req.input("id_estado_usuario", sql.Int, id_estado_usuario);
  await req.query(query);
}

async function resetPassword(id_usuario, { password_hash, debe_cambiar_password, password_expires_at }) {
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET
      password_hash = @password_hash,
      debe_cambiar_password = @debe_cambiar_password,
      password_updated_at = SYSDATETIME(),
      password_expires_at = @password_expires_at,
      failed_attempts = 0,
      locked_until = NULL
    WHERE id_usuario = @id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  req.input("password_hash", sql.NVarChar(255), password_hash);
  req.input("debe_cambiar_password", sql.Bit, debe_cambiar_password ? 1 : 0);
  req.input("password_expires_at", sql.DateTime2, password_expires_at ?? null);
  await req.query(query);
}

async function updateFirma(id_usuario, { firma_path, firma_mime, firma_size }) {
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET
      firma_path = @firma_path,
      firma_mime = @firma_mime,
      firma_size = @firma_size,
      firma_updated_at = SYSDATETIME()
    WHERE id_usuario = @id_usuario;
  `;

  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  req.input("firma_path", sql.NVarChar(300), firma_path ?? null);
  req.input("firma_mime", sql.NVarChar(50), firma_mime ?? null);
  req.input("firma_size", sql.Int, firma_size ?? null);

  await req.query(query);
}

async function getById(id_usuario) {
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  const result = await req.query(`
    SELECT TOP 1
      id_usuario,
      dni,
      firma_path,
      firma_ruta,
      firma_mime,
      firma_size,
      firma_updated_at
    FROM SSOMA.INS_USUARIO
    WHERE id_usuario = @id_usuario;
  `);
  const row = result.recordset[0] || null;
  if (!row) return null;

  const empleados = await buscarEmpleados(String(row.dni || "").trim());
  const empleado = Array.isArray(empleados)
    ? empleados.find((it) => String(it?.dni || "").trim() === String(row.dni || "").trim())
    : null;

  const cargo =
    String(empleado?.cargo || "").trim() ||
    await resolveCargoNombre(pool, empleado?.id_cargo);

  const firmaPathRaw = row.firma_path || row.firma_ruta || empleado?.firma_ruta || "";

  return {
    ...row,
    nombres: empleado?.nombres || "",
    apellido_paterno: empleado?.apellido_paterno || "",
    apellido_materno: empleado?.apellido_materno || "",
    apellidos: empleado?.apellidos || "",
    nombreCompleto: empleado?.nombreCompleto || "",
    cargo,
    firma_path: normalizeFirmaRuta(firmaPathRaw),
    firma_ruta: normalizeFirmaRuta(firmaPathRaw),
  };
}

async function buscar(q) {
  const sqlQuery = `
    SELECT TOP 10 id_usuario, dni, nombres, apellidos
    FROM SSOMA.INS_USUARIO
    WHERE (dni LIKE @q OR nombres LIKE @q OR apellidos LIKE @q)
    ORDER BY apellidos, nombres;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("q", sql.NVarChar(120), `%${q}%`);
  const r = await req.query(sqlQuery);
  return r.recordset;
}

async function buscarEmpleados(q) {
  const pool = await getPool();
  const cols = await getColumns("SSOMA", "V_EMPLEADO");

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

  const cCargo =
    cols.has("cargo") ? "cargo" :
    cols.has("desc_cargo") ? "desc_cargo" :
    cols.has("nombre_cargo") ? "nombre_cargo" : null;
  const cIdCargo = cols.has("id_cargo") ? "id_cargo" : null;

  if (!cDni) return [];

  const selectParts = [
    `${cDni} AS dni`,
    cNombres ? `${cNombres} AS nombres` : `CAST('' AS NVARCHAR(150)) AS nombres`,
    cApellidoPaterno ? `${cApellidoPaterno} AS apellido_paterno` : `CAST('' AS NVARCHAR(150)) AS apellido_paterno`,
    cApellidoMaterno ? `${cApellidoMaterno} AS apellido_materno` : `CAST('' AS NVARCHAR(150)) AS apellido_materno`,
    cApellidos ? `${cApellidos} AS apellidos` : `CAST('' AS NVARCHAR(150)) AS apellidos`,
    cCargo ? `${cCargo} AS cargo` : `CAST('' AS NVARCHAR(150)) AS cargo`,
    cIdCargo ? `CAST(${cIdCargo} AS NVARCHAR(50)) AS id_cargo` : `CAST('' AS NVARCHAR(50)) AS id_cargo`,
  ];

  const like = `%${String(q || "").trim()}%`;
  const whereParts = [];
  if (String(q || "").trim()) {
    whereParts.push(`CAST(${cDni} AS VARCHAR(20)) LIKE @q`);
    if (cNombres) whereParts.push(`${cNombres} LIKE @q`);
    if (cApellidoPaterno) whereParts.push(`${cApellidoPaterno} LIKE @q`);
    if (cApellidoMaterno) whereParts.push(`${cApellidoMaterno} LIKE @q`);
    if (cApellidos) whereParts.push(`${cApellidos} LIKE @q`);
  }

  const whereSql = whereParts.length ? `WHERE (${whereParts.join(" OR ")})` : "";
  const orderSql = cApellidos
    ? `ORDER BY ${cApellidos}, ${cNombres || cDni}`
    : `ORDER BY ${cNombres || cDni}`;

  const request = pool.request();
  request.input("q", sql.NVarChar, like);

  const result = await request.query(`
    SELECT TOP (20) ${selectParts.join(", ")}
    FROM SSOMA.V_EMPLEADO
    ${whereSql}
    ${orderSql};
  `);

  return Promise.all((result.recordset || []).map(async (row) => {
    const nombres = String(row.nombres || "").trim();
    const apellido_paterno = String(row.apellido_paterno || "").trim();
    const apellido_materno = String(row.apellido_materno || "").trim();
    const apellidos = String(row.apellidos || "").trim();
    const cargoRaw = String(row.cargo || "").trim();
    const cargo = cargoRaw || await resolveCargoNombre(pool, row.id_cargo);
    const nombreCompleto =
      [nombres, apellido_paterno, apellido_materno].filter(Boolean).join(" ").trim() ||
      [nombres, apellidos].filter(Boolean).join(" ").trim() ||
      String(row.dni || "").trim();

    return {
      dni: String(row.dni || "").trim(),
      nombres,
      apellido_paterno,
      apellido_materno,
      apellidos,
      id_cargo: String(row.id_cargo || "").trim(),
      cargo,
      nombreCompleto,
    };
  }));
}

async function findByDni(dni) {
  const query = `
    SELECT TOP 1 id_usuario, dni, id_rol, id_estado_usuario, debe_cambiar_password
    FROM SSOMA.INS_USUARIO
    WHERE LTRIM(RTRIM(dni)) = LTRIM(RTRIM(@dni));
  `;

  const pool = await getPool();
  const req = pool.request();
  req.input("dni", sql.NVarChar(15), normalizeDni(dni));

  const result = await req.query(query);

  return result.recordset[0] || null;
}

async function getInspectorRoleId(tx = null) {
  const query = `
    SELECT TOP 1 id_rol
    FROM SSOMA.INS_CAT_ROL
    ORDER BY
      CASE
        WHEN UPPER(LTRIM(RTRIM(CAST(nombre_rol AS NVARCHAR(120))))) = 'INSPECTOR' THEN 0
        WHEN UPPER(LTRIM(RTRIM(CAST(nombre_rol AS NVARCHAR(120))))) LIKE '%INSPECT%' THEN 1
        ELSE 99
      END,
      id_rol;
  `;

  if (tx) {
    const r = await new sql.Request(tx).query(query);
    return Number(r.recordset?.[0]?.id_rol || 0) || null;
  }

  const pool = await getPool();
  const r = await pool.request().query(query);
  return Number(r.recordset?.[0]?.id_rol || 0) || null;
}

async function ensureInspectorUserByDni({
  dni,
  password_hash,
  debe_cambiar_password = 1,
  id_estado_usuario = 1,
  password_expires_at = null,
} = {}) {
  const cleanDni = normalizeDni(dni);
  if (!cleanDni) throw new Error("dni requerido");

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const id_rol_inspector = await getInspectorRoleId(tx);
    if (!id_rol_inspector) {
      throw new Error("No se pudo resolver el rol INSPECTOR");
    }

    const existing = await new sql.Request(tx)
      .input("dni", sql.NVarChar(15), cleanDni)
      .query(`
        SELECT TOP 1 id_usuario, id_rol
        FROM SSOMA.INS_USUARIO
        WHERE LTRIM(RTRIM(dni)) = LTRIM(RTRIM(@dni));
      `);

    const row = existing.recordset?.[0] || null;

    if (row?.id_usuario) {
      if (Number(row.id_rol) !== Number(id_rol_inspector)) {
        await new sql.Request(tx)
          .input("id_usuario", sql.Int, Number(row.id_usuario))
          .input("id_rol", sql.Int, id_rol_inspector)
          .query(`
            UPDATE SSOMA.INS_USUARIO
            SET id_rol = @id_rol
            WHERE id_usuario = @id_usuario;
          `);
      }

      await tx.commit();
      return Number(row.id_usuario);
    }

    if (!password_hash) {
      throw new Error("password_hash requerido para crear usuario inspector");
    }

    const created = await new sql.Request(tx)
      .input("dni", sql.NVarChar(15), cleanDni)
      .input("id_rol", sql.Int, id_rol_inspector)
      .input("id_estado_usuario", sql.Int, id_estado_usuario)
      .input("password_hash", sql.NVarChar(255), password_hash)
      .input("debe_cambiar_password", sql.Bit, debe_cambiar_password ? 1 : 0)
      .input("password_expires_at", sql.DateTime2, password_expires_at ?? null)
      .query(`
        INSERT INTO SSOMA.INS_USUARIO
          (dni, id_rol, id_estado_usuario, password_hash, debe_cambiar_password, password_updated_at, password_expires_at)
        OUTPUT INSERTED.id_usuario
        VALUES
          (@dni, @id_rol, @id_estado_usuario, @password_hash, @debe_cambiar_password, SYSDATETIME(), @password_expires_at);
      `);

    const id_usuario = Number(created.recordset?.[0]?.id_usuario || 0) || null;
    if (!id_usuario) throw new Error("No se pudo crear usuario inspector");

    await tx.commit();
    return id_usuario;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

export default {
  list,
  create,
  update,
  setEstado,
  resetPassword,
  updateFirma,
  getById,
  buscar,
  buscarEmpleados,
  findByDni,
  getInspectorRoleId,
  ensureInspectorUserByDni
};
