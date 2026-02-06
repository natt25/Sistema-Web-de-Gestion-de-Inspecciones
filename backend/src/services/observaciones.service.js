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

module.exports = { crearObservacion, listarPorInspeccion };
