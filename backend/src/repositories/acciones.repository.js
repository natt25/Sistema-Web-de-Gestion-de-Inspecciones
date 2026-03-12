import { sql, getPool } from "../config/database.js";

async function listarPendientes({
  dias = 7,
  solo_mias = 0,
  estado = "ALL",
  id_usuario = null,
  id_plantilla_inspec = null,
}) {
  const pool = await getPool();
  const request = pool.request();

  const estadoNormalizado = String(estado || "ALL").trim().toUpperCase().replace(/[-\s]+/g, "_");

  request.input("dias", sql.Int, dias === null ? null : dias);
  request.input("solo_mias", sql.Bit, solo_mias ? 1 : 0);
  request.input("estado", sql.NVarChar(40), estadoNormalizado || "ALL");
  request.input("id_usuario", sql.Int, id_usuario ?? null);
  request.input("id_plantilla_inspec", sql.Int, id_plantilla_inspec ?? null);

  const query = `
    DECLARE @hoy DATE = CAST(SYSDATETIME() AS DATE);

    DECLARE @dni_usuario NVARCHAR(15) = (
      SELECT TOP 1 dni
      FROM SSOMA.INS_USUARIO
      WHERE id_usuario = @id_usuario
    );

    ;WITH empleados AS (
      SELECT
        LTRIM(RTRIM(CAST(dni AS NVARCHAR(30)))) AS dni_normalizado,
        NULLIF(
          LTRIM(RTRIM(CONCAT(
            CAST(ISNULL(apellido_paterno, '') AS NVARCHAR(150)),
            ' ',
            CAST(ISNULL(apellido_materno, '') AS NVARCHAR(150)),
            ' ',
            CAST(ISNULL(nombres, '') AS NVARCHAR(150))
          ))),
          ''
        ) AS nombre_completo
      FROM SSOMA.V_EMPLEADO
    ),
    base AS (
      SELECT
        i.id_inspeccion,
        i.id_plantilla_inspec,
        p.codigo_formato,
        p.nombre_formato,
        a.id_accion,
        a.desc_accion,
        a.fecha_compromiso,
        ea.nombre_estado AS estado,
        CASE
          WHEN a.fecha_compromiso IS NULL THEN NULL
          ELSE DATEDIFF(DAY, @hoy, a.fecha_compromiso)
        END AS dias_restantes,
        COALESCE(ve.nombre_completo, NULLIF(LTRIM(RTRIM(ar.externo_responsable_nombre)), '')) AS responsable_nombre
      FROM SSOMA.INS_ACCION a
      JOIN SSOMA.INS_CAT_ESTADO_ACCION ea
        ON ea.id_estado_accion = a.id_estado_accion
      JOIN SSOMA.INS_ACCION_RESPONSABLE ar
        ON ar.id_acc_responsable = a.id_acc_responsable
      LEFT JOIN empleados ve
        ON ve.dni_normalizado = LTRIM(RTRIM(CAST(ar.dni AS NVARCHAR(30))))
      JOIN SSOMA.INS_OBSERVACION o
        ON o.id_observacion = a.id_observacion
      JOIN SSOMA.INS_INSPECCION i
        ON i.id_inspeccion = o.id_inspeccion
      JOIN SSOMA.INS_PLANTILLA_INSPECCION p
        ON p.id_plantilla_inspec = i.id_plantilla_inspec
      WHERE
        (
          @solo_mias = 0
          OR (
            @dni_usuario IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM SSOMA.INS_OBSERVACION o2
              JOIN SSOMA.INS_ACCION a2
                ON a2.id_observacion = o2.id_observacion
              JOIN SSOMA.INS_ACCION_RESPONSABLE ar2
                ON ar2.id_acc_responsable = a2.id_acc_responsable
              WHERE
                o2.id_inspeccion = i.id_inspeccion
                AND LTRIM(RTRIM(CAST(ar2.dni AS NVARCHAR(30)))) = LTRIM(RTRIM(@dni_usuario))
            )
          )
        )
        AND (
          @dias IS NULL
          OR a.fecha_compromiso IS NULL
          OR a.fecha_compromiso <= DATEADD(DAY, @dias, @hoy)
        )
        AND (
          @estado = 'ALL'
          OR UPPER(REPLACE(REPLACE(LTRIM(RTRIM(ea.nombre_estado)), ' ', '_'), '-', '_')) = @estado
        )
        AND (
          @id_plantilla_inspec IS NULL
          OR i.id_plantilla_inspec = @id_plantilla_inspec
        )
    ),
    responsables_por_inspeccion AS (
      SELECT
        b.id_inspeccion,
        COUNT(*) AS total_responsables,
        STRING_AGG(b.responsable_nombre, ', ') AS responsables
      FROM (
        SELECT DISTINCT
          id_inspeccion,
          responsable_nombre
        FROM base
        WHERE NULLIF(LTRIM(RTRIM(responsable_nombre)), '') IS NOT NULL
      ) b
      GROUP BY b.id_inspeccion
    )
    SELECT
      b.id_inspeccion,
      b.id_plantilla_inspec,
      b.codigo_formato,
      b.nombre_formato,
      STRING_AGG(NULLIF(LTRIM(RTRIM(b.desc_accion)), ''), ' | ') AS desc_accion,
      MIN(b.fecha_compromiso) AS fecha_compromiso,
      MIN(CASE WHEN b.fecha_compromiso IS NULL THEN 1 ELSE 0 END) AS _null_first,
      MIN(b.dias_restantes) AS dias_restantes,
      CASE
        WHEN COUNT(DISTINCT b.estado) = 1 THEN MAX(b.estado)
        ELSE 'VARIOS'
      END AS estado,
      CASE
        WHEN ISNULL(r.total_responsables, 0) > 3 THEN 'VARIOS'
        ELSE ISNULL(r.responsables, '-')
      END AS responsables
    FROM base b
    LEFT JOIN responsables_por_inspeccion r
      ON r.id_inspeccion = b.id_inspeccion
    GROUP BY
      b.id_inspeccion,
      b.id_plantilla_inspec,
      b.codigo_formato,
      b.nombre_formato,
      r.total_responsables,
      r.responsables
    ORDER BY
      MIN(CASE WHEN b.fecha_compromiso IS NULL THEN 1 ELSE 0 END),
      MIN(b.fecha_compromiso) ASC,
      b.id_inspeccion DESC;
  `;

  const result = await request.query(query);
  return result.recordset;
}

async function contarPendientesPorInspeccion({
  dias = 7,
  solo_mias = 0,
  estado = "ALL",
  id_usuario = null,
  id_plantilla_inspec = null,
}) {
  const pool = await getPool();
  const request = pool.request();

  const estadoNormalizado = String(estado || "ALL").trim().toUpperCase().replace(/[-\s]+/g, "_");

  request.input("dias", sql.Int, dias === null ? null : dias);
  request.input("solo_mias", sql.Bit, solo_mias ? 1 : 0);
  request.input("estado", sql.NVarChar(40), estadoNormalizado || "ALL");
  request.input("id_usuario", sql.Int, id_usuario ?? null);
  request.input("id_plantilla_inspec", sql.Int, id_plantilla_inspec ?? null);

  const query = `
    DECLARE @hoy DATE = CAST(SYSDATETIME() AS DATE);

    DECLARE @dni_usuario NVARCHAR(15) = (
      SELECT TOP 1 dni
      FROM SSOMA.INS_USUARIO
      WHERE id_usuario = @id_usuario
    );

    SELECT COUNT(DISTINCT i.id_inspeccion) AS total
    FROM SSOMA.INS_ACCION a
    JOIN SSOMA.INS_CAT_ESTADO_ACCION ea
      ON ea.id_estado_accion = a.id_estado_accion
    JOIN SSOMA.INS_ACCION_RESPONSABLE ar
      ON ar.id_acc_responsable = a.id_acc_responsable
    JOIN SSOMA.INS_OBSERVACION o
      ON o.id_observacion = a.id_observacion
    JOIN SSOMA.INS_INSPECCION i
      ON i.id_inspeccion = o.id_inspeccion
    WHERE
      (
        @solo_mias = 0
        OR (
          @dni_usuario IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM SSOMA.INS_OBSERVACION o2
            JOIN SSOMA.INS_ACCION a2
              ON a2.id_observacion = o2.id_observacion
            JOIN SSOMA.INS_ACCION_RESPONSABLE ar2
              ON ar2.id_acc_responsable = a2.id_acc_responsable
            WHERE
              o2.id_inspeccion = i.id_inspeccion
              AND LTRIM(RTRIM(CAST(ar2.dni AS NVARCHAR(30)))) = LTRIM(RTRIM(@dni_usuario))
          )
        )
      )
      AND (
        @dias IS NULL
        OR a.fecha_compromiso IS NULL
        OR a.fecha_compromiso <= DATEADD(DAY, @dias, @hoy)
      )
      AND (
        @estado = 'ALL'
        OR UPPER(REPLACE(REPLACE(LTRIM(RTRIM(ea.nombre_estado)), ' ', '_'), '-', '_')) = @estado
      )
      AND (
        @id_plantilla_inspec IS NULL
        OR i.id_plantilla_inspec = @id_plantilla_inspec
      );
  `;

  const result = await request.query(query);
  return Number(result.recordset?.[0]?.total || 0);
}

export default { listarPendientes, contarPendientesPorInspeccion };
