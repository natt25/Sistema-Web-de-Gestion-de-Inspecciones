const { getPool } = require("../config/database");

async function findByDni(dni) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("dni", dni)
    .query(`
      SELECT
        id_usuario,
        id_rol,
        id_estado_usuario,
        dni,
        password_hash,
        debe_cambiar_password
      FROM SSOMA.INS_USUARIO
      WHERE dni = @dni
    `);

  return result.recordset[0] || null;
}

module.exports = { findByDni };
