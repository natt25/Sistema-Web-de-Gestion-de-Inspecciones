import { sql, getPool } from "../config/database.js";

async function insert(evt) {
  const query = `
    INSERT INTO SSOMA.INS_AUDITORIA_EVENTO
      (id_usuario, accion, entidad, id_entidad, modo_cliente, exito, detalle, ip_origen, user_agent)
    VALUES
      (@id_usuario, @accion, @entidad, @id_entidad, @modo_cliente, @exito, @detalle, @ip_origen, @user_agent);
  `;

  const pool = await getPool();
  const req = pool.request();

  req.input("id_usuario", sql.Int, evt.id_usuario ?? null);
  req.input("accion", sql.NVarChar(80), evt.accion);
  req.input("entidad", sql.NVarChar(50), evt.entidad ?? null);
  req.input("id_entidad", sql.NVarChar(60), evt.id_entidad ?? null);
  req.input("modo_cliente", sql.NVarChar(20), evt.modo_cliente ?? "UNKNOWN");
  req.input("exito", sql.Bit, evt.exito ? 1 : 0);
  req.input("detalle", sql.NVarChar(400), evt.detalle ?? null);
  req.input("ip_origen", sql.NVarChar(50), evt.ip_origen ?? null);
  req.input("user_agent", sql.NVarChar(300), evt.user_agent ?? null);

  await req.query(query);
}

async function list({ top = 200, from = null, to = null, id_usuario = null, accion = null }) {
  const query = `
    SELECT TOP (@top) *
    FROM SSOMA.INS_AUDITORIA_EVENTO
    WHERE (@from IS NULL OR fecha_evento >= @from)
      AND (@to IS NULL OR fecha_evento <= @to)
      AND (@id_usuario IS NULL OR id_usuario = @id_usuario)
      AND (@accion IS NULL OR accion = @accion)
    ORDER BY fecha_evento DESC;
  `;

  const pool = await getPool();
  const req = pool.request();

  req.input("top", sql.Int, top);
  req.input("from", sql.DateTime2, from);
  req.input("to", sql.DateTime2, to);
  req.input("id_usuario", sql.Int, id_usuario);
  req.input("accion", sql.NVarChar(80), accion);

  const result = await req.query(query);
  return result.recordset;
}

export default { insert, list };
