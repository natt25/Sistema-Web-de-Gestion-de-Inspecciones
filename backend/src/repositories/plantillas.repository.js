import { sql, getPool } from "../config/database.js";

async function listPlantillas() {
  const started = Date.now();
  const q = `
    SELECT
      p.id_plantilla_inspec,
      p.codigo_formato,
      p.nombre_formato,
      p.version_actual,
      p.estado,
      p.fecha_creacion
    FROM SSOMA.INS_PLANTILLA_INSPECCION p
    WHERE p.estado = 1
    ORDER BY p.codigo_formato;
  `;
  console.log("[plantillas.repo] listPlantillas:start");
  const pool = await getPool();
  const r = await pool.request().query(q);
  console.log(`[plantillas.repo] listPlantillas:end -> ${r.recordset?.length || 0} registros`, {
    durationMs: Date.now() - started,
  });
  return r.recordset;
}

async function getDefinicion(id_plantilla_inspec) {
  const started = Date.now();
  const q = `
    SELECT TOP 1
      d.id_plantilla_def,
      d.id_plantilla_inspec,
      d.version,
      d.json_definicion,
      d.checksum,
      d.fecha_creacion
    FROM SSOMA.INS_PLANTILLA_DEFINICION d
    WHERE d.id_plantilla_inspec = @id
    ORDER BY d.version DESC;
  `;
  console.log("[plantillas.repo] getDefinicion:start", { id_plantilla_inspec });
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.Int, id_plantilla_inspec);
  const r = await req.query(q);
  console.log("[plantillas.repo] getDefinicion:end", {
    found: Boolean(r.recordset[0]),
    durationMs: Date.now() - started,
  });
  return r.recordset[0] || null;
}

async function getDefinicionByVersion(id_plantilla_inspec, version) {
  const started = Date.now();
  const q = `
    SELECT TOP 1
      d.id_plantilla_def,
      d.id_plantilla_inspec,
      d.version,
      d.json_definicion,
      d.checksum,
      d.fecha_creacion
    FROM SSOMA.INS_PLANTILLA_DEFINICION d
    WHERE d.id_plantilla_inspec = @id AND d.version = @version;
  `;
  console.log("[plantillas.repo] getDefinicionByVersion:start", { id_plantilla_inspec, version });
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.Int, id_plantilla_inspec);
  req.input("version", sql.Int, version);
  const r = await req.query(q);
  console.log("[plantillas.repo] getDefinicionByVersion:end", {
    found: Boolean(r.recordset[0]),
    durationMs: Date.now() - started,
  });
  return r.recordset[0] || null;
}

async function listarCamposPorPlantilla(id_plantilla_inspec, id_plantilla_def = null) {
  const pool = await getPool();
  const reqDef = pool.request();
  reqDef.input("id_inspec", sql.Int, Number(id_plantilla_inspec));

  let idDef = id_plantilla_def ? Number(id_plantilla_def) : null;
  if (!idDef) {
    const rDef = await reqDef.query(`
      SELECT TOP 1 id_plantilla_def
      FROM SSOMA.INS_PLANTILLA_DEFINICION
      WHERE id_plantilla_inspec = @id_inspec
      ORDER BY version DESC;
    `);
    idDef = Number(rDef.recordset?.[0]?.id_plantilla_def || 0) || null;
  }

  const req = pool.request();
  req.input("id_inspec", sql.Int, Number(id_plantilla_inspec));
  req.input("id_def", sql.Int, idDef ? Number(idDef) : null);

  const query = `
    IF OBJECT_ID('SSOMA.INS_PLANTILLA_CAMPO', 'U') IS NULL
    BEGIN
      SELECT TOP 0
        CAST(NULL AS INT) AS id_campo,
        CAST(NULL AS NVARCHAR(50)) AS item_ref,
        CAST(NULL AS NVARCHAR(300)) AS descripcion_item;
      RETURN;
    END;

    -- ✅ Si la tabla usa id_plantilla_def (tu caso, según SSMS)
    IF COL_LENGTH('SSOMA.INS_PLANTILLA_CAMPO', 'id_plantilla_def') IS NOT NULL
    BEGIN
      IF COL_LENGTH('SSOMA.INS_PLANTILLA_CAMPO', 'etiqueta') IS NOT NULL
      BEGIN
        SELECT
          c.id_campo,
          CAST(c.item_ref AS NVARCHAR(50)) AS item_ref,
          CAST(COALESCE(c.etiqueta, c.descripcion_item, c.titulo_campo, c.nombre_campo) AS NVARCHAR(300)) AS descripcion_item
        FROM SSOMA.INS_PLANTILLA_CAMPO c
        WHERE c.id_plantilla_def = @id_def;
        RETURN;
      END;

      SELECT
        c.id_campo,
        CAST(c.item_ref AS NVARCHAR(50)) AS item_ref,
        CAST(COALESCE(c.descripcion_item, c.titulo_campo, c.nombre_campo) AS NVARCHAR(300)) AS descripcion_item
      FROM SSOMA.INS_PLANTILLA_CAMPO c
      WHERE c.id_plantilla_def = @id_def;
      RETURN;
    END;

    -- (fallback antiguo) si tuviera id_plantilla_inspec
    IF COL_LENGTH('SSOMA.INS_PLANTILLA_CAMPO', 'id_plantilla_inspec') IS NOT NULL
    BEGIN
      IF COL_LENGTH('SSOMA.INS_PLANTILLA_CAMPO', 'etiqueta') IS NOT NULL
      BEGIN
        SELECT
          c.id_campo,
          CAST(c.item_ref AS NVARCHAR(50)) AS item_ref,
          CAST(COALESCE(c.etiqueta, c.descripcion_item, c.titulo_campo, c.nombre_campo) AS NVARCHAR(300)) AS descripcion_item
        FROM SSOMA.INS_PLANTILLA_CAMPO c
        WHERE c.id_plantilla_inspec = @id_inspec;
        RETURN;
      END;

      SELECT
        c.id_campo,
        CAST(c.item_ref AS NVARCHAR(50)) AS item_ref,
        CAST(COALESCE(c.descripcion_item, c.titulo_campo, c.nombre_campo) AS NVARCHAR(300)) AS descripcion_item
      FROM SSOMA.INS_PLANTILLA_CAMPO c
      WHERE c.id_plantilla_inspec = @id_inspec;
      RETURN;
    END;

    SELECT TOP 0
      CAST(NULL AS INT) AS id_campo,
      CAST(NULL AS NVARCHAR(50)) AS item_ref,
      CAST(NULL AS NVARCHAR(300)) AS descripcion_item;
  `;

  const r = await req.query(query);
  return r.recordset || [];
}

async function ensureCamposFromJsonDefinicion(id_plantilla_def, jsonDef) {
  if (!id_plantilla_def || !jsonDef || !Array.isArray(jsonDef.items)) return;

  const pool = await getPool();

  // ¿Ya existen campos para esa definición?
  const exists = await pool.request()
    .input("id_def", sql.Int, Number(id_plantilla_def))
    .query(`
      SELECT COUNT(1) AS n
      FROM SSOMA.INS_PLANTILLA_CAMPO
      WHERE id_plantilla_def = @id_def;
    `);

  const n = Number(exists.recordset?.[0]?.n || 0);
  if (n > 0) return; // ya está sembrado

  // Insertar un campo por ítem del JSON
  // Ajusta valores por defecto si luego quieres "requerido" real, tipo_control real, etc.
  for (let i = 0; i < jsonDef.items.length; i++) {
    const it = jsonDef.items[i];
    const itemRef = String(it?.item_ref ?? it?.id ?? "").trim();
    const etiqueta = String(it?.texto ?? it?.descripcion ?? "").trim();
    const seccion = String(it?.categoria ?? "GENERAL").trim();

    if (!itemRef) continue;

    await pool.request()
      .input("id_def", sql.Int, Number(id_plantilla_def))
      .input("id_tipo_control", sql.Int, 1) // 1 = default (ajusta si tienes catálogo)
      .input("item_ref", sql.NVarChar(50), itemRef)
      .input("etiqueta", sql.NVarChar(300), etiqueta || itemRef)
      .input("requerido", sql.Bit, 0)
      .input("orden", sql.Int, i + 1)
      .input("seccion", sql.NVarChar(120), seccion)
      .input("ayuda", sql.NVarChar(300), null)
      .query(`
        INSERT INTO SSOMA.INS_PLANTILLA_CAMPO
          (id_plantilla_def, id_tipo_control, item_ref, etiqueta, requerido, orden, seccion, ayuda_texto)
        VALUES
          (@id_def, @id_tipo_control, @item_ref, @etiqueta, @requerido, @orden, @seccion, @ayuda);
      `);
  }
}

export default {
  listPlantillas,
  getDefinicion,
  getDefinicionByVersion,
  listarCamposPorPlantilla,
  ensureCamposFromJsonDefinicion,
};