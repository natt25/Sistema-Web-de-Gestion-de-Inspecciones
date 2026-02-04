// Asume que ya tienes tu pool mssql exportado, ej: const pool = require("../db/pool");
const pool = require("../db/pool");
const sql = require("mssql");

async function findByDni(dni) {
  const query = `
    SELECT
      u.id_usuario,
      u.dni,
      u.password_hash,
      u.debe_cambiar_password,
      r.nombre_rol AS rol,
      eu.nombre_estado AS estado
    FROM SSOMA.INS_USUARIO u
    JOIN SSOMA.INS_CAT_ROL r
      ON r.id_rol = u.id_rol
    JOIN SSOMA.INS_CAT_ESTADO_USUARIO eu
      ON eu.id_estado_usuario = u.id_estado_usuario
    WHERE u.dni = @dni;
  `;

  const request = (await pool()).request();
  request.input("dni", sql.NVarChar(15), dni);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

module.exports = { findByDni };
