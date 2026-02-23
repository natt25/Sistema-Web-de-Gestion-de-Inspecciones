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

export default { listPlantillas, getDefinicion, getDefinicionByVersion };
