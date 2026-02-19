import { sql, getPool } from "../config/database.js";

async function listarPendientes({ dias = 7, solo_mias = 0, id_usuario }) {
  const pool = await getPool();
  const request = pool.request();

  request.input("dias", sql.Int, dias);
  request.input("solo_mias", sql.Bit, solo_mias ? 1 : 0);
  request.input("id_usuario", sql.Int, id_usuario);

  const query = `
    DECLARE @hoy DATE = CAST(SYSDATETIME() AS DATE);

    -- dni del usuario logueado (para filtro "solo_mias")
    DECLARE @dni_usuario NVARCHAR(15) =
      (SELECT dni FROM SSOMA.INS_USUARIO WHERE id_usuario = @id_usuario);

    SELECT
      a.id_accion,
      a.id_observacion,
      a.desc_accion,
      a.fecha_compromiso,
      ea.nombre_estado AS estado,
      CASE
        WHEN a.fecha_compromiso IS NULL THEN NULL
        ELSE DATEDIFF(DAY, @hoy, a.fecha_compromiso)
      END AS dias_restantes,
      -- Responsable (interno por dni o externo por nombre)
      CASE
        WHEN ar.dni IS NOT NULL THEN ar.dni
        ELSE ar.externo_responsable_nombre
      END AS responsable
    FROM SSOMA.INS_ACCION a
    JOIN SSOMA.INS_CAT_ESTADO_ACCION ea
      ON ea.id_estado_accion = a.id_estado_accion
    JOIN SSOMA.INS_ACCION_RESPONSABLE ar
      ON ar.id_acc_responsable = a.id_acc_responsable
    WHERE
      -- Pendientes = PENDIENTE o EN_PROCESO (no incluir CUMPLIDA/NO_APLICA)
      ea.nombre_estado IN (N'PENDIENTE', N'EN_PROCESO')
      AND (
        a.fecha_compromiso IS NULL
        OR a.fecha_compromiso <= DATEADD(DAY, @dias, @hoy)
      )
      AND (
        @solo_mias = 0
        OR (ar.dni IS NOT NULL AND ar.dni = @dni_usuario)
      )
    ORDER BY
      CASE WHEN a.fecha_compromiso IS NULL THEN 1 ELSE 0 END,
      a.fecha_compromiso ASC,
      a.id_accion DESC;
  `;

  const result = await request.query(query);
  return result.recordset;
}

export default { listarPendientes };
