import { sql, getPool } from "../config/database.js";

function buildEstadoAccionCase(alias = "a") {
  return `
    CASE
      WHEN ISNULL(${alias}.porcentaje_cumplimiento, 0) >= 100 THEN 'CERRADA'
      WHEN ${alias}.fecha_compromiso IS NOT NULL
        AND ${alias}.fecha_compromiso < CAST(SYSDATETIME() AS DATE)
        AND ISNULL(${alias}.porcentaje_cumplimiento, 0) < 100 THEN 'VENCIDA'
      WHEN (
        ISNULL(${alias}.porcentaje_cumplimiento, 0) > 0
        OR EXISTS (
          SELECT 1
          FROM SSOMA.INS_ACCION_EVIDENCIA ae
          WHERE ae.id_accion = ${alias}.id_accion
        )
      ) THEN 'EN PROGRESO'
      ELSE 'PENDIENTE'
    END
  `;
}
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

async function crearAccionObservacion(payload) {
  const pool = await getPool();

  // 1) Crear responsable
  const qResp = `
    INSERT INTO SSOMA.INS_ACCION_RESPONSABLE
    (
      dni,
      externo_responsable_nombre,
      externo_responsable_cargo
    )
    OUTPUT INSERTED.*
    VALUES
    (
      @dni,
      @externo_nombre,
      @externo_cargo
    );
  `;

  const r1 = pool.request();
  r1.input("dni", sql.NVarChar(15), payload.responsable.dni ?? null);
  r1.input("externo_nombre", sql.NVarChar(150), payload.responsable.externo_nombre ?? null);
  r1.input("externo_cargo", sql.NVarChar(150), payload.responsable.externo_cargo ?? null);
  const respResult = await r1.query(qResp);
  const id_acc_responsable = respResult.recordset[0].id_acc_responsable;

  // 2) Crear acción
  const qAcc = `
    INSERT INTO SSOMA.INS_ACCION
    (
      id_observacion,
      id_acc_responsable,
      id_estado_accion,
      desc_accion,
      fecha_compromiso,
      item_ref
    )
    OUTPUT INSERTED.*
    VALUES
    (
      @id_observacion,
      @id_acc_responsable,
      @id_estado_accion,
      @desc_accion,
      @fecha_compromiso,
      @item_ref
    );
  `;

  const r2 = pool.request();
  r2.input("id_observacion", sql.Int, payload.id_observacion);
  r2.input("id_acc_responsable", sql.Int, id_acc_responsable);
  r2.input("id_estado_accion", sql.Int, payload.id_estado_accion);
  r2.input("desc_accion", sql.NVarChar(600), payload.desc_accion);
  r2.input("fecha_compromiso", sql.Date, payload.fecha_compromiso ?? null);
  r2.input("item_ref", sql.NVarChar(60), payload.item_ref ?? null);

  const accResult = await r2.query(qAcc);
  return {
    ...accResult.recordset[0],
    responsable: respResult.recordset[0]
  };
}

async function listarAccionesPorObservacion(id_observacion) {
  const estadoCalculadoExpr = buildEstadoAccionCase("a");
  const query = `
    SELECT
      a.id_accion,
      a.id_observacion,
      a.id_estado_accion,
      ${estadoCalculadoExpr} AS estado_accion,
      a.desc_accion,
      a.fecha_compromiso,
      a.item_ref,
      a.porcentaje_cumplimiento,

      r.id_acc_responsable,
      r.dni,
      r.externo_responsable_nombre,
      r.externo_responsable_cargo
    FROM SSOMA.INS_ACCION a
    JOIN SSOMA.INS_ACCION_RESPONSABLE r
      ON r.id_acc_responsable = a.id_acc_responsable
    WHERE a.id_observacion = @id_observacion
    ORDER BY a.id_accion DESC;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);

  const result = await request.query(query);
  return result.recordset;
}

async function crearEvidenciaAccion(payload) {
  const query = `
    INSERT INTO SSOMA.INS_ACCION_EVIDENCIA
    (
      id_accion,
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
      @id_accion,
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

  request.input("id_accion", sql.Int, payload.id_accion);
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

async function listarEvidenciasPorAccion(id_accion) {
  const query = `
    SELECT
      e.id_acc_evidencia,
      e.id_accion,
      e.id_estado_sync,
      es.nombre_estado AS estado_sync,
      e.archivo_nombre,
      e.archivo_ruta,
      e.mime_type,
      e.tamano_bytes,
      e.hash_archivo,
      e.capturada_en
    FROM SSOMA.INS_ACCION_EVIDENCIA e
    JOIN SSOMA.INS_CAT_ESTADO_SYNC es
      ON es.id_estado_sync = e.id_estado_sync
    WHERE e.id_accion = @id_accion
    ORDER BY e.id_acc_evidencia DESC;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);

  const result = await request.query(query);
  return result.recordset;
}

async function obtenerEstadoObservacion(id_observacion) {
  const query = `
    SELECT id_observacion, id_estado_observacion
    FROM SSOMA.INS_OBSERVACION
    WHERE id_observacion = @id_observacion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function actualizarEstadoObservacion({ id_observacion, id_estado_observacion }) {
  const query = `
    UPDATE SSOMA.INS_OBSERVACION
    SET id_estado_observacion = @id_estado_observacion
    OUTPUT INSERTED.*
    WHERE id_observacion = @id_observacion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);
  request.input("id_estado_observacion", sql.Int, id_estado_observacion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function obtenerEstadoAccion(id_accion) {
  const query = `
    SELECT id_accion, id_estado_accion
    FROM SSOMA.INS_ACCION
    WHERE id_accion = @id_accion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function actualizarEstadoAccion({ id_accion, id_estado_accion }) {
  const query = `
    UPDATE SSOMA.INS_ACCION
    SET id_estado_accion = @id_estado_accion
    OUTPUT INSERTED.*
    WHERE id_accion = @id_accion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);
  request.input("id_estado_accion", sql.Int, id_estado_accion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function actualizarPorcentajeAccion({ id_accion, porcentaje_cumplimiento }) {
  const query = `
    UPDATE SSOMA.INS_ACCION
    SET porcentaje_cumplimiento = @porcentaje_cumplimiento
    OUTPUT INSERTED.*
    WHERE id_accion = @id_accion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);
  request.input("porcentaje_cumplimiento", sql.Int, porcentaje_cumplimiento);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function obtenerInspeccionIdPorObservacion(id_observacion) {
  const query = `
    SELECT id_inspeccion
    FROM SSOMA.INS_OBSERVACION
    WHERE id_observacion = @id_observacion;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);

  const result = await request.query(query);
  return result.recordset[0]?.id_inspeccion ?? null;
}

async function obtenerInspeccionIdPorAccion(id_accion) {
  const query = `
    SELECT o.id_inspeccion
    FROM SSOMA.INS_ACCION a
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = a.id_observacion
    WHERE a.id_accion = @id_accion;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);

  const result = await request.query(query);
  return result.recordset[0]?.id_inspeccion ?? null;
}

async function obtenerResponsableAccion(id_accion) {
  const query = `
    SELECT TOP 1
      a.id_accion,
      a.id_observacion,
      o.id_inspeccion,
      LTRIM(RTRIM(CAST(r.dni AS NVARCHAR(30)))) AS responsable_dni,
      r.externo_responsable_nombre,
      r.externo_responsable_cargo
    FROM SSOMA.INS_ACCION a
    JOIN SSOMA.INS_ACCION_RESPONSABLE r
      ON r.id_acc_responsable = a.id_acc_responsable
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = a.id_observacion
    WHERE a.id_accion = @id_accion;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function obtenerInspeccionIdPorObsEvidencia(id_obs_evidencia) {
  const query = `
    SELECT o.id_inspeccion
    FROM SSOMA.INS_OBSERVACION_EVIDENCIA e
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = e.id_observacion
    WHERE e.id_obs_evidencia = @id_obs_evidencia;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_obs_evidencia", sql.Int, id_obs_evidencia);

  const result = await request.query(query);
  return result.recordset[0]?.id_inspeccion ?? null;
}

async function obtenerInspeccionIdPorAccEvidencia(id_acc_evidencia) {
  const query = `
    SELECT o.id_inspeccion
    FROM SSOMA.INS_ACCION_EVIDENCIA e
    JOIN SSOMA.INS_ACCION a
      ON a.id_accion = e.id_accion
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = a.id_observacion
    WHERE e.id_acc_evidencia = @id_acc_evidencia;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_acc_evidencia", sql.Int, id_acc_evidencia);

  const result = await request.query(query);
  return result.recordset[0]?.id_inspeccion ?? null;
}

async function obtenerResponsableAccionPorEvidencia(id_acc_evidencia) {
  const query = `
    SELECT TOP 1
      a.id_accion,
      a.id_observacion,
      o.id_inspeccion,
      LTRIM(RTRIM(CAST(r.dni AS NVARCHAR(30)))) AS responsable_dni,
      r.externo_responsable_nombre,
      r.externo_responsable_cargo,
      e.id_acc_evidencia
    FROM SSOMA.INS_ACCION_EVIDENCIA e
    JOIN SSOMA.INS_ACCION a
      ON a.id_accion = e.id_accion
    JOIN SSOMA.INS_ACCION_RESPONSABLE r
      ON r.id_acc_responsable = a.id_acc_responsable
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = a.id_observacion
    WHERE e.id_acc_evidencia = @id_acc_evidencia;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_acc_evidencia", sql.Int, id_acc_evidencia);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

// Acciones no finalizadas = cualquier acción cuyo estado calculado no sea CERRADA.
async function contarAccionesNoFinalizadas(id_observacion) {
  const estadoCalculadoExpr = buildEstadoAccionCase("a");
  const query = `
    SELECT COUNT(1) AS pendientes
    FROM SSOMA.INS_ACCION a
    WHERE a.id_observacion = @id_observacion
      AND ${estadoCalculadoExpr} <> 'CERRADA';
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);

  const result = await request.query(query);
  return Number(result.recordset[0]?.pendientes ?? 0);
}

// Observaciones NO cerradas = no están en (3 CERRADA)
async function contarObservacionesNoCerradas(id_inspeccion) {
  const query = `
    SELECT COUNT(1) AS abiertas
    FROM SSOMA.INS_OBSERVACION
    WHERE id_inspeccion = @id_inspeccion
      AND id_estado_observacion <> 3;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, id_inspeccion);

  const result = await request.query(query);
  return Number(result.recordset[0]?.abiertas ?? 0);
}

async function existeHashEvidenciaObservacion({ id_observacion, hash_archivo }) {
  const query = `
    SELECT TOP 1 id_obs_evidencia
    FROM SSOMA.INS_OBSERVACION_EVIDENCIA
    WHERE id_observacion = @id_observacion
      AND hash_archivo = @hash_archivo;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_observacion", sql.Int, id_observacion);
  request.input("hash_archivo", sql.NVarChar(128), hash_archivo);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function existeHashEvidenciaAccion({ id_accion, hash_archivo }) {
  const query = `
    SELECT TOP 1 id_acc_evidencia
    FROM SSOMA.INS_ACCION_EVIDENCIA
    WHERE id_accion = @id_accion
      AND hash_archivo = @hash_archivo;
  `;
  const pool = await getPool();
  const request = pool.request();
  request.input("id_accion", sql.Int, id_accion);
  request.input("hash_archivo", sql.NVarChar(128), hash_archivo);

  const result = await request.query(query);
  return result.recordset[0] || null;
}


export default {
  crearObservacion,
  listarPorInspeccion,
  crearEvidenciaObservacion,
  listarEvidenciasPorObservacion,
  crearAccionObservacion,
  actualizarPorcentajeAccion,
  listarAccionesPorObservacion,
  crearEvidenciaAccion,
  listarEvidenciasPorAccion,
  obtenerEstadoObservacion,
  actualizarEstadoObservacion,
  obtenerEstadoAccion,
  actualizarEstadoAccion,
  obtenerInspeccionIdPorObservacion,
  obtenerInspeccionIdPorAccion,
  obtenerResponsableAccion,
  obtenerInspeccionIdPorObsEvidencia,
  obtenerInspeccionIdPorAccEvidencia,
  obtenerResponsableAccionPorEvidencia,
  contarAccionesNoFinalizadas,
  contarObservacionesNoCerradas,
  existeHashEvidenciaObservacion,
  existeHashEvidenciaAccion
};
