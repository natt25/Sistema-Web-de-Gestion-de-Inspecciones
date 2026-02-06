const repo = require("../repositories/observaciones.repository");
const inspeccionesRepo = require("../repositories/inspecciones.repository");

async function crearObservacion({ id_inspeccion, body }) {
  const {
    id_nivel_riesgo,
    id_estado_observacion,
    item_ref,
    desc_observacion
  } = body;

  if (!id_nivel_riesgo || !id_estado_observacion || !desc_observacion) {
    return {
      ok: false,
      status: 400,
      message: "id_nivel_riesgo, id_estado_observacion y desc_observacion son obligatorios"
    };
  }

  const payload = {
    id_inspeccion: Number(id_inspeccion),
    id_nivel_riesgo: Number(id_nivel_riesgo),
    id_estado_observacion: Number(id_estado_observacion),
    item_ref: item_ref ?? null,
    desc_observacion
  };

  const creado = await repo.crearObservacion(payload);
  return { ok: true, status: 201, data: creado };
}

async function listarPorInspeccion(id_inspeccion) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_inspeccion inválido" };
  }

  const data = await repo.listarPorInspeccion(id);
  return { ok: true, status: 200, data };
}

async function crearEvidenciaObservacion({ id_observacion, body }) {
  const id = Number(id_observacion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_observacion inválido" };
  }

  const {
    archivo_nombre,
    archivo_ruta,
    mime_type,
    tamano_bytes,
    hash_archivo,
    capturada_en
  } = body;

  if (!archivo_nombre || !archivo_ruta || !mime_type || !tamano_bytes || !hash_archivo) {
    return {
      ok: false,
      status: 400,
      message: "archivo_nombre, archivo_ruta, mime_type, tamano_bytes y hash_archivo son obligatorios"
    };
  }

  const bytes = Number(tamano_bytes);
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) {
    return { ok: false, status: 400, message: "tamano_bytes inválido" };
  }

  const capturada = capturada_en ? new Date(capturada_en) : null;
  if (capturada_en && isNaN(capturada.getTime())) {
    return { ok: false, status: 400, message: "capturada_en inválido" };
  }

  // estado_sync por defecto: PENDIENTE (id=1, según tu seed)
  const payload = {
    id_observacion: id,
    id_estado_sync: 1,
    archivo_nombre,
    archivo_ruta,
    mime_type,
    tamano_bytes: bytes,
    hash_archivo,
    capturada_en: capturada
  };

  const creado = await repo.crearEvidenciaObservacion(payload);
  return { ok: true, status: 201, data: creado };
}

async function listarEvidenciasPorObservacion(id_observacion) {
  const id = Number(id_observacion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_observacion inválido" };
  }

  const data = await repo.listarEvidenciasPorObservacion(id);
  return { ok: true, status: 200, data };
}

async function crearAccionObservacion({ id_observacion, body }) {
  const idObs = Number(id_observacion);
  if (!idObs || Number.isNaN(idObs)) {
    return { ok: false, status: 400, message: "id_observacion inválido" };
  }

  const {
    desc_accion,
    fecha_compromiso,
    item_ref,
    id_estado_accion,
    responsable_interno_dni,
    responsable_externo_nombre,
    responsable_externo_cargo
  } = body;

  if (!desc_accion) {
    return { ok: false, status: 400, message: "desc_accion es obligatorio" };
  }

  const estadoAcc = id_estado_accion ? Number(id_estado_accion) : 1; // default PENDIENTE = 1
  if (!estadoAcc || Number.isNaN(estadoAcc)) {
    return { ok: false, status: 400, message: "id_estado_accion inválido" };
  }

  // Validar responsable interno vs externo
  const esInterno = !!responsable_interno_dni && !responsable_externo_nombre && !responsable_externo_cargo;
  const esExterno = !responsable_interno_dni && !!responsable_externo_nombre && !!responsable_externo_cargo;

  if (!esInterno && !esExterno) {
    return {
      ok: false,
      status: 400,
      message: "Responsable inválido: usa responsable_interno_dni O (responsable_externo_nombre + responsable_externo_cargo)."
    };
  }

  const fecha = fecha_compromiso ? new Date(fecha_compromiso) : null;
  if (fecha_compromiso && isNaN(fecha.getTime())) {
    return { ok: false, status: 400, message: "fecha_compromiso inválida (usa 2026-02-06)" };
  }

  const payload = {
    id_observacion: idObs,
    id_estado_accion: estadoAcc,
    desc_accion,
    fecha_compromiso: fecha ? new Date(fecha.toISOString().slice(0, 10)) : null, // guarda DATE
    item_ref: item_ref ?? null,
    responsable: {
      dni: responsable_interno_dni ?? null,
      externo_nombre: responsable_externo_nombre ?? null,
      externo_cargo: responsable_externo_cargo ?? null
    }
  };

  const creado = await repo.crearAccionObservacion(payload);
  return { ok: true, status: 201, data: creado };
}

async function listarAccionesPorObservacion(id_observacion) {
  const id = Number(id_observacion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_observacion inválido" };
  }

  const data = await repo.listarAccionesPorObservacion(id);
  return { ok: true, status: 200, data };
}

async function crearEvidenciaAccion({ id_accion, body }) {
  const id = Number(id_accion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_accion inválido" };
  }

  const {
    archivo_nombre,
    archivo_ruta,
    mime_type,
    tamano_bytes,
    hash_archivo,
    capturada_en
  } = body;

  if (!archivo_nombre || !archivo_ruta || !mime_type || !tamano_bytes || !hash_archivo) {
    return {
      ok: false,
      status: 400,
      message: "archivo_nombre, archivo_ruta, mime_type, tamano_bytes y hash_archivo son obligatorios"
    };
  }

  const bytes = Number(tamano_bytes);
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) {
    return { ok: false, status: 400, message: "tamano_bytes inválido" };
  }

  const capturada = capturada_en ? new Date(capturada_en) : null;
  if (capturada_en && isNaN(capturada.getTime())) {
    return { ok: false, status: 400, message: "capturada_en inválido" };
  }

  // estado_sync default PENDIENTE (id=1)
  const payload = {
    id_accion: id,
    id_estado_sync: 1,
    archivo_nombre,
    archivo_ruta,
    mime_type,
    tamano_bytes: bytes,
    hash_archivo,
    capturada_en: capturada
  };

  const creado = await repo.crearEvidenciaAccion(payload);
  return { ok: true, status: 201, data: creado };
}

async function listarEvidenciasPorAccion(id_accion) {
  const id = Number(id_accion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_accion inválido" };
  }

  const data = await repo.listarEvidenciasPorAccion(id);
  return { ok: true, status: 200, data };
}

async function actualizarEstadoObservacion({ id_observacion, body }) {
  const id = Number(id_observacion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_observacion inválido" };
  }

  const nuevo = Number(body?.id_estado_observacion);
  if (!nuevo || Number.isNaN(nuevo)) {
    return { ok: false, status: 400, message: "id_estado_observacion es obligatorio" };
  }

  const actual = await repo.obtenerEstadoObservacion(id);
  if (!actual) {
    return { ok: false, status: 404, message: "Observación no encontrada" };
  }

  const estadoActual = actual.id_estado_observacion;

  // Transiciones mínimas:
  // ABIERTA(1) -> EN_PROCESO(2) o CERRADA(3)
  // EN_PROCESO(2) -> CERRADA(3)
  // CERRADA(3) -> (no cambia)
  const permitidas = {
    1: [2, 3],
    2: [3],
    3: []
  };

  if (!permitidas[estadoActual]?.includes(nuevo)) {
    return {
      ok: false,
      status: 400,
      message: `Transición no permitida: ${estadoActual} -> ${nuevo}`
    };
  }

  const updated = await repo.actualizarEstadoObservacion({ id_observacion: id, id_estado_observacion: nuevo });
  await aplicarCierreAutomaticoDesdeObservacion(updated.id_observacion);
  return { ok: true, status: 200, data: updated };
}

async function actualizarEstadoAccion({ id_accion, body }) {
  const id = Number(id_accion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_accion inválido" };
  }

  const nuevo = Number(body?.id_estado_accion);
  if (!nuevo || Number.isNaN(nuevo)) {
    return { ok: false, status: 400, message: "id_estado_accion es obligatorio" };
  }

  const actual = await repo.obtenerEstadoAccion(id);
  if (!actual) {
    return { ok: false, status: 404, message: "Acción no encontrada" };
  }

  const estadoActual = actual.id_estado_accion;

  const permitidas = {
    1: [2, 4], // PENDIENTE
    2: [3, 4], // EN_PROCESO
    3: [],     // CUMPLIDA
    4: []      // NO_APLICA
  };

  if (!permitidas[estadoActual]?.includes(nuevo)) {
    return {
      ok: false,
      status: 400,
      message: `Transición no permitida: ${estadoActual} -> ${nuevo}`
    };
  }

  const updated = await repo.actualizarEstadoAccion({
    id_accion: id,
    id_estado_accion: nuevo
  });

  await aplicarCierreAutomaticoDesdeObservacion(updated.id_observacion);

  return { ok: true, status: 200, data: updated };
}

async function aplicarCierreAutomaticoDesdeObservacion(id_observacion) {
  const idObs = Number(id_observacion);
  if (!idObs || Number.isNaN(idObs)) return;

  // 1) Inspección dueña de esta observación
  const idInspeccion = await repo.obtenerInspeccionIdPorObservacion(idObs);
  if (!idInspeccion) return;

  // 2) Solo cerramos obs automático si tiene acciones y TODAS están (3/4)
  const acciones = await repo.listarAccionesPorObservacion(idObs);
  const accionesTotal = acciones.length;

  if (accionesTotal > 0) {
    const accionesNoFinalizadas = await repo.contarAccionesNoFinalizadas(idObs);

    if (accionesNoFinalizadas === 0) {
      const estadoObs = await repo.obtenerEstadoObservacion(idObs);
      if (estadoObs && estadoObs.id_estado_observacion !== 3) {
        await repo.actualizarEstadoObservacion({
          id_observacion: idObs,
          id_estado_observacion: 3 // CERRADA
        });
      }
    }
  }

  // 3) Si todas las observaciones de la inspección están cerradas => cerrar inspección
  const obsNoCerradas = await repo.contarObservacionesNoCerradas(idInspeccion);

  if (obsNoCerradas === 0) {
    const estadoIns = await inspeccionesRepo.obtenerEstadoInspeccion(idInspeccion);

    // no tocar ANULADA(5)
    if (estadoIns && estadoIns.id_estado_inspeccion !== 4 && estadoIns.id_estado_inspeccion !== 5) {
      await inspeccionesRepo.actualizarEstadoInspeccion({
        id_inspeccion: idInspeccion,
        id_estado_inspeccion: 4 // CERRADA
      });
    }
  }
}

module.exports = {
  crearObservacion,
  listarPorInspeccion,
  crearEvidenciaObservacion,
  listarEvidenciasPorObservacion,
  crearAccionObservacion,
  listarAccionesPorObservacion,
  crearEvidenciaAccion,
  listarEvidenciasPorAccion,
  actualizarEstadoObservacion,
  actualizarEstadoAccion
};

