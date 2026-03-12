function cleanPart(value) {
  return String(value ?? "").trim();
}

export function buildEmpleadoDisplayName(emp) {
  const apellidoPaterno = cleanPart(emp?.apellido_paterno);
  const apellidoMaterno = cleanPart(emp?.apellido_materno);
  const nombres = cleanPart(emp?.nombres ?? emp?.nombre);
  const apellidos = cleanPart(emp?.apellidos ?? emp?.apellido);
  const fallback = cleanPart(
    emp?.apellidos_nombres ??
    emp?.nombreCompleto ??
    emp?.nombre_completo ??
    emp?.label ??
    emp?.name
  );

  const apellidosSeparados = [apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim();

  return (
    [apellidosSeparados, nombres].filter(Boolean).join(" ").trim() ||
    [apellidos, nombres].filter(Boolean).join(" ").trim() ||
    fallback
  );
}

export function buildEmpleadoOptionLabel(emp) {
  const full = buildEmpleadoDisplayName(emp);
  const dni = cleanPart(emp?.dni);
  return dni ? `${full} (${dni})`.trim() : full;
}
