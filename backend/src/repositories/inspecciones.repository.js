import { sql, getPool } from "../config/database.js";

async function getColumns(schema, tableOrView) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("schema", sql.NVarChar, schema)
      .input("name", sql.NVarChar, tableOrView)
      .query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @name
      `);
    return new Set((r.recordset || []).map((x) => String(x.COLUMN_NAME || "").toLowerCase()));
  } catch {
    return new Set();
  }
}

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

async function listarParticipantesPorInspeccion(id_inspeccion) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, Number(id_inspeccion));

  const cols = await getColumns("SSOMA", "V_EMPLEADO");
  const cDni =
    cols.has("dni") ? "dni" :
    cols.has("num_doc") ? "num_doc" :
    cols.has("documento") ? "documento" : null;
  const cNombres =
    cols.has("nombres") ? "nombres" :
    cols.has("nombre") ? "nombre" :
    cols.has("nombres_empleado") ? "nombres_empleado" : null;
  const cApellidos =
    cols.has("apellidos") ? "apellidos" :
    cols.has("apellido") ? "apellido" :
    cols.has("apellido_paterno") ? "apellido_paterno" : null;
  const cCargo =
    cols.has("cargo") ? "cargo" :
    cols.has("desc_cargo") ? "desc_cargo" :
    cols.has("nombre_cargo") ? "nombre_cargo" : null;

  const joinEmpleado = cDni
    ? `
      LEFT JOIN SSOMA.V_EMPLEADO ve
        ON CAST(ve.${cDni} AS NVARCHAR(20)) = CAST(t.dni AS NVARCHAR(20))
    `
    : "";
  const nombreExpr = cDni
    ? `LTRIM(RTRIM(CONCAT(COALESCE(CAST(ve.${cApellidos || cNombres || cDni} AS NVARCHAR(150)), ''), ' ', COALESCE(CAST(ve.${cNombres || cApellidos || cDni} AS NVARCHAR(150)), ''))))`
    : "CAST('' AS NVARCHAR(200))";
  const cargoExpr = cCargo ? `CAST(ve.${cCargo} AS NVARCHAR(150))` : "CAST('' AS NVARCHAR(150))";

  const query = `
    WITH t AS (
      SELECT
        i.id_inspeccion,
        i.id_usuario,
        u.dni,
        CAST('REALIZADO_POR' AS NVARCHAR(20)) AS tipo,
        CAST(0 AS INT) AS orden_custom
      FROM SSOMA.INS_INSPECCION i
      LEFT JOIN SSOMA.INS_USUARIO u ON u.id_usuario = i.id_usuario
      WHERE i.id_inspeccion = @id_inspeccion

      UNION ALL

      SELECT
        p.id_inspeccion,
        p.id_usuario,
        u2.dni,
        CAST('INSPECTOR' AS NVARCHAR(20)) AS tipo,
        ISNULL(p.orden_custom, 9999) AS orden_custom
      FROM SSOMA.INS_INSPECCION_PARTICIPANTE p
      JOIN SSOMA.INS_INSPECCION i2 ON i2.id_inspeccion = p.id_inspeccion
      LEFT JOIN SSOMA.INS_USUARIO u2 ON u2.id_usuario = p.id_usuario
      WHERE p.id_inspeccion = @id_inspeccion
        AND p.id_usuario <> i2.id_usuario
    )
    SELECT
      CAST(t.dni AS NVARCHAR(20)) AS dni,
      NULLIF(${nombreExpr}, '') AS nombre,
      NULLIF(${cargoExpr}, '') AS cargo,
      t.tipo
    FROM t
    ${joinEmpleado}
    ORDER BY
      CASE WHEN t.tipo = 'REALIZADO_POR' THEN 0 ELSE 1 END,
      t.orden_custom,
      t.dni;
  `;

  const result = await request.query(query);
  return (result.recordset || []).map((r) => ({
    dni: r.dni || "",
    nombre: r.nombre || r.dni || "",
    cargo: r.cargo || "",
    tipo: r.tipo === "REALIZADO_POR" ? "REALIZADO_POR" : "INSPECTOR",
  }));
}

async function listarRespuestasPorInspeccion(id_inspeccion) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, Number(id_inspeccion));

  const existsReq = pool.request();
  const exists = await existsReq.query(`
    SELECT
      campo = CASE WHEN OBJECT_ID('SSOMA.INS_PLANTILLA_CAMPO', 'U') IS NOT NULL THEN 1 ELSE 0 END,
      categoria = CASE WHEN OBJECT_ID('SSOMA.INS_PLANTILLA_CATEGORIA', 'U') IS NOT NULL THEN 1 ELSE 0 END
  `);
  const hasCampo = Number(exists.recordset?.[0]?.campo || 0) === 1;
  const hasCategoria = Number(exists.recordset?.[0]?.categoria || 0) === 1;

  if (!hasCampo) {
    const fallback = await request.query(`
      SELECT
        CAST(ri.id_campo AS NVARCHAR(50)) AS item_id,
        CAST('SIN CATEGORIA' AS NVARCHAR(100)) AS categoria,
        CAST(CONCAT('Campo ', ri.id_campo) AS NVARCHAR(250)) AS descripcion,
        UPPER(CAST(ri.valor_opcion AS NVARCHAR(20))) AS estado,
        CAST(ri.observacion AS NVARCHAR(300)) AS observacion,
        CAST(NULL AS NVARCHAR(MAX)) AS accion_json
      FROM SSOMA.INS_INSPECCION_RESPUESTA r
      JOIN SSOMA.INS_RESPUESTA_ITEM ri ON ri.id_respuesta = r.id_respuesta
      WHERE r.id_inspeccion = @id_inspeccion
      ORDER BY ri.id_campo;
    `);
    return (fallback.recordset || []).map((r) => ({
      item_id: r.item_id || "",
      categoria: r.categoria || "SIN CATEGORIA",
      descripcion: r.descripcion || "",
      estado: r.estado || "NA",
      observacion: r.observacion || "",
      accion_json: null,
    }));
  }

  const query = `
    SELECT
      CAST(COALESCE(ic.item_ref, ri.id_campo) AS NVARCHAR(50)) AS item_id,
      ${hasCategoria ? "COALESCE(cat.nombre_categoria, cat.codigo_categoria, 'SIN CATEGORIA')" : "'SIN CATEGORIA'"} AS categoria,
      COALESCE(ic.descripcion_item, ic.titulo_campo, ic.nombre_campo, CONCAT('Campo ', ri.id_campo)) AS descripcion,
      UPPER(CAST(ri.valor_opcion AS NVARCHAR(20))) AS estado,
      CAST(ri.observacion AS NVARCHAR(300)) AS observacion,
      CAST(NULL AS NVARCHAR(MAX)) AS accion_json
    FROM SSOMA.INS_INSPECCION_RESPUESTA r
    JOIN SSOMA.INS_RESPUESTA_ITEM ri ON ri.id_respuesta = r.id_respuesta
    LEFT JOIN SSOMA.INS_PLANTILLA_CAMPO ic ON ic.id_campo = ri.id_campo
    ${hasCategoria ? "LEFT JOIN SSOMA.INS_PLANTILLA_CATEGORIA cat ON cat.id_categoria = ic.id_categoria" : ""}
    WHERE r.id_inspeccion = @id_inspeccion
    ORDER BY
      ${hasCategoria ? "COALESCE(cat.nombre_categoria, cat.codigo_categoria, 'SIN CATEGORIA')" : "'SIN CATEGORIA'"},
      CAST(COALESCE(ic.item_ref, ri.id_campo) AS NVARCHAR(50));
  `;

  const result = await request.query(query);
  return (result.recordset || []).map((r) => ({
    item_id: r.item_id || "",
    categoria: r.categoria || "SIN CATEGORIA",
    descripcion: r.descripcion || "",
    estado: r.estado || "NA",
    observacion: r.observacion || "",
    accion_json: null,
  }));
}

async function crearInspeccionCompleta({ user, cabecera, respuestas, participantes = [] }) {
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

    // 2) Crea contenedor de respuestas (1 fila por inspeccion)
    const qRespHeader = `
      INSERT INTO SSOMA.INS_INSPECCION_RESPUESTA
      (id_inspeccion, created_at)
      OUTPUT INSERTED.id_respuesta
      VALUES
      (@id_inspeccion, SYSUTCDATETIME());
    `;

    const reqRespHeader = new sql.Request(tx);
    reqRespHeader.input("id_inspeccion", sql.Int, id_inspeccion);
    const rRespHeader = await reqRespHeader.query(qRespHeader);
    const id_respuesta = rRespHeader.recordset[0].id_respuesta;

    const validarCampoPlantillaQuery = `
      IF OBJECT_ID('SSOMA.INS_PLANTILLA_CAMPO', 'U') IS NULL
      BEGIN
        SELECT CAST(0 AS BIT) AS existe, CAST(0 AS BIT) AS pertenece;
        RETURN;
      END;

      DECLARE @existe BIT = 0;
      DECLARE @pertenece BIT = 0;

      IF EXISTS (SELECT 1 FROM SSOMA.INS_PLANTILLA_CAMPO c WHERE c.id_campo = @id_campo)
        SET @existe = 1;

      IF COL_LENGTH('SSOMA.INS_PLANTILLA_CAMPO', 'id_plantilla_inspec') IS NOT NULL
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM SSOMA.INS_PLANTILLA_CAMPO c
          WHERE c.id_campo = @id_campo
            AND c.id_plantilla_inspec = @id_plantilla_inspec
        ) SET @pertenece = 1;
      END
      ELSE IF OBJECT_ID('SSOMA.INS_PLANTILLA_CATEGORIA', 'U') IS NOT NULL
           AND COL_LENGTH('SSOMA.INS_PLANTILLA_CAMPO', 'id_categoria') IS NOT NULL
           AND COL_LENGTH('SSOMA.INS_PLANTILLA_CATEGORIA', 'id_plantilla_inspec') IS NOT NULL
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM SSOMA.INS_PLANTILLA_CAMPO c
          JOIN SSOMA.INS_PLANTILLA_CATEGORIA cat ON cat.id_categoria = c.id_categoria
          WHERE c.id_campo = @id_campo
            AND cat.id_plantilla_inspec = @id_plantilla_inspec
        ) SET @pertenece = 1;
      END

      SELECT @existe AS existe, @pertenece AS pertenece;
    `;

    // 3) Inserta items de respuesta (valor unico: valor_opcion)
    const qRespItem = `
      INSERT INTO SSOMA.INS_RESPUESTA_ITEM
      (
        id_respuesta,
        id_campo,
        valor_opcion,
        observacion
      )
      VALUES
      (
        @id_respuesta,
        @id_campo,
        @valor_opcion,
        @observacion
      );
    `;

    for (const it of respuestas) {
      const idCampo = Number(it.id_campo);
      const reqValCampo = new sql.Request(tx);
      reqValCampo.input("id_campo", sql.Int, idCampo);
      reqValCampo.input("id_plantilla_inspec", sql.Int, Number(cabecera.id_plantilla_inspec));
      const rVal = await reqValCampo.query(validarCampoPlantillaQuery);
      const existe = Boolean(rVal.recordset?.[0]?.existe);
      const pertenece = Boolean(rVal.recordset?.[0]?.pertenece);
      if (!existe || !pertenece) {
        const err = new Error(
          `Campo invalido: id_campo=${idCampo} no existe/no pertenece a plantilla ${Number(cabecera.id_plantilla_inspec)}`
        );
        err.status = 400;
        err.id_campo = idCampo;
        throw err;
      }

      const reqR = new sql.Request(tx);
      reqR.input("id_respuesta", sql.Int, id_respuesta);
      reqR.input("id_campo", sql.Int, idCampo);
      reqR.input("valor_opcion", sql.NVarChar(20), it.estado ?? null);
      // Regla pedida: truncar observacion a 300
      reqR.input("observacion", sql.NVarChar(300), (it.observacion || "").slice(0, 300) || null);
      await reqR.query(qRespItem);
    }

    // 4) Participantes (dni -> id_usuario)
    if (Array.isArray(participantes) && participantes.length) {
      for (let idx = 0; idx < participantes.length; idx += 1) {
        const p = participantes[idx];
        const dni = String(p?.dni || "").trim();
        if (!dni) continue;

        const reqFindUser = new sql.Request(tx);
        reqFindUser.input("dni", sql.NVarChar(15), dni);
        const rUser = await reqFindUser.query(`
          SELECT TOP 1 id_usuario
          FROM SSOMA.INS_USUARIO
          WHERE dni = @dni
        `);
        const userRow = rUser.recordset?.[0];
        if (!userRow?.id_usuario) {
          const err = new Error(`Participante no tiene usuario: ${dni}`);
          err.status = 400;
          throw err;
        }

        const reqPart = new sql.Request(tx);
        reqPart.input("id_inspeccion", sql.Int, id_inspeccion);
        reqPart.input("id_usuario", sql.Int, userRow.id_usuario);
        reqPart.input("orden_custom", sql.Int, idx + 1);
        await reqPart.query(`
          IF NOT EXISTS (
            SELECT 1
            FROM SSOMA.INS_INSPECCION_PARTICIPANTE
            WHERE id_inspeccion = @id_inspeccion AND id_usuario = @id_usuario
          )
          BEGIN
            INSERT INTO SSOMA.INS_INSPECCION_PARTICIPANTE
            (id_inspeccion, id_usuario, orden_custom)
            VALUES
            (@id_inspeccion, @id_usuario, @orden_custom)
          END
        `);
      }
    }

    await tx.commit();

    return {
      id_inspeccion,
      id_respuesta,
      total_respuestas: respuestas.length,
      inspeccion,
    };
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
  listarParticipantesPorInspeccion,
  listarRespuestasPorInspeccion,
  crearInspeccionCompleta
};
