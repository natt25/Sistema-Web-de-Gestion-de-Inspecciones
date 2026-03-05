import { sql, getPool } from "../config/database.js";

function normalizeDni(dni) {
  return String(dni ?? "").trim();
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
  const query = `
    SELECT id_usuario, dni, firma_path, firma_mime, firma_size, firma_updated_at
    FROM SSOMA.INS_USUARIO
    WHERE id_usuario = @id_usuario;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);
  const result = await req.query(query);
  return result.recordset[0] || null;
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
  findByDni,
  getInspectorRoleId,
  ensureInspectorUserByDni
};
