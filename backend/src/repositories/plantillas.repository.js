import { sql, getPool } from "../config/database.js";

async function listPlantillas() {
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
  const pool = await getPool();
  const r = await pool.request().query(q);
  return r.recordset;
}

async function getDefinicion(id_plantilla_inspec) {
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
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.Int, id_plantilla_inspec);
  const r = await req.query(q);
  return r.recordset[0] || null;
}

async function getDefinicionByVersion(id_plantilla_inspec, version) {
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
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.Int, id_plantilla_inspec);
  req.input("version", sql.Int, version);
  const r = await req.query(q);
  return r.recordset[0] || null;
}

export default { listPlantillas, getDefinicion, getDefinicionByVersion };