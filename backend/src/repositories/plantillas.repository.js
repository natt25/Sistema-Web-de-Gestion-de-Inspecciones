import { getPool, sql } from "../config/database.js";

async function listActivas() {
  const q = `
    SELECT id_plantilla_inspec, codigo_formato, nombre_formato, version_actual
    FROM SSOMA.INS_PLANTILLA_INSPECCION
    WHERE estado = 1
    ORDER BY nombre_formato;
  `;
  const pool = await getPool();
  const r = await pool.request().query(q);
  return r.recordset;
}

async function getDefinicionActual(id_plantilla_inspec) {
  const q = `
    SELECT TOP 1 d.id_plantilla_def, d.version, d.json_definicion
    FROM SSOMA.INS_PLANTILLA_DEFINICION d
    JOIN SSOMA.INS_PLANTILLA_INSPECCION p ON p.id_plantilla_inspec = d.id_plantilla_inspec
    WHERE d.id_plantilla_inspec = @id
      AND d.version = p.version_actual
    ORDER BY d.version DESC;
  `;
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.Int, id_plantilla_inspec);
  const r = await req.query(q);
  return r.recordset[0] || null;
}

export default { listActivas, getDefinicionActual };