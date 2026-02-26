import { sql, getPool } from "../config/database.js";

async function objectExists(objectName, type = "U") {
  const pool = await getPool();
  const r = await pool.request()
    .input("name", sql.NVarChar, objectName)
    .input("type", sql.NVarChar, type)
    .query(`SELECT ok = CASE WHEN OBJECT_ID(@name, @type) IS NOT NULL THEN 1 ELSE 0 END`);
  return Number(r.recordset?.[0]?.ok || 0) === 1;
}

// Busca una tabla real de participantes por inspección (id_inspeccion + id_usuario)
async function getParticipantesTable() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      t = CASE
        WHEN OBJECT_ID('SSOMA.INS_PARTICIPANTE_INSPECCION','U') IS NOT NULL THEN 'SSOMA.INS_PARTICIPANTE_INSPECCION'
        WHEN OBJECT_ID('SSOMA.INS_INSPECCION_PARTICIPANTE','U') IS NOT NULL THEN 'SSOMA.INS_INSPECCION_PARTICIPANTE'
        WHEN OBJECT_ID('SSOMA.INS_PARTICIPANTE','U') IS NOT NULL THEN 'SSOMA.INS_PARTICIPANTE'
        ELSE NULL
      END
  `);
  return r.recordset?.[0]?.t || null;
}

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

function normalizeDni(value) {
  return String(value || "").trim();
}

async function getPreferredEstadoUsuarioId(tx) {
  const rCols = await new sql.Request(tx)
    .input("schema", sql.NVarChar, "SSOMA")
    .input("table", sql.NVarChar, "INS_CAT_ESTADO_USUARIO")
    .query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table;
    `);

  const cols = new Set((rCols.recordset || []).map((x) => String(x.COLUMN_NAME || "").toLowerCase()));
  const nameCol =
    cols.has("nombre_estado") ? "nombre_estado" :
    cols.has("estado") ? "estado" :
    cols.has("descripcion") ? "descripcion" :
    cols.has("nombre") ? "nombre" : null;

  const q = nameCol
    ? `
      SELECT TOP 1 id_estado_usuario
      FROM SSOMA.INS_CAT_ESTADO_USUARIO
      ORDER BY
        CASE
          WHEN UPPER(LTRIM(RTRIM(CAST(${nameCol} AS NVARCHAR(120))))) = 'ACTIVO' THEN 0
          WHEN UPPER(LTRIM(RTRIM(CAST(${nameCol} AS NVARCHAR(120))))) LIKE 'ACTIV%' THEN 1
          ELSE 9
        END,
        id_estado_usuario;
    `
    : `
      SELECT TOP 1 id_estado_usuario
      FROM SSOMA.INS_CAT_ESTADO_USUARIO
      ORDER BY id_estado_usuario;
    `;

  const r = await new sql.Request(tx).query(q);
  return Number(r.recordset?.[0]?.id_estado_usuario || 0) || null;
}

async function getPreferredRolId(tx) {
  // Detecta tabla real
  const rTbl = await new sql.Request(tx).query(`
    SELECT t = CASE
      WHEN OBJECT_ID('SSOMA.INS_CAT_ROL','U') IS NOT NULL THEN 'SSOMA.INS_CAT_ROL'
      WHEN OBJECT_ID('SSOMA.INS_ROL','U') IS NOT NULL THEN 'SSOMA.INS_ROL'
      ELSE NULL
    END
  `);
  const table = rTbl.recordset?.[0]?.t;
  if (!table) return null;

  // Lee columnas para elegir nameCol (INS_CAT_ROL suele tener nombre_rol)
  const rCols = await new sql.Request(tx).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'SSOMA' AND TABLE_NAME = '${table.split(".")[1]}';
  `);

  const cols = new Set((rCols.recordset || []).map((x) => String(x.COLUMN_NAME || "").toLowerCase()));
  const nameCol =
    cols.has("nombre_rol") ? "nombre_rol" :
    cols.has("rol_nombre") ? "rol_nombre" :
    cols.has("nombre") ? "nombre" :
    cols.has("descripcion") ? "descripcion" : null;

  const q = nameCol
    ? `
      SELECT TOP 1 id_rol
      FROM ${table}
      ORDER BY
        CASE
          WHEN UPPER(LTRIM(RTRIM(CAST(${nameCol} AS NVARCHAR(120))))) LIKE '%INSPECT%' THEN 0
          WHEN UPPER(LTRIM(RTRIM(CAST(${nameCol} AS NVARCHAR(120))))) LIKE '%USUARIO%' THEN 1
          WHEN UPPER(LTRIM(RTRIM(CAST(${nameCol} AS NVARCHAR(120))))) LIKE '%ADMIN_PRINCIPAL%' THEN 99
          WHEN UPPER(LTRIM(RTRIM(CAST(${nameCol} AS NVARCHAR(120))))) LIKE '%ADMIN%' THEN 98
          ELSE 10
        END,
        id_rol;
    `
    : `
      SELECT TOP 1 id_rol
      FROM ${table}
      ORDER BY id_rol;
    `;

  const r = await new sql.Request(tx).query(q);
  return Number(r.recordset?.[0]?.id_rol || 0) || null;
}

async function ensureUsuarioByDni(tx, dniRaw) {
  const dni = normalizeDni(dniRaw);
  if (!dni) return null;

  const rFind = await new sql.Request(tx)
    .input("dni", sql.NVarChar(20), dni)
    .query(`
      SELECT TOP 1 id_usuario
      FROM SSOMA.INS_USUARIO
      WHERE LTRIM(RTRIM(dni)) = LTRIM(RTRIM(@dni));
    `);
  const existingId = rFind.recordset?.[0]?.id_usuario;
  if (existingId) return Number(existingId);

  const id_estado_usuario = await getPreferredEstadoUsuarioId(tx);
  const id_rol = await getPreferredRolId(tx);
  if (!id_estado_usuario || !id_rol) {
    console.error("[participantes] No se pudo resolver id_estado_usuario o id_rol para crear INS_USUARIO", {
      dni,
      id_estado_usuario,
      id_rol,
    });
    return null;
  }

  const rIns = await new sql.Request(tx)
    .input("dni", sql.NVarChar(20), dni)
    .input("id_rol", sql.Int, id_rol)
    .input("id_estado_usuario", sql.Int, id_estado_usuario)
    .input("password_hash", sql.NVarChar(300), "PENDIENTE_DE_HASH")
    .input("debe_cambiar_password", sql.Bit, 1)
    .query(`
      INSERT INTO SSOMA.INS_USUARIO
      (
        id_rol,
        id_estado_usuario,
        dni,
        password_hash,
        debe_cambiar_password
      )
      OUTPUT INSERTED.id_usuario
      VALUES
      (
        @id_rol,
        @id_estado_usuario,
        @dni,
        @password_hash,
        @debe_cambiar_password
      );
    `);

  return Number(rIns.recordset?.[0]?.id_usuario || 0) || null;
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
  const fechaExpr = "COALESCE(i.fecha_inspeccion, i.created_at)";
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
    where.push(`${fechaExpr} >= @desde`);
    request.input("desde", sql.DateTime2, filtros.desde);
  }

  if (filtros.hasta) {
    where.push(`${fechaExpr} < DATEADD(day, 1, @hasta)`);
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
    ORDER BY ${fechaExpr} DESC, i.id_inspeccion DESC;
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
    ? `LEFT JOIN SSOMA.V_EMPLEADO ve
        ON CAST(ve.${cDni} AS NVARCHAR(20)) = CAST(t.dni AS NVARCHAR(20))`
    : "";

  const nombreExpr = cDni
    ? `LTRIM(RTRIM(CONCAT(
        COALESCE(CAST(ve.${cApellidos || cNombres || cDni} AS NVARCHAR(150)), ''),
        ' ',
        COALESCE(CAST(ve.${cNombres || cApellidos || cDni} AS NVARCHAR(150)), '')
      )))`
    : "CAST('' AS NVARCHAR(200))";

  const cargoVeExpr = cCargo ? `CAST(ve.${cCargo} AS NVARCHAR(150))` : "CAST('' AS NVARCHAR(150))";

  const query = `
    WITH t AS (
      SELECT
        i.id_usuario,
        u.dni,
        CAST('REALIZADO_POR' AS NVARCHAR(20)) AS tipo,
        CAST(0 AS INT) AS orden_custom
      FROM SSOMA.INS_INSPECCION i
      LEFT JOIN SSOMA.INS_USUARIO u ON u.id_usuario = i.id_usuario
      WHERE i.id_inspeccion = @id_inspeccion

      UNION ALL

      SELECT
        p.id_usuario,
        u2.dni,
        CAST('INSPECTOR' AS NVARCHAR(20)) AS tipo,
        ISNULL(p.orden_custom, 9999) AS orden_custom
      FROM SSOMA.INS_INSPECCION_PARTICIPANTE p
      LEFT JOIN SSOMA.INS_USUARIO u2 ON u2.id_usuario = p.id_usuario
      WHERE p.id_inspeccion = @id_inspeccion
        AND NOT EXISTS (
          SELECT 1
          FROM SSOMA.INS_INSPECCION i2
          WHERE i2.id_inspeccion = p.id_inspeccion
            AND i2.id_usuario = p.id_usuario
        )
    ),
    pc AS (
      SELECT
        id_usuario,
        MAX(CAST(cargo_texto_final AS NVARCHAR(200))) AS cargo_texto_final
      FROM SSOMA.INS_PARTICIPANTE_CARGO
      GROUP BY id_usuario
    )
    SELECT
      CAST(t.dni AS NVARCHAR(20)) AS dni,
      NULLIF(${nombreExpr}, '') AS nombre,
      NULLIF(COALESCE(pc.cargo_texto_final, ${cargoVeExpr}), '') AS cargo,
      t.tipo
    FROM t
    ${joinEmpleado}
    LEFT JOIN pc ON pc.id_usuario = t.id_usuario
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

  // 1) ✅ Intentar leer JSON guardado (modelo nuevo)
  const hasJsonTable = await objectExists("SSOMA.INS_INSPECCION_RESPUESTA", "U");
  if (hasJsonTable) {
    const rJson = await request.query(`
      SELECT TOP 1 json_respuestas
      FROM SSOMA.INS_INSPECCION_RESPUESTA
      WHERE id_inspeccion = @id_inspeccion
      ORDER BY created_at DESC, id_respuesta DESC;
    `);

    const raw = rJson.recordset?.[0]?.json_respuestas;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed?.respuestas) ? parsed.respuestas : [];

        // Normaliza al shape que tu frontend espera
        const out = arr.map((r) => ({
          item_id: String(r?.item_ref ?? r?.id ?? r?.item_id ?? "").trim(),
          categoria: String(r?.categoria ?? "SIN CATEGORIA"),
          descripcion: String(r?.descripcion ?? r?.texto ?? ""),
          estado: String(r?.valor ?? r?.estado ?? r?.valor_opcion ?? "NA").toUpperCase(),
          observacion: String(r?.observacion ?? ""),
          accion_json: (r?.accion != null ? JSON.stringify(r.accion) : (r?.accion_json != null ? JSON.stringify(r.accion_json) : null)),
        }));

        // Si hay data en JSON, devolvemos esto y listo
        if (out.length) return out;
      } catch {
        // si JSON inválido, seguimos con fallback relacional
      }
    }
  }

  // 2) Fallback: modelo relacional viejo (INS_RESPUESTA_ITEM)
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

  const categoriaExpr = hasCategoria
    ? "COALESCE(cat.nombre_categoria, cat.codigo_categoria, 'SIN CATEGORIA')"
    : "CAST('SIN CATEGORIA' AS NVARCHAR(100))";

  const orderSql = hasCategoria
    ? `ORDER BY COALESCE(cat.nombre_categoria, cat.codigo_categoria, 'SIN CATEGORIA'),
           CAST(COALESCE(ic.item_ref, ri.id_campo) AS NVARCHAR(50))`
    : `ORDER BY CAST(COALESCE(ic.item_ref, ri.id_campo) AS NVARCHAR(50))`;
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
    ${orderSql};
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

async function crearInspeccionYGuardarJSON({ cabecera, json_respuestas, participantes }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1) Insert INS_INSPECCION (según TU crearInspeccionCabecera)
    const req1 = new sql.Request(tx);

    req1.input("id_usuario", sql.Int, cabecera.id_usuario);
    req1.input("id_plantilla_inspec", sql.Int, cabecera.id_plantilla_inspec);
    req1.input("id_area", sql.Int, cabecera.id_area);

    req1.input("id_otro", sql.Int, cabecera.id_otro ?? null);
    req1.input("id_estado_inspeccion", sql.Int, cabecera.id_estado_inspeccion ?? 1);
    req1.input("id_modo_registro", sql.Int, cabecera.id_modo_registro ?? 1);

    // 👇 IMPORTANTE: id_cliente es NVARCHAR(10) en tu insert actual
    req1.input("id_cliente", sql.NVarChar(10), cabecera.id_cliente ?? null);
    req1.input("id_servicio", sql.Int, cabecera.id_servicio ?? null);
    req1.input("servicio_detalle", sql.NVarChar(200), cabecera.servicio_detalle ?? null);

    req1.input("fecha_inspeccion", sql.DateTime2, cabecera.fecha_inspeccion);

    const qIns = `
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
      OUTPUT INSERTED.id_inspeccion
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

    const rIns = await req1.query(qIns);
    const id_inspeccion = rIns.recordset?.[0]?.id_inspeccion;

    // 2) Insert INS_INSPECCION_RESPUESTA con JSON
    const req2 = new sql.Request(tx);
    req2.input("id_inspeccion", sql.Int, Number(id_inspeccion));
    req2.input("json_respuestas", sql.NVarChar(sql.MAX), json_respuestas);

    const qResp = `
      INSERT INTO SSOMA.INS_INSPECCION_RESPUESTA (id_inspeccion, json_respuestas, created_at)
      OUTPUT INSERTED.id_respuesta
      VALUES (@id_inspeccion, @json_respuestas, SYSUTCDATETIME());
    `;

    const rResp = await req2.query(qResp);
    const id_respuesta = rResp.recordset?.[0]?.id_respuesta;

    // 3) Participantes: upsert usuario por DNI + relacion + cargo
    if (Array.isArray(participantes) && participantes.length) {
      const participantesTable = await getParticipantesTable();

      // si no existe ninguna tabla válida, no revientas la inspección
      if (!participantesTable) {
        console.warn("[participantes] No se encontró tabla de participantes. Se omite guardado de participantes.");
      } else {
        for (const p of participantes) {
          const dni = normalizeDni(p?.dni);

          const cargoRaw = typeof p?.cargo === "string" ? p.cargo.trim() : "";
          const cargo = cargoRaw.length ? cargoRaw : null;

          const ordenCustom =
            p?.orden_custom == null || p?.orden_custom === ""
              ? null
              : Number(p.orden_custom);

          let idUsuario = p?.id_usuario ? Number(p.id_usuario) : null;

          if ((!idUsuario || Number.isNaN(idUsuario)) && dni) {
            idUsuario = await ensureUsuarioByDni(tx, dni);
          }

          if (!idUsuario || Number.isNaN(idUsuario)) {
            console.warn("[participantes] No se pudo resolver/crear id_usuario. Participante omitido.", {
              dni: dni || null,
              participante: p,
            });
            continue;
          }

          // ✅ Relación participante-inspección (usa participantesTable)
          await new sql.Request(tx)
            .input("id_inspeccion", sql.Int, Number(id_inspeccion))
            .input("id_usuario", sql.Int, idUsuario)
            .input("orden_custom", sql.Int, Number.isFinite(ordenCustom) ? ordenCustom : null)
            .query(`
              IF NOT EXISTS (
                SELECT 1
                FROM ${participantesTable}
                WHERE id_inspeccion = @id_inspeccion AND id_usuario = @id_usuario
              )
              INSERT INTO ${participantesTable} (id_inspeccion, id_usuario, orden_custom)
              VALUES (@id_inspeccion, @id_usuario, @orden_custom);
            `);

          // ✅ Cargo: NO permite NULL => default seguro
          const cargoFinal = cargo ?? "SIN CARGO";
          const cargoEditado = cargo ? 1 : 0;
        }
      }
    }
    await tx.commit();
    return { id_inspeccion, id_respuesta };
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

async function obtenerJsonRespuestasPorInspeccion(id_inspeccion) {
  const pool = await getPool();
  const request = pool.request();
  request.input("id_inspeccion", sql.Int, Number(id_inspeccion));

  const q = `
    SELECT TOP 1 json_respuestas
    FROM SSOMA.INS_INSPECCION_RESPUESTA
    WHERE id_inspeccion = @id_inspeccion
    ORDER BY created_at DESC, id_respuesta DESC;
  `;
  const r = await request.query(q);
  return r.recordset?.[0]?.json_respuestas || null;
}

export default {
  crearInspeccionCabecera,
  listarInspecciones,
  obtenerInspeccionPorId,
  obtenerEstadoInspeccion,
  actualizarEstadoInspeccion,
  listarParticipantesPorInspeccion,
  listarRespuestasPorInspeccion,
  crearInspeccionYGuardarJSON,
  obtenerJsonRespuestasPorInspeccion,
};

