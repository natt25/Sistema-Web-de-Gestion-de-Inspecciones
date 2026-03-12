import accionesRepo from "../repositories/acciones.repository.js";

function parseDias(diasRaw) {
  if (diasRaw === undefined) return 7;
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

async function pendientes({ dias, solo_mias, estado, id_usuario, id_plantilla_inspec }) {
  const d = parseDias(dias);
  if (typeof d === "object" && d?.error) {
    return { ok: false, status: 400, message: d.error };
  }

  const s = String(solo_mias ?? "0") === "1" ? 1 : 0;
  const e = parseEstado(estado);
  const id = Number(id_usuario);
  const idNormalizado = Number.isFinite(id) && id > 0 ? id : null;
  const plantilla = Number(id_plantilla_inspec);
  const idPlantillaNormalizado = Number.isFinite(plantilla) && plantilla > 0 ? plantilla : null;

  const rows = await accionesRepo.listarPendientes({
    dias: d,
    solo_mias: s,
    estado: e,
    id_usuario: idNormalizado,
    id_plantilla_inspec: idPlantillaNormalizado,
  });

  return { ok: true, status: 200, data: rows };
}

export default { pendientes };
