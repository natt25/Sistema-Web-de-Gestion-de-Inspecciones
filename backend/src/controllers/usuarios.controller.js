import usuariosService from "../services/usuarios.service.js";
import usuariosRepo from "../repositories/usuarios.repository.js";

async function list(req, res) {
  const data = await usuariosService.list();
  res.json(data);
}

async function create(req, res) {
  const { dni, id_rol, id_estado_usuario, password } = req.body;
  const r = await usuariosService.create({ dni, id_rol, id_estado_usuario, password });
  if (!r.ok) return res.status(r.status).json({ message: r.message });
  res.status(r.status).json(r.data);
}

async function update(req, res) {
  const id_usuario = Number(req.params.id);
  await usuariosService.update(id_usuario, req.body);
  res.json({ ok: true });
}

async function changeStatus(req, res) {
  const id_usuario = Number(req.params.id);
  const { id_estado_usuario } = req.body;
  const r = await usuariosService.changeStatus(id_usuario, Number(id_estado_usuario));
  res.status(r.status).json({ ok: true });
}

async function resetPassword(req, res) {
  const id_usuario = Number(req.params.id);
  const { password } = req.body;
  const r = await usuariosService.adminResetPassword(id_usuario, password);
  if (!r.ok) return res.status(r.status).json({ message: r.message });
  res.json({ ok: true });
}

async function me(req, res) {
  const u = await usuariosRepo.getById(req.user.id_usuario);
  return res.json(u);
}

async function buscar(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json([]);
    const data = await usuariosService.buscar(q);
    return res.json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("usuarios.buscar:", e);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default { list, create, update, changeStatus, resetPassword, me, buscar };
