import inspeccionesRepo from "./inspecciones.repository.js";
import observacionesRepo from "./observaciones.repository.js";
import usuarioRepo from "./usuario.repository.js";

function normalizeDni(value) {
  return String(value || "").trim();
}

async function resolveResponsableDisplay(accion, responsablesCache) {
  const internoDni = normalizeDni(accion?.dni || accion?.responsable_interno_dni);
  if (internoDni) {
    if (!responsablesCache.has(internoDni)) {
      const empleado = await usuarioRepo.getEmpleadoProfileByDni(internoDni).catch(() => null);
      const nombreCompleto = String(empleado?.nombreCompleto || "").trim();
      responsablesCache.set(
        internoDni,
        nombreCompleto ? `${nombreCompleto} (${internoDni})` : internoDni
      );
    }
    return responsablesCache.get(internoDni) || internoDni;
  }

  const externoNombre = String(accion?.externo_responsable_nombre || "").trim();
  const externoCargo = String(accion?.externo_responsable_cargo || "").trim();
  if (externoNombre && externoCargo) return `${externoNombre} (${externoCargo})`;
  return externoNombre || externoCargo || "—";
}

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
  let evidenciasObservaciones = [];
  let evidenciasAcciones = [];
  const responsablesCache = new Map();

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
      const observacionesEnriquecidas = await Promise.all(
        observaciones.map(async (obs) => {
          try {
            const evidencias = await observacionesRepo.listarEvidenciasPorObservacion(obs.id_observacion);
            const list = await observacionesRepo.listarAccionesPorObservacion(obs.id_observacion);
            const accionesConEvidencias = await Promise.all(
              (Array.isArray(list) ? list : []).map(async (accion) => {
                try {
                  const evidenciasAccion = await observacionesRepo.listarEvidenciasPorAccion(accion.id_accion);
                  const responsable_display = await resolveResponsableDisplay(accion, responsablesCache);
                  return {
                    ...accion,
                    id_observacion: obs?.id_observacion,
                    item_ref: accion?.item_ref ?? obs?.item_ref ?? null,
                    desc_observacion: obs?.desc_observacion ?? "",
                    responsable_display,
                    evidencias: Array.isArray(evidenciasAccion) ? evidenciasAccion : [],
                  };
                } catch (err) {
                  console.warn("[xlsx-export] evidencias accion fallo -> []", err?.message);
                  const responsable_display = await resolveResponsableDisplay(accion, responsablesCache);
                  return {
                    ...accion,
                    id_observacion: obs?.id_observacion,
                    item_ref: accion?.item_ref ?? obs?.item_ref ?? null,
                    desc_observacion: obs?.desc_observacion ?? "",
                    responsable_display,
                    evidencias: [],
                  };
                }
              })
            );

            return {
              ...obs,
              evidencias: Array.isArray(evidencias) ? evidencias : [],
              acciones: accionesConEvidencias,
            };
          } catch (err) {
            console.warn("[xlsx-export] observacion enriquecida fallo -> vacia", err?.message);
            return {
              ...obs,
              evidencias: [],
              acciones: [],
            };
          }
        })
      );

      observaciones = observacionesEnriquecidas;
      evidenciasObservaciones = observacionesEnriquecidas.flatMap((obs) =>
        (Array.isArray(obs?.evidencias) ? obs.evidencias : []).map((evidencia) => ({
          ...evidencia,
          tipo_padre: "OBS",
          id_padre: obs?.id_observacion ?? null,
          item_ref: obs?.item_ref ?? "",
          desc_padre: obs?.desc_observacion ?? "",
        }))
      );
      acciones = observacionesEnriquecidas.flatMap((obs) => Array.isArray(obs?.acciones) ? obs.acciones : []);
      evidenciasAcciones = acciones.flatMap((accion) =>
        (Array.isArray(accion?.evidencias) ? accion.evidencias : []).map((evidencia) => ({
          ...evidencia,
          tipo_padre: "ACC",
          id_padre: accion?.id_accion ?? null,
          id_observacion: accion?.id_observacion ?? null,
          item_ref: accion?.item_ref ?? "",
          desc_padre: accion?.desc_accion ?? "",
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
    evidenciasObservaciones: Array.isArray(evidenciasObservaciones) ? evidenciasObservaciones : [],
    evidenciasAcciones: Array.isArray(evidenciasAcciones) ? evidenciasAcciones : [],
  };
}

export default {
  obtenerDataParaExport,
};
