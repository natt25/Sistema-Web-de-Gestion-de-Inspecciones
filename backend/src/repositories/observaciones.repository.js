const { sql, getPool } = require("../config/database");

async function crearObservacion(payload) {
  const query = `
    INSERT INTO SSOMA.INS_OBSERVACION
    (
      id_inspeccion,
      id_nivel_riesgo,
      id_estado_observacion,
      item_ref,
      desc_observacion,
      created_at
    )
    OUTPUT INSERTED.*
    VALUES
    (
      @id_inspeccion,
      @id_nivel_riesgo,
      @id_estado_observacion,
      @item_ref,
      @desc_observacion,
      SYSUTCDATETIME()
    );
  `;

  const pool = await getPool();
  const request = pool.request();

  request.input("id_inspeccion", sql.Int, payload.id_inspeccion);
  request.input("id_nivel_riesgo", sql.Int, payload.id_nivel_riesgo);
  request.input("id_estado_observacion", sql.Int, payload.id_estado_observacion);
  request.input("item_ref", sql.NVarChar(50), payload.item_ref ?? null);
  request.input("desc_observacion", sql.NVarChar(500), payload.desc_observacion);

  const result = await request.query(query);
  return result.recordset[0];
}

async function listarPorInspeccion(id_inspeccion) {
  const query = `
    SELECT
      id_observacion,
      id_inspeccion,
      id_nivel_riesgo,
      id_estado_observacion,
      item_ref,
      desc_observacion,
      created_at
    FROM SSOMA.INS_OBSERVACION
    WHERE id_inspeccion = @id_inspeccion
    ORDER BY created_at DESC;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, id_inspeccion);

  const result = await request.query(query);
  return result.recordset;
}


module.exports = { crearObservacion, listarPorInspeccion };
