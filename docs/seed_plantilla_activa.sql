/*
  Seed opcional para entorno vacio:
  Inserta 1 plantilla activa de ejemplo en SSOMA.INS_PLANTILLA_INSPECCION
  solo si no existe ninguna activa.
*/

SET NOCOUNT ON;

DECLARE @estadoCol SYSNAME = NULL;
IF COL_LENGTH('SSOMA.INS_PLANTILLA_INSPECCION', 'estado') IS NOT NULL SET @estadoCol = 'estado';
ELSE IF COL_LENGTH('SSOMA.INS_PLANTILLA_INSPECCION', 'estado_plantilla') IS NOT NULL SET @estadoCol = 'estado_plantilla';

IF @estadoCol IS NULL
BEGIN
  RAISERROR('No existe columna estado ni estado_plantilla en SSOMA.INS_PLANTILLA_INSPECCION.', 16, 1);
  RETURN;
END;

DECLARE @existsSql NVARCHAR(MAX) = N'
  SELECT @n = COUNT(1)
  FROM SSOMA.INS_PLANTILLA_INSPECCION
  WHERE TRY_CONVERT(INT, ' + QUOTENAME(@estadoCol) + N') = 1
     OR UPPER(LTRIM(RTRIM(TRY_CONVERT(NVARCHAR(30), ' + QUOTENAME(@estadoCol) + N')))) IN (N''ACTIVO'', N''HABILITADO'');
';

DECLARE @n INT = 0;
EXEC sp_executesql @existsSql, N'@n INT OUTPUT', @n=@n OUTPUT;

IF @n > 0
BEGIN
  PRINT 'Ya existen plantillas activas. Seed omitido.';
  RETURN;
END;

DECLARE @insertSql NVARCHAR(MAX) = N'
  INSERT INTO SSOMA.INS_PLANTILLA_INSPECCION
    (codigo_formato, nombre_formato, version_actual, ' + QUOTENAME(@estadoCol) + N', fecha_creacion)
  VALUES
    (N''PLT-DEMO-001'', N''Plantilla Demo Lavaojos'', 1, 1, SYSDATETIME());
';

EXEC sp_executesql @insertSql;
PRINT 'Se inserto plantilla activa demo: PLT-DEMO-001';
