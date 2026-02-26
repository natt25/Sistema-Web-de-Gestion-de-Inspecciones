import inspeccionesRepo from "./inspecciones.repository.js";

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

  if (!cabecera) return null;

  return {
    cabecera,
    participantes: Array.isArray(participantes) ? participantes : [],
    respuestas: Array.isArray(respuestas) ? respuestas : [],
  };
}

export default {
  obtenerDataParaExport,
};
