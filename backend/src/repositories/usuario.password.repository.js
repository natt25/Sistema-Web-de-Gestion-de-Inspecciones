import { sql, getPool } from "../config/database.js";

async function updatePassword(id_usuario, { password_hash, expires_at }) {
  const query = `
    UPDATE SSOMA.INS_USUARIO
    SET
      password_hash = @password_hash,
      debe_cambiar_password = 0,
      password_updated_at = SYSDATETIME(),
      password_expires_at = @expires_at,
      failed_attempts = 0,
      locked_until = NULL
    WHERE id_usuario = @id_usuario;
  `;

  const pool = await getPool();
  const req = pool.request();

  req.input("id_usuario", sql.Int, id_usuario);
  req.input("password_hash", sql.NVarChar(255), password_hash);
  req.input("expires_at", sql.DateTime2, expires_at ?? null);

  await req.query(query);
}

async function getPasswordData(id_usuario) {
  const query = `
    SELECT id_usuario, password_hash, debe_cambiar_password, password_expires_at
    FROM SSOMA.INS_USUARIO
    WHERE id_usuario = @id_usuario;
  `;

  const pool = await getPool();
  const req = pool.request();
  req.input("id_usuario", sql.Int, id_usuario);

  const result = await req.query(query);
  return result.recordset[0] || null;
}

export default { updatePassword, getPasswordData };
