import usuariosRepo from "../repositories/usuarios.repository.js";
import { hashPassword } from "../utils/password.js";
import { validatePassword, buildExpiryDate } from "../utils/passwordPolicy.js";

async function list() {
  return usuariosRepo.list();
}

async function create({ dni, id_rol, id_estado_usuario, password }) {
  const err = validatePassword(password);
  if (err) return { ok: false, status: 400, message: err };

  const password_hash = await hashPassword(password);
  const id_usuario = await usuariosRepo.create({
    dni,
    id_rol,
    id_estado_usuario,
    password_hash,
    debe_cambiar_password: 1,
    password_expires_at: buildExpiryDate(90),
  });

  return { ok: true, status: 201, data: { id_usuario } };
}

async function update(id_usuario, payload) {
  await usuariosRepo.update(id_usuario, payload);
  return { ok: true, status: 200 };
}

async function changeStatus(id_usuario, id_estado_usuario) {
  await usuariosRepo.setEstado(id_usuario, id_estado_usuario);
  return { ok: true, status: 200 };
}

async function adminResetPassword(id_usuario, newPassword) {
  const err = validatePassword(newPassword);
  if (err) return { ok: false, status: 400, message: err };

  const password_hash = await hashPassword(newPassword);
  await usuariosRepo.resetPassword(id_usuario, {
    password_hash,
    debe_cambiar_password: 1,
    password_expires_at: buildExpiryDate(90),
  });

  return { ok: true, status: 200 };
}

async function buscar(q) {
  return usuariosRepo.buscar(q);
}

export default { list, create, update, changeStatus, adminResetPassword, buscar };
