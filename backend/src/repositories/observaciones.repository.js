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

async function crearEvidenciaObservacion(payload) {
  const query = `
    INSERT INTO SSOMA.INS_OBSERVACION_EVIDENCIA
    (
      id_observacion,
      id_estado_sync,
      archivo_nombre,
      archivo_ruta,
      mime_type,
      tamano_bytes,
      hash_archivo,
      capturada_en
    )
    OUTPUT INSERTED.*
    VALUES
    (
      @id_observacion,
      @id_estado_sync,
      @archivo_nombre,
      @archivo_ruta,
      @mime_type,
      @tamano_bytes,
      @hash_archivo,
      @capturada_en
    );
  `;

  const pool = await getPool();
  const request = pool.request();

  request.input("id_observacion", sql.Int, payload.id_observacion);
  request.input("id_estado_sync", sql.Int, payload.id_estado_sync);
  request.input("archivo_nombre", sql.NVarChar(200), payload.archivo_nombre);
  request.input("archivo_ruta", sql.NVarChar(500), payload.archivo_ruta);
  request.input("mime_type", sql.NVarChar(80), payload.mime_type);
  request.input("tamano_bytes", sql.BigInt, payload.tamano_bytes);
  request.input("hash_archivo", sql.NVarChar(128), payload.hash_archivo);
  request.input("capturada_en", sql.DateTime2, payload.capturada_en ?? null);

  const result = await request.query(query);
  return result.recordset[0];
}

async function listarEvidenciasPorObservacion(id_observacion) {
  const query = `
    SELECT
      e.id_obs_evidencia,
      e.id_observacion,
      e.id_estado_sync,
      es.nombre_estado AS estado_sync,
      e.archivo_nombre,
      e.archivo_ruta,
      e.mime_type,
      e.tamano_bytes,
      e.hash_archivo,
      e.capturada_en
    FROM SSOMA.INS_OBSERVACION_EVIDENCIA e
    JOIN SSOMA.INS_CAT_ESTADO_SYNC es
      ON es.id_estado_sync = e.id_estado_sync
    WHERE e.id_observacion = @id_observacion
    ORDER BY e.id_obs_evidencia DESC;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);

  const result = await request.query(query);
  return result.recordset;
}

module.exports = { crearObservacion, listarPorInspeccion, crearEvidenciaObservacion, listarEvidenciasPorObservacion };
