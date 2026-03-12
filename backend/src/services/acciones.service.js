import accionesRepo from "../repositories/acciones.repository.js";

function parseDias(diasRaw, defaultValue = 7) {
  if (diasRaw === undefined) return defaultValue;
  if (diasRaw === null) return null;

  const v = String(diasRaw).trim().toLowerCase();
  if (!v || v === "null" || v === "all") return null;

  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 3650) {
    return { error: "Parametro 'dias' invalido (1-3650 o null)" };
  }
  return n;
}

function parseEstado(estadoRaw) {
  if (estadoRaw === undefined || estadoRaw === null || estadoRaw === "") return "ALL";
  const estado = String(estadoRaw).trim().toUpperCase();
  return estado || "ALL";
}

function normalizePendientesFilters(
  { dias, solo_mias, estado, id_usuario, id_plantilla_inspec },
  { diasDefault = 7 } = {}
) {
  const d = parseDias(dias, diasDefault);
  if (typeof d === "object" && d?.error) {
    return { ok: false, status: 400, message: d.error };
  }

  const s = String(solo_mias ?? "0") === "1" ? 1 : 0;
  const e = parseEstado(estado);
  const id = Number(id_usuario);
  const idNormalizado = Number.isFinite(id) && id > 0 ? id : null;
  const plantilla = Number(id_plantilla_inspec);
  const idPlantillaNormalizado = Number.isFinite(plantilla) && plantilla > 0 ? plantilla : null;

  return {
    ok: true,
    filters: {
      dias: d,
      solo_mias: s,
      estado: e,
      id_usuario: idNormalizado,
      id_plantilla_inspec: idPlantillaNormalizado,
    },
  };
}

async function pendientes({ dias, solo_mias, estado, id_usuario, id_plantilla_inspec }) {
  const normalized = normalizePendientesFilters(
    { dias, solo_mias, estado, id_usuario, id_plantilla_inspec },
    { diasDefault: 7 }
  );
  if (!normalized.ok) return normalized;

  const rows = await accionesRepo.listarPendientes(normalized.filters);

  return { ok: true, status: 200, data: rows };
}

async function contarPendientes({ dias, solo_mias, estado, id_usuario, id_plantilla_inspec }) {
  const normalized = normalizePendientesFilters(
    { dias, solo_mias, estado, id_usuario, id_plantilla_inspec },
    { diasDefault: null }
  );
  if (!normalized.ok) return normalized;

  const total = await accionesRepo.contarPendientesPorInspeccion(normalized.filters);
  return { ok: true, status: 200, data: { total } };
}

export default { pendientes, contarPendientes };
