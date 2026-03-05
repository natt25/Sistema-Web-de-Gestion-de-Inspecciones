import { sql, getPool } from "../config/database.js";

async function listarPendientes({ dias = 7, solo_mias = 0, estado = "ALL", id_usuario = null }) {
  const pool = await getPool();
  const request = pool.request();

  const estadoNormalizado = String(estado || "ALL").trim().toUpperCase().replace(/[-\s]+/g, "_");

  request.input("dias", sql.Int, dias === null ? null : dias);
  request.input("solo_mias", sql.Bit, solo_mias ? 1 : 0);
  request.input("estado", sql.NVarChar(40), estadoNormalizado || "ALL");
  request.input("id_usuario", sql.Int, id_usuario ?? null);

  const query = `
    DECLARE @hoy DATE = CAST(SYSDATETIME() AS DATE);

    DECLARE @dni_usuario NVARCHAR(15) = (
      SELECT TOP 1 dni
      FROM SSOMA.INS_USUARIO
      WHERE id_usuario = @id_usuario
    );

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
      CASE
        WHEN e.nombre IS NOT NULL THEN e.nombre
        ELSE ar.externo_responsable_nombre
      END AS responsable,
      i.id_inspeccion,
      i.id_plantilla_inspec,
      p.codigo_formato,
      p.nombre_formato
    FROM SSOMA.INS_ACCION a
    JOIN SSOMA.INS_CAT_ESTADO_ACCION ea
      ON ea.id_estado_accion = a.id_estado_accion
    JOIN SSOMA.INS_ACCION_RESPONSABLE ar
      ON ar.id_acc_responsable = a.id_acc_responsable
    LEFT JOIN SSOMA.EMP_EMPLEADO e
      ON e.dni = ar.dni
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = a.id_observacion
    JOIN SSOMA.INS_INSPECCION i
      ON i.id_inspeccion = o.id_inspeccion
    JOIN SSOMA.INS_PLANTILLA_INSPECCION p
      ON p.id_plantilla_inspec = i.id_plantilla_inspec
    WHERE
      (@solo_mias = 0 OR (@dni_usuario IS NOT NULL AND ar.dni = @dni_usuario))
      AND (
        @dias IS NULL
        OR a.fecha_compromiso IS NULL
        OR a.fecha_compromiso <= DATEADD(DAY, @dias, @hoy)
      )
      AND (
        @estado = 'ALL'
        OR UPPER(REPLACE(REPLACE(LTRIM(RTRIM(ea.nombre_estado)), ' ', '_'), '-', '_')) = @estado
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
