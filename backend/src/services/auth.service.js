import usuarioRepo from "../repositories/usuario.repository.js";
import usuarioPasswordRepo from "../repositories/usuario.password.repository.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { validatePassword, buildExpiryDate } from "../utils/passwordPolicy.js";
import auditoriaService from "./auditoria.service.js";

function isLocked(user) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

function isExpired(user) {
  if (!user.password_expires_at) return false;
  return new Date(user.password_expires_at).getTime() < Date.now();
}

async function login({ dni, password }, reqMeta = {}) {
  if (!dni || !password) {
    return { ok: false, status: 400, message: "dni y password son requeridos" };
  }

  const user = await usuarioRepo.findByDni(dni);

  if (!user) {
    await auditoriaService.log({
      id_usuario: null,
      accion: "LOGIN_FAIL",
      entidad: "INS_USUARIO",
      id_entidad: String(dni),
      modo_cliente: reqMeta.modo_cliente ?? "UNKNOWN",
      exito: false,
      detalle: "Usuario no existe o credenciales inválidas",
      ip_origen: reqMeta.ip_origen ?? null,
      user_agent: reqMeta.user_agent ?? null,
    });
    return { ok: false, status: 401, message: "Credenciales inválidas" };
  }

  if (String(user.estado).toUpperCase() !== "ACTIVO") {
    await auditoriaService.log({
      id_usuario: user.id_usuario,
      accion: "LOGIN_FAIL",
      entidad: "INS_USUARIO",
      id_entidad: String(user.id_usuario),
      modo_cliente: reqMeta.modo_cliente ?? "UNKNOWN",
      exito: false,
      detalle: `Usuario no habilitado: ${user.estado}`,
      ip_origen: reqMeta.ip_origen ?? null,
      user_agent: reqMeta.user_agent ?? null,
    });
    return { ok: false, status: 403, message: `Usuario no habilitado: ${user.estado}` };
  }

  if (isLocked(user)) {
    return { ok: false, status: 423, message: "Usuario bloqueado temporalmente. Intenta más tarde." };
  }

  const match = await verifyPassword(password, user.password_hash);

  if (!match) {
    // si aún no implementaste onLoginFail en repo, comenta estas 2 líneas:
    const st = await usuarioRepo.onLoginFail?.(user.id_usuario, { maxAttempts: 5, lockMinutes: 10 });

    await auditoriaService.log({
      id_usuario: user.id_usuario,
      accion: "LOGIN_FAIL",
      entidad: "INS_USUARIO",
      id_entidad: String(user.id_usuario),
      modo_cliente: reqMeta.modo_cliente ?? "UNKNOWN",
      exito: false,
      detalle: `Password incorrecto. attempts=${st?.failed_attempts ?? "?"}`,
      ip_origen: reqMeta.ip_origen ?? null,
      user_agent: reqMeta.user_agent ?? null,
    });

    return { ok: false, status: 401, message: "Credenciales inválidas" };
  }

  await usuarioRepo.onLoginSuccess?.(user.id_usuario);

  const token = signToken({
    id_usuario: user.id_usuario,
    rol: user.rol,
  });

  const usuario = {
    id_usuario: user.id_usuario,
    dni: user.dni,
    rol: user.rol,
    debe_cambiar_password: !!user.debe_cambiar_password || isExpired(user),
  };

  await auditoriaService.log({
    id_usuario: user.id_usuario,
    accion: "LOGIN_OK",
    entidad: "INS_USUARIO",
    id_entidad: String(user.id_usuario),
    modo_cliente: reqMeta.modo_cliente ?? "UNKNOWN",
    exito: true,
    detalle: "Login exitoso",
    ip_origen: reqMeta.ip_origen ?? null,
    user_agent: reqMeta.user_agent ?? null,
  });

  return { ok: true, status: 200, data: { token, usuario } };
}

async function changePassword({ id_usuario, old_password, new_password }, reqMeta = {}) {
  if (!id_usuario) return { ok: false, status: 400, message: "id_usuario requerido" };
  if (!old_password || !new_password) {
    return { ok: false, status: 400, message: "old_password y new_password son requeridos" };
  }

  const err = validatePassword(new_password);
  if (err) return { ok: false, status: 400, message: err };

  const row = await usuarioPasswordRepo.getPasswordData(id_usuario);
  if (!row) return { ok: false, status: 404, message: "Usuario no encontrado" };

  const match = await verifyPassword(old_password, row.password_hash);
  if (!match) {
    await auditoriaService.log({
      id_usuario,
      accion: "PASSWORD_CHANGE_FAIL",
      entidad: "INS_USUARIO",
      id_entidad: String(id_usuario),
      modo_cliente: reqMeta.modo_cliente ?? "UNKNOWN",
      exito: false,
      detalle: "Password actual incorrecto",
      ip_origen: reqMeta.ip_origen ?? null,
      user_agent: reqMeta.user_agent ?? null,
    });
    return { ok: false, status: 401, message: "Password actual incorrecto" };
  }

  const password_hash = await hashPassword(new_password);

  await usuarioPasswordRepo.updatePassword(id_usuario, {
    password_hash,
    expires_at: buildExpiryDate(90),
  });

  await auditoriaService.log({
    id_usuario,
    accion: "PASSWORD_CHANGE_OK",
    entidad: "INS_USUARIO",
    id_entidad: String(id_usuario),
    modo_cliente: reqMeta.modo_cliente ?? "UNKNOWN",
    exito: true,
    detalle: "Password actualizado",
    ip_origen: reqMeta.ip_origen ?? null,
    user_agent: reqMeta.user_agent ?? null,
  });

  return { ok: true, status: 200, data: { ok: true } };
}

export default { login, changePassword };
