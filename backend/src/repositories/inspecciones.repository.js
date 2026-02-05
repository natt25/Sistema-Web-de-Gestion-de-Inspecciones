const { sql, getPool } = require("../config/database");

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

module.exports = { crearInspeccionCabecera };
