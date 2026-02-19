import accionesRepo from "../repositories/acciones.repository.js";

async function pendientes({ dias, solo_mias, id_usuario }) {
  const d = Number(dias ?? 7);
  const s = String(solo_mias ?? "0") === "1" ? 1 : 0;

  if (Number.isNaN(d) || d < 1 || d > 60) {
    return { ok: false, status: 400, message: "Parametro 'dias' inválido (1-60)" };
  }

  const rows = await accionesRepo.listarPendientes({
    dias: d,
    solo_mias: s,
    id_usuario,
  });

  return { ok: true, status: 200, data: rows };
}

export default { pendientes };
