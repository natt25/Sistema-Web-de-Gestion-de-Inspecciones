import { sql, getPool } from "../config/database.js";

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

export default { findByDni, onLoginSuccess, onLoginFail, updateFirma };
