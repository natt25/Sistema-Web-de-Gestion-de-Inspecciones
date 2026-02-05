const repo = require("../repositories/inspecciones.repository");

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

module.exports = { crearInspeccionCabecera };
