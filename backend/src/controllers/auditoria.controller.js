import auditoriaService from "../services/auditoria.service.js";

async function list(req, res) {
  const top = Number(req.query.top || 200);
  const accion = req.query.accion ? String(req.query.accion) : null;
  const id_usuario = req.query.id_usuario ? Number(req.query.id_usuario) : null;
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;

  const data = await auditoriaService.getLogs({ top, accion, id_usuario, from, to });
  res.json(data);
}

export default { list };
