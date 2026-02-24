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
    fecha_inspeccion,
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

  const fecha = fecha_inspeccion ? new Date(fecha_inspeccion) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    return { ok: false, status: 400, message: "fecha_inspeccion invalida" };
  }

  if (!validarCatalogoVsOtro({ id_otro, id_cliente, id_servicio })) {
    return {
      ok: false,
      status: 400,
      message: "Regla invalida: usa (id_cliente + id_servicio) o usa id_otro (pero no ambos).",
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

async function listarInspecciones({ query }) {
  const filtros = {
    id_area: query.id_area ? Number(query.id_area) : null,
    id_estado_inspeccion: query.id_estado_inspeccion ? Number(query.id_estado_inspeccion) : null,
    desde: query.desde ? new Date(query.desde) : null,
    hasta: query.hasta ? new Date(query.hasta) : null,
    id_usuario: query.id_usuario ? Number(query.id_usuario) : null,
  };

  if (filtros.desde && Number.isNaN(filtros.desde.getTime())) {
    return { ok: false, status: 400, message: "desde invalido (usa ISO: 2026-02-06)" };
  }
  if (filtros.hasta && Number.isNaN(filtros.hasta.getTime())) {
    return { ok: false, status: 400, message: "hasta invalido (usa ISO: 2026-02-06)" };
  }

  const data = await repo.listarInspecciones(filtros);
  return { ok: true, status: 200, data };
}

async function obtenerDetalleInspeccion(id_inspeccion) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion invalido" };
  }

  const cabecera = await repo.obtenerInspeccionPorId(id);
  if (!cabecera) {
    return { ok: false, status: 404, message: "Inspeccion no encontrada" };
  }

  const observaciones = await observacionesRepo.listarPorInspeccion(id);
  return { ok: true, status: 200, data: { cabecera, observaciones } };
}

async function obtenerDetalleInspeccionFull(id_inspeccion) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion invalido" };
  }

  const cabecera = await repo.obtenerInspeccionPorId(id);
  if (!cabecera) {
    return { ok: false, status: 404, message: "Inspeccion no encontrada" };
  }

  const participantes = await repo.listarParticipantesPorInspeccion(id);
  const respuestas = await repo.listarRespuestasPorInspeccion(id);
  const observaciones = await observacionesRepo.listarPorInspeccion(id);

  const out = [];
  for (const o of observaciones) {
    const evidObs = await observacionesRepo.listarEvidenciasPorObservacion(o.id_observacion);
    const acciones = await observacionesRepo.listarAccionesPorObservacion(o.id_observacion);

    const accionesOut = [];
    for (const a of acciones) {
      const evidAcc = await observacionesRepo.listarEvidenciasPorAccion(a.id_accion);
      accionesOut.push({ ...a, evidencias: evidAcc });
    }

    out.push({
      ...o,
      evidencias: evidObs,
      acciones: accionesOut,
    });
  }

  return {
    ok: true,
    status: 200,
    data: {
      cabecera,
      participantes: Array.isArray(participantes) ? participantes : [],
      respuestas: Array.isArray(respuestas) ? respuestas : [],
      observaciones: out,
    },
  };
}

async function actualizarEstadoInspeccion({ id_inspeccion, body }) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion invalido" };
  }

  const nuevo = Number(body?.id_estado_inspeccion);
  if (!nuevo || Number.isNaN(nuevo)) {
    return { ok: false, status: 400, message: "id_estado_inspeccion es obligatorio" };
  }

  const actual = await repo.obtenerEstadoInspeccion(id);
  if (!actual) {
    return { ok: false, status: 404, message: "Inspeccion no encontrada" };
  }

  const estadoActual = actual.id_estado_inspeccion;
  const permitidas = {
    1: [2, 5],
    2: [3, 5],
    3: [4, 5],
    4: [],
    5: [],
  };

  if (!permitidas[estadoActual]?.includes(nuevo)) {
    return {
      ok: false,
      status: 400,
      message: `Transicion no permitida: ${estadoActual} -> ${nuevo}`,
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
  if (!actual) return { ok: false, status: 404, message: "Observacion no existe." };

  if (id_estado_observacion === 3) {
    const pendientes = await observacionesRepo.contarAccionesNoFinalizadas(id_observacion);
    if (pendientes > 0) {
      return {
        ok: false,
        status: 409,
        message: `No se puede cerrar: hay ${pendientes} accion(es) pendiente(s).`,
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
  if (!actual) return { ok: false, status: 404, message: "Accion no existe." };

  const updated = await observacionesRepo.actualizarEstadoAccion({
    id_accion,
    id_estado_accion,
  });

  return { ok: true, status: 200, data: updated };
}

function badRequest(message, data) {
  return { ok: false, status: 400, message, data };
}

async function crearInspeccionCompleta({ user, body }) {
  const cab = body?.cabecera;
  const respuestas = Array.isArray(body?.respuestas) ? body.respuestas : [];
  const participantes = Array.isArray(body?.participantes) ? body.participantes : [];

  if (!cab?.id_plantilla_inspec) return badRequest("Falta cabecera.id_plantilla_inspec");
  if (!cab?.id_area) return badRequest("Falta cabecera.id_area");
  if (!cab?.fecha_inspeccion) return badRequest("Falta cabecera.fecha_inspeccion");
  if (!respuestas.length) return badRequest("Falta respuestas");

  // ✅ OJO: NO VALIDAMOS id_campo aquí.
  // Solo validamos que exista un item_ref o id para identificar el item.
  const faltanRefs = respuestas.some((r) => !String(r?.item_ref ?? r?.id ?? r?.item_id ?? "").trim());
  if (faltanRefs) return badRequest("Falta item_ref en una o más respuestas");

  const cabeceraToSave = {
    ...cab,
    id_usuario: user?.id_usuario ?? null,
  };

  const json_respuestas = JSON.stringify({
    cabecera: cabeceraToSave,
    participantes,
    respuestas,
    meta: { schema: "v1-json", savedAt: new Date().toISOString() },
  });

  // ✅ guarda cabecera + JSON (NO inserta INS_RESPUESTA_ITEM)
  const created = await repo.crearInspeccionYGuardarJSON({
    cabecera: cabeceraToSave,
    json_respuestas,
    participantes,
  });

  return {
    ok: true,
    status: 201,
    data: created, // {id_inspeccion, id_respuesta}
  };
}

export default {
  crearInspeccionCabecera,
  listarInspecciones,
  obtenerDetalleInspeccion,
  obtenerDetalleInspeccionFull,
  crearInspeccionCompleta,
  actualizarEstadoInspeccion,
  actualizarEstadoObservacion,
  actualizarEstadoAccion,
};
