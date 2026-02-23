import repo from "../repositories/inspecciones.repository.js";
import observacionesRepo from "../repositories/observaciones.repository.js";

function validarCatalogoVsOtro({ id_otro, id_cliente, id_servicio }) {
  const esCatalogo = (id_otro == null) && (id_cliente != null) && (id_servicio != null);
  const esOtro = (id_otro != null) && (id_cliente == null) && (id_servicio == null);
  return esCatalogo || esOtro;
}

async function crearInspeccionCabecera({ user, body }) {
  const {
    id_plantilla_inspec,
    id_otro,
    id_estado_inspeccion,
    id_modo_registro,
    id_cliente,
    id_servicio,
    servicio_detalle,
    fecha_inspeccion
  } = body;

  if (!id_plantilla_inspec) {
    return { ok: false, status: 400, message: "id_plantilla_inspec es obligatorio" };
  }

  if (!id_estado_inspeccion || !id_modo_registro) {
    return { ok: false, status: 400, message: "id_estado_inspeccion e id_modo_registro son obligatorios" };
  }
  
  if (!body.id_area) {
    return { ok: false, status: 400, message: "id_area es obligatorio" };
}

  // fecha_inspeccion es NOT NULL en DB → si no viene, usamos ahora
  const fecha = fecha_inspeccion ? new Date(fecha_inspeccion) : new Date();
  if (isNaN(fecha.getTime())) {
    return { ok: false, status: 400, message: "fecha_inspeccion inválida" };
  }

  if (!validarCatalogoVsOtro({ id_otro, id_cliente, id_servicio })) {
    return {
      ok: false,
      status: 400,
      message: "Regla inválida: usa (id_cliente + id_servicio) o usa id_otro (pero no ambos)."
    };
  }

  const insertPayload = {
    id_usuario: user.id_usuario,
    id_plantilla_inspec: Number(id_plantilla_inspec),
    id_otro: id_otro ?? null,
    id_estado_inspeccion: Number(id_estado_inspeccion),
    id_modo_registro: Number(id_modo_registro),
    id_cliente: id_cliente ?? null,
    id_servicio: id_servicio ?? null,
    servicio_detalle: servicio_detalle ?? null,
    fecha_inspeccion: fecha,
    id_area: Number(body.id_area),
  };

  const creado = await repo.crearInspeccionCabecera(insertPayload);
  return { ok: true, status: 201, data: creado };
}

async function listarInspecciones({ user, query }) {
  // filtros opcionales (todos son opcionales)
  const filtros = {
    id_area: query.id_area ? Number(query.id_area) : null,
    id_estado_inspeccion: query.id_estado_inspeccion ? Number(query.id_estado_inspeccion) : null,
    desde: query.desde ? new Date(query.desde) : null,
    hasta: query.hasta ? new Date(query.hasta) : null,
    // por defecto: si luego quieres "mis inspecciones", lo activamos acá
    id_usuario: query.id_usuario ? Number(query.id_usuario) : null
  };

  if (filtros.desde && isNaN(filtros.desde.getTime())) {
    return { ok: false, status: 400, message: "desde inválido (usa ISO: 2026-02-06)" };
  }
  if (filtros.hasta && isNaN(filtros.hasta.getTime())) {
    return { ok: false, status: 400, message: "hasta inválido (usa ISO: 2026-02-06)" };
  }

  const data = await repo.listarInspecciones(filtros);
  return { ok: true, status: 200, data };
}

async function obtenerDetalleInspeccion(id_inspeccion) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion inválido" };
  }

  const cabecera = await repo.obtenerInspeccionPorId(id);
  if (!cabecera) {
    return { ok: false, status: 404, message: "Inspección no encontrada" };
  }

  // Reutiliza tu repo de observaciones (mejor) o hazlo en el mismo repo
  const observaciones = await observacionesRepo.listarPorInspeccion(id);

  return { ok: true, status: 200, data: { cabecera, observaciones } };
}

async function obtenerDetalleInspeccionFull(id_inspeccion) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion inválido" };
  }

  const cabecera = await repo.obtenerInspeccionPorId(id);
  if (!cabecera) {
    return { ok: false, status: 404, message: "Inspección no encontrada" };
  }
  // 1) Observaciones base
  const observaciones = await observacionesRepo.listarPorInspeccion(id);

  // 2) Evidencias por observación + acciones + evidencias por acción
  const out = [];
  for (const o of observaciones) {
    const evidObs = await observacionesRepo.listarEvidenciasPorObservacion(o.id_observacion);
    const acciones = await observacionesRepo.listarAccionesPorObservacion(o.id_observacion);

    // Para cada acción, adjuntar evidencias de acción
    const accionesOut = [];
    for (const a of acciones) {
      const evidAcc = await observacionesRepo.listarEvidenciasPorAccion(a.id_accion);
      accionesOut.push({ ...a, evidencias: evidAcc });
    }

    out.push({
      ...o,
      evidencias: evidObs,
      acciones: accionesOut
    });
  }

  return { ok: true, status: 200, data: { cabecera, observaciones: out } };
}

async function actualizarEstadoInspeccion({ id_inspeccion, body }) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion inválido" };
  }

  const nuevo = Number(body?.id_estado_inspeccion);
  if (!nuevo || Number.isNaN(nuevo)) {
    return { ok: false, status: 400, message: "id_estado_inspeccion es obligatorio" };
  }

  // Validar que exista inspección y leer su estado actual
  const actual = await repo.obtenerEstadoInspeccion(id);
  if (!actual) {
    return { ok: false, status: 404, message: "Inspección no encontrada" };
  }

  const estadoActual = actual.id_estado_inspeccion;

  // Reglas mínimas de transición (puedes afinar después)
  // BORRADOR(1) -> REGISTRADA(2) o ANULADA(5)
  // REGISTRADA(2) -> ENVIADA(3) o ANULADA(5)
  // ENVIADA(3) -> CERRADA(4) o ANULADA(5)
  // CERRADA(4) -> (no cambia)
  // ANULADA(5) -> (no cambia)
  const permitidas = {
    1: [2, 5],
    2: [3, 5],
    3: [4, 5],
    4: [],
    5: []
  };

  if (!permitidas[estadoActual]?.includes(nuevo)) {
    return {
      ok: false,
      status: 400,
      message: `Transición no permitida: ${estadoActual} -> ${nuevo}`
    };
  }

  const updated = await repo.actualizarEstadoInspeccion({ id_inspeccion: id, id_estado_inspeccion: nuevo });
  return { ok: true, status: 200, data: updated };
}

async function actualizarEstadoObservacion({ id_observacion, body }) {
  const id_estado_observacion = Number(body?.id_estado_observacion);

  if (!id_estado_observacion) {
    return { ok: false, status: 400, message: "Falta id_estado_observacion." };
  }

  const actual = await observacionesRepo.obtenerEstadoObservacion(id_observacion);
  if (!actual) return { ok: false, status: 404, message: "Observación no existe." };

  // Si quieren CERRAR (3): validar acciones pendientes
  if (id_estado_observacion === 3) {
    const pendientes = await observacionesRepo.contarAccionesNoFinalizadas(id_observacion);
    if (pendientes > 0) {
      return {
        ok: false,
        status: 409,
        message: `No se puede cerrar: hay ${pendientes} acción(es) pendiente(s).`,
      };
    }
  }

  const updated = await observacionesRepo.actualizarEstadoObservacion({
    id_observacion,
    id_estado_observacion,
  });

  return { ok: true, status: 200, data: updated };
}

async function actualizarEstadoAccion({ id_accion, body }) {
  const id_estado_accion = Number(body?.id_estado_accion);

  if (!id_estado_accion) {
    return { ok: false, status: 400, message: "Falta id_estado_accion." };
  }

  const actual = await observacionesRepo.obtenerEstadoAccion(id_accion);
  if (!actual) return { ok: false, status: 404, message: "Acción no existe." };

  const updated = await observacionesRepo.actualizarEstadoAccion({
    id_accion,
    id_estado_accion,
  });

  return { ok: true, status: 200, data: updated };
}

async function crearInspeccionCompleta({ user, body }) {
  const cabecera = body?.cabecera;
  const respuestas = body?.respuestas;
  const participantes = body?.participantes || [];

  if (!cabecera) return { ok: false, status: 400, message: "Falta cabecera" };
  if (!Array.isArray(respuestas) || !respuestas.length) {
    return { ok: false, status: 400, message: "Falta respuestas[]" };
  }

  // Validación fuerte: si estado=MALO, observación + acción obligatorias
  for (const r of respuestas) {
    if (r.estado === "MALO") {
      if (!r.observacion || r.observacion.trim().length < 10) {
        return { ok: false, status: 400, message: `Observación obligatoria en ${r.id_item}` };
      }
      if (!r.accion?.que || !r.accion?.quien || !r.accion?.cuando) {
        return { ok: false, status: 400, message: `Acción obligatoria en ${r.id_item}` };
      }
    }
  }

  const data = await repo.crearInspeccionCompleta({
    user,
    cabecera,
    respuestas,
    participantes
  });

  return { ok: true, status: 201, data };
}

export default {
  crearInspeccionCabecera,
  listarInspecciones,
  obtenerDetalleInspeccion,
  obtenerDetalleInspeccionFull,
  crearInspeccionCompleta,
  actualizarEstadoInspeccion,
  actualizarEstadoObservacion,
  actualizarEstadoAccion
};
