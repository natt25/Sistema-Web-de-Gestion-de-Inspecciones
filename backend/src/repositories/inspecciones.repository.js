import { sql, getPool } from "../config/database.js";

async function crearInspeccionCabecera(payload) {
  const query = `
    INSERT INTO SSOMA.INS_INSPECCION
    (
    id_usuario,
    id_plantilla_inspec,
    id_area,
    id_otro,
    id_estado_inspeccion,
    id_modo_registro,
    id_cliente,
    id_servicio,
    servicio_detalle,
    fecha_inspeccion,
    created_at,
    synced_at
    )
    OUTPUT INSERTED.*
    VALUES
    (
    @id_usuario,
    @id_plantilla_inspec,
    @id_area,
    @id_otro,
    @id_estado_inspeccion,
    @id_modo_registro,
    @id_cliente,
    @id_servicio,
    @servicio_detalle,
    @fecha_inspeccion,
    SYSUTCDATETIME(),
    NULL
    );
  `;

  const pool = await getPool();
  const request = pool.request();

  request.input("id_usuario", sql.Int, payload.id_usuario);
  request.input("id_plantilla_inspec", sql.Int, payload.id_plantilla_inspec);
  request.input("id_estado_inspeccion", sql.Int, payload.id_estado_inspeccion);
  request.input("id_modo_registro", sql.Int, payload.id_modo_registro);

  request.input("id_otro", sql.Int, payload.id_otro ?? null);
  request.input("id_cliente", sql.NVarChar(10), payload.id_cliente ?? null);
  request.input("id_servicio", sql.Int, payload.id_servicio ?? null);
  request.input("servicio_detalle", sql.NVarChar(200), payload.servicio_detalle ?? null);
  request.input("fecha_inspeccion", sql.DateTime2, payload.fecha_inspeccion);
  request.input("id_area", sql.Int, payload.id_area);

  const result = await request.query(query);
  return result.recordset[0];
}

async function listarInspecciones(filtros) {
  const where = [];
  const pool = await getPool();
  const request = pool.request();

  // filtros opcionales
  if (filtros.id_area) {
    where.push("i.id_area = @id_area");
    request.input("id_area", sql.Int, filtros.id_area);
  }

  if (filtros.id_estado_inspeccion) {
    where.push("i.id_estado_inspeccion = @id_estado_inspeccion");
    request.input("id_estado_inspeccion", sql.Int, filtros.id_estado_inspeccion);
  }

  if (filtros.id_usuario) {
    where.push("i.id_usuario = @id_usuario");
    request.input("id_usuario", sql.Int, filtros.id_usuario);
  }

  if (filtros.desde) {
    where.push("i.fecha_inspeccion >= @desde");
    request.input("desde", sql.DateTime2, filtros.desde);
  }

  if (filtros.hasta) {
    where.push("i.fecha_inspeccion < DATEADD(day, 1, @hasta)");
    request.input("hasta", sql.DateTime2, filtros.hasta);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const query = `
    SELECT
      i.id_inspeccion,
      i.fecha_inspeccion,
      i.created_at,
      i.id_area,
      a.desc_area,

      i.id_estado_inspeccion,
      ei.nombre_estado AS estado_inspeccion,

      i.id_modo_registro,
      mr.nombre_modo AS modo_registro,

      i.id_plantilla_inspec,
      p.nombre_formato,

      i.id_cliente,
      c.raz_social,

      i.id_servicio,
      s.nombre_servicio,

      i.id_otro,
      i.servicio_detalle
    FROM SSOMA.INS_INSPECCION i
    JOIN SSOMA.INS_AREA a ON a.id_area = i.id_area
    JOIN SSOMA.INS_CAT_ESTADO_INSPECCION ei ON ei.id_estado_inspeccion = i.id_estado_inspeccion
    JOIN SSOMA.INS_CAT_MODO_REGISTRO mr ON mr.id_modo_registro = i.id_modo_registro
    JOIN SSOMA.INS_PLANTILLA_INSPECCION p ON p.id_plantilla_inspec = i.id_plantilla_inspec
    LEFT JOIN SSOMA.V_CLIENTE c ON LTRIM(RTRIM(c.id_cliente)) = LTRIM(RTRIM(i.id_cliente))
    LEFT JOIN SSOMA.V_SERVICIO s ON s.id_servicio = i.id_servicio
    ${whereSql}
    ORDER BY i.fecha_inspeccion DESC, i.id_inspeccion DESC;
  `;

  const result = await request.query(query);
  return result.recordset;
}

async function obtenerInspeccionPorId(id_inspeccion) {
  const query = `
    SELECT
      i.id_inspeccion,
      i.fecha_inspeccion,
      i.created_at,

      i.id_area,
      a.desc_area,

      i.id_estado_inspeccion,
      ei.nombre_estado AS estado_inspeccion,

      i.id_modo_registro,
      mr.nombre_modo AS modo_registro,

      i.id_plantilla_inspec,
      p.codigo_formato,
      p.nombre_formato,
      p.version_actual,

      i.id_cliente,
      c.raz_social,

      i.id_servicio,
      s.nombre_servicio,

      i.id_otro,
      i.servicio_detalle
    FROM SSOMA.INS_INSPECCION i
    JOIN SSOMA.INS_AREA a ON a.id_area = i.id_area
    JOIN SSOMA.INS_CAT_ESTADO_INSPECCION ei ON ei.id_estado_inspeccion = i.id_estado_inspeccion
    JOIN SSOMA.INS_CAT_MODO_REGISTRO mr ON mr.id_modo_registro = i.id_modo_registro
    JOIN SSOMA.INS_PLANTILLA_INSPECCION p ON p.id_plantilla_inspec = i.id_plantilla_inspec
    LEFT JOIN SSOMA.V_CLIENTE c ON LTRIM(RTRIM(c.id_cliente)) = LTRIM(RTRIM(i.id_cliente))
    LEFT JOIN SSOMA.V_SERVICIO s ON s.id_servicio = i.id_servicio
    WHERE i.id_inspeccion = @id_inspeccion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, id_inspeccion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function obtenerEstadoInspeccion(id_inspeccion) {
  const query = `
    SELECT id_inspeccion, id_estado_inspeccion
    FROM SSOMA.INS_INSPECCION
    WHERE id_inspeccion = @id_inspeccion;
  `;

  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, id_inspeccion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function actualizarEstadoInspeccion({ id_inspeccion, id_estado_inspeccion }) {
  const query = `
    UPDATE SSOMA.INS_INSPECCION
    SET id_estado_inspeccion = @id_estado_inspeccion
    OUTPUT INSERTED.*
    WHERE id_inspeccion = @id_inspeccion;
  `;

  const pool = await getPool();
  const request = pool.request();

  request.input("id_inspeccion", sql.Int, id_inspeccion);
  request.input("id_estado_inspeccion", sql.Int, id_estado_inspeccion);

  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function crearInspeccionCompleta({ user, cabecera, respuestas }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1) Insert cabecera (reutiliza tu insert pero con transaction)
    const qCab = `
      INSERT INTO SSOMA.INS_INSPECCION
      (
        id_usuario,
        id_plantilla_inspec,
        id_area,
        id_otro,
        id_estado_inspeccion,
        id_modo_registro,
        id_cliente,
        id_servicio,
        servicio_detalle,
        fecha_inspeccion,
        created_at,
        synced_at
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @id_usuario,
        @id_plantilla_inspec,
        @id_area,
        @id_otro,
        @id_estado_inspeccion,
        @id_modo_registro,
        @id_cliente,
        @id_servicio,
        @servicio_detalle,
        @fecha_inspeccion,
        SYSUTCDATETIME(),
        NULL
      );
    `;

    const reqCab = new sql.Request(tx);
    reqCab.input("id_usuario", sql.Int, user.id_usuario);
    reqCab.input("id_plantilla_inspec", sql.Int, cabecera.id_plantilla_inspec);
    reqCab.input("id_estado_inspeccion", sql.Int, cabecera.id_estado_inspeccion ?? 1);
    reqCab.input("id_modo_registro", sql.Int, cabecera.id_modo_registro ?? 1);

    reqCab.input("id_otro", sql.Int, cabecera.id_otro ?? null);
    reqCab.input("id_cliente", sql.NVarChar(10), cabecera.id_cliente ?? null);
    reqCab.input("id_servicio", sql.Int, cabecera.id_servicio ?? null);
    reqCab.input("servicio_detalle", sql.NVarChar(200), cabecera.servicio_detalle ?? null);
    reqCab.input("fecha_inspeccion", sql.DateTime2, cabecera.fecha_inspeccion ?? new Date());
    reqCab.input("id_area", sql.Int, cabecera.id_area);

    const rCab = await reqCab.query(qCab);
    const inspeccion = rCab.recordset[0];
    const id_inspeccion = inspeccion.id_inspeccion;

    // 2) Insert respuestas (una por item)
    const qResp = `
      INSERT INTO SSOMA.INS_INSPECCION_RESPUESTA
      (
        id_inspeccion,
        item_id,
        categoria,
        estado,
        observacion,
        accion_json,
        created_at
      )
      VALUES
      (
        @id_inspeccion,
        @item_id,
        @categoria,
        @estado,
        @observacion,
        @accion_json,
        SYSUTCDATETIME()
      );
    `;

    for (const it of respuestas) {
      const reqR = new sql.Request(tx);
      reqR.input("id_inspeccion", sql.Int, id_inspeccion);
      reqR.input("item_id", sql.NVarChar(10), String(it.id_item));
      reqR.input("categoria", sql.NVarChar(80), it.categoria ?? null);
      reqR.input("estado", sql.NVarChar(10), it.estado ?? null);
      reqR.input("observacion", sql.NVarChar(sql.MAX), it.observacion ?? null);
      reqR.input("accion_json", sql.NVarChar(sql.MAX), it.accion ? JSON.stringify(it.accion) : null);

      await reqR.query(qResp);

      // 3) Si es MALO: aquí puedes también crear INS_OBSERVACION / INS_ACCION reales
      // (si quieres que esos módulos sigan siendo tablas separadas)
      // Ej: llamar a tus repos de observaciones/acciones o insertar aquí.
    }

    await tx.commit();

    return { inspeccion, total_respuestas: respuestas.length };
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
}

// Crea responsable interno/externo y devuelve id_acc_responsable
async function upsertResponsable(tx, quien) {
  // quien puede venir como:
  // - { dni: "00000000" }  (interno)
  // - { nombre: "Juan Perez", cargo: "Supervisor" } (externo)
  // - o string libre "Juan Perez" (externo simple)

  let dni = null;
  let externo_nombre = null;
  let externo_cargo = null;

  if (typeof quien === "string") {
    externo_nombre = quien.trim();
    externo_cargo = "EXTERNO";
  } else if (quien?.dni) {
    dni = String(quien.dni).trim();
  } else {
    externo_nombre = String(quien?.nombre || "").trim() || String(quien?.texto || "").trim();
    externo_cargo = String(quien?.cargo || "").trim() || "EXTERNO";
  }

  // Si es interno, intenta encontrar ya existente por dni
  if (dni) {
    const qFind = `
      SELECT TOP 1 id_acc_responsable
      FROM SSOMA.INS_ACCION_RESPONSABLE
      WHERE dni = @dni;
    `;
    const rf = new sql.Request(tx);
    rf.input("dni", sql.NVarChar(15), dni);
    const found = await rf.query(qFind);
    if (found.recordset[0]) return found.recordset[0].id_acc_responsable;

    const qIns = `
      INSERT INTO SSOMA.INS_ACCION_RESPONSABLE (dni, externo_responsable_nombre, externo_responsable_cargo)
      OUTPUT INSERTED.id_acc_responsable
      VALUES (@dni, NULL, NULL);
    `;
    const ri = new sql.Request(tx);
    ri.input("dni", sql.NVarChar(15), dni);
    const ins = await ri.query(qIns);
    return ins.recordset[0].id_acc_responsable;
  }

  // externo
  if (!externo_nombre) externo_nombre = "EXTERNO";
  if (!externo_cargo) externo_cargo = "EXTERNO";

  const qInsExt = `
    INSERT INTO SSOMA.INS_ACCION_RESPONSABLE (dni, externo_responsable_nombre, externo_responsable_cargo)
    OUTPUT INSERTED.id_acc_responsable
    VALUES (NULL, @nombre, @cargo);
  `;
  const re = new sql.Request(tx);
  re.input("nombre", sql.NVarChar(150), externo_nombre);
  re.input("cargo", sql.NVarChar(150), externo_cargo);
  const insE = await re.query(qInsExt);
  return insE.recordset[0].id_acc_responsable;
}

export default {
  crearInspeccionCabecera,
  listarInspecciones,
  obtenerInspeccionPorId,
  obtenerEstadoInspeccion,
  actualizarEstadoInspeccion,
  crearInspeccionCompleta
};