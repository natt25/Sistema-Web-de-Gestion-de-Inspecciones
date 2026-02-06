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
  request.input("item_ref", sql.NVarChar(60), payload.item_ref ?? null);
  request.input("desc_observacion", sql.NVarChar(600), payload.desc_observacion);

  const result = await request.query(query);
  return result.recordset[0];
}

async function listarPorInspeccion(id_inspeccion) {
  const query = `
    SELECT
    o.id_observacion,
    o.id_inspeccion,
    o.id_nivel_riesgo,
    nr.nombre_nivel       AS nivel_riesgo,
    o.id_estado_observacion,
    eo.nombre_estado      AS estado_observacion,
    o.item_ref,
    o.desc_observacion,
    o.created_at
  FROM SSOMA.INS_OBSERVACION o
  JOIN SSOMA.INS_CAT_NIVEL_RIESGO nr
    ON nr.id_nivel_riesgo = o.id_nivel_riesgo
  JOIN SSOMA.INS_CAT_ESTADO_OBSERVACION eo
    ON eo.id_estado_observacion = o.id_estado_observacion
  WHERE o.id_inspeccion = @id_inspeccion
  ORDER BY o.created_at DESC;

  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, id_inspeccion);

  const result = await request.query(query);
  return result.recordset;
}

module.exports = { crearObservacion, listarPorInspeccion };
