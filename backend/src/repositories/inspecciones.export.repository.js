import inspeccionesRepo from "./inspecciones.repository.js";
import observacionesRepo from "./observaciones.repository.js";

export async function obtenerDataParaExport(id_inspeccion) {
  const id = Number(id_inspeccion);
  if (!id || Number.isNaN(id)) {
    const error = new Error("id_inspeccion invalido");
    error.code = "INVALID_ID";
    throw error;
  }

  const cabecera = await inspeccionesRepo.obtenerInspeccionPorId(id);
  let participantes = [];
  let respuestas = [];
  let observaciones = [];
  let acciones = [];

  try {
    participantes = await inspeccionesRepo.listarParticipantesPorInspeccion(id);
  } catch (err) {
    console.warn("[xlsx-export] participantes fallo -> []", err?.message);
  }
  try {
    respuestas = await inspeccionesRepo.listarRespuestasPorInspeccion(id);
  } catch (err) {
    console.warn("[xlsx-export] respuestas fallo -> []", err?.message);
  }
  try {
    observaciones = await observacionesRepo.listarPorInspeccion(id);
  } catch (err) {
    console.warn("[xlsx-export] observaciones fallo -> []", err?.message);
  }

  try {
    if (Array.isArray(observaciones) && observaciones.length) {
      const accionesByObs = await Promise.all(
        observaciones.map(async (obs) => {
          try {
            const list = await observacionesRepo.listarAccionesPorObservacion(obs.id_observacion);
            return { obs, list: Array.isArray(list) ? list : [] };
          } catch (err) {
            console.warn("[xlsx-export] acciones por observacion fallo -> []", err?.message);
            return { obs, list: [] };
          }
        })
      );

      acciones = accionesByObs.flatMap(({ obs, list }) =>
        list.map((accion) => ({
          ...accion,
          id_observacion: obs?.id_observacion,
          item_ref: accion?.item_ref ?? obs?.item_ref ?? null,
          desc_observacion: obs?.desc_observacion ?? "",
        }))
      );
    }
  } catch (err) {
    console.warn("[xlsx-export] acciones fallo -> []", err?.message);
  }

  if (!cabecera) return null;

  return {
    cabecera,
    participantes: Array.isArray(participantes) ? participantes : [],
    respuestas: Array.isArray(respuestas) ? respuestas : [],
    observaciones: Array.isArray(observaciones) ? observaciones : [],
    acciones: Array.isArray(acciones) ? acciones : [],
  };
}

export default {
  obtenerDataParaExport,
};
