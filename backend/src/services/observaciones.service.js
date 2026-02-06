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

module.exports = { crearObservacion };
