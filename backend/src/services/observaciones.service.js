const repo = require("../repositories/observaciones.repository");

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


module.exports = {
  crearObservacion,
  listarPorInspeccion,
  crearEvidenciaObservacion,
  listarEvidenciasPorObservacion,
  crearAccionObservacion,
  listarAccionesPorObservacion,
  crearEvidenciaAccion,
  listarEvidenciasPorAccion
};

