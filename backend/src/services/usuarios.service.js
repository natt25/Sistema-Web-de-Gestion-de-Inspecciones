import usuariosRepo from "../repositories/usuarios.repository.js";
import { hashPassword } from "../utils/password.js";
import { validatePassword, buildExpiryDate } from "../utils/passwordPolicy.js";

async function list() {
  return usuariosRepo.list();
}

async function listCatalogos() {
  const [roles, estados] = await Promise.all([
    usuariosRepo.listRoles(),
    usuariosRepo.listEstados(),
  ]);

  return {
    roles: Array.isArray(roles) ? roles : [],
    estados: Array.isArray(estados) ? estados : [],
  };
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

async function upsertPorDni({ dni, id_rol, id_estado_usuario, actor }) {
  const cleanDni = String(dni || "").trim();
  if (!cleanDni) return { ok: false, status: 400, message: "dni requerido" };
  if (!id_rol || !id_estado_usuario) {
    return { ok: false, status: 400, message: "id_rol e id_estado_usuario son requeridos" };
  }

  const [nextRol, nextEstado] = await Promise.all([
    usuariosRepo.getRolById(id_rol),
    usuariosRepo.getEstadoById(id_estado_usuario),
  ]);
  if (!nextRol) return { ok: false, status: 400, message: "Rol no válido" };
  if (!nextEstado) return { ok: false, status: 400, message: "Estado no válido" };

  const existing = await usuariosRepo.findByDni(cleanDni);
  if (existing?.id_usuario) {
    const ruleError = await validateUpsertRules({
      existingUser: existing,
      nextRol,
      nextEstado,
      actor,
    });
    if (ruleError) return { ok: false, status: 400, message: ruleError };

    await usuariosRepo.update(existing.id_usuario, { id_rol, id_estado_usuario });
    return {
      ok: true,
      status: 200,
      data: { id_usuario: existing.id_usuario, created: false, updated: true },
    };
  }

  const password_hash = await hashPassword(cleanDni);
  const id_usuario = await usuariosRepo.create({
    dni: cleanDni,
    id_rol,
    id_estado_usuario,
    password_hash,
    debe_cambiar_password: 1,
    password_expires_at: buildExpiryDate(90),
  });

  return {
    ok: true,
    status: 201,
    data: { id_usuario, created: true, updated: false },
  };
}

async function ensureUserForInspectorByDni(dniRaw) {
  const dni = String(dniRaw ?? "").trim();
  if (!dni) return { ok: false, status: 400, message: "dni requerido" };

  try {
    const password_hash = await hashPassword(dni);
    const id_usuario = await usuariosRepo.ensureInspectorUserByDni({
      dni,
      password_hash,
      id_estado_usuario: 1,
      debe_cambiar_password: 1,
      password_expires_at: buildExpiryDate(90),
    });

    return {
      ok: true,
      status: 200,
      data: { id_usuario, dni },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      message: err?.message || "No se pudo asegurar usuario inspector",
    };
  }
}

async function update(id_usuario, payload) {
  await usuariosRepo.update(id_usuario, payload);
  return { ok: true, status: 200 };
}

async function changeStatus(id_usuario, id_estado_usuario) {
  await usuariosRepo.setEstado(id_usuario, id_estado_usuario);
  return { ok: true, status: 200 };
}

function normalizeRoleName(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeEstadoName(value) {
  return String(value || "").trim().toUpperCase();
}

function isAdminPrincipalRole(value) {
  return normalizeRoleName(value) === "ADMIN_PRINCIPAL";
}

function isAdminRoleOnly(value) {
  return normalizeRoleName(value) === "ADMIN";
}

function isAdminAnyRole(value) {
  const role = normalizeRoleName(value);
  return role === "ADMIN_PRINCIPAL" || role === "ADMIN";
}

function isSupremeAdmin(actor) {
  return String(actor?.dni || "").trim() === "00000000";
}

function isInspectorRole(value) {
  return normalizeRoleName(value) === "INSPECTOR";
}

function isEstadoInactivo(value) {
  return normalizeEstadoName(value) === "INACTIVO";
}

function isEstadoActivo(value) {
  return normalizeEstadoName(value) === "ACTIVO";
}

function isEstadoBloqueado(value) {
  return normalizeEstadoName(value) === "BLOQUEADO";
}

async function validateUpsertRules({ existingUser, nextRol, nextEstado, actor }) {
  if (!existingUser?.id_usuario) return null;
  if (isSupremeAdmin(actor)) return null;

  const actorRole = normalizeRoleName(actor?.rol);
  const currentRole = normalizeRoleName(existingUser?.rol);
  const requestedRole = normalizeRoleName(nextRol?.nombre_rol);
  const currentEstado = normalizeEstadoName(existingUser?.estado);
  const requestedEstado = normalizeEstadoName(nextEstado?.nombre_estado);

  if (isAdminPrincipalRole(actorRole)) {
    if (isAdminPrincipalRole(currentRole)) {
      if (requestedRole !== currentRole || requestedEstado !== currentEstado) {
        return "Un ADMIN_PRINCIPAL no puede modificar a otro ADMIN_PRINCIPAL.";
      }
      return null;
    }
    return null;
  }

  if (isAdminRoleOnly(actorRole)) {
    if (isAdminPrincipalRole(currentRole)) {
      return "Un ADMIN no puede modificar a un ADMIN_PRINCIPAL.";
    }

    if (isAdminRoleOnly(currentRole) && requestedRole !== currentRole) {
      return "Un ADMIN no puede cambiar el rol de otro ADMIN.";
    }

    if (isAdminRoleOnly(currentRole) && requestedEstado !== currentEstado) {
      return "Un ADMIN no puede cambiar el estado de otro ADMIN.";
    }

    return null;
  }

  return null;
}

async function adminResetPassword(id_usuario, newPassword, actor = {}) {
  const err = validatePassword(newPassword);
  if (err) return { ok: false, status: 400, message: err };

  const targetUser = await usuariosRepo.findById(id_usuario);
  if (!targetUser) return { ok: false, status: 404, message: "Usuario no encontrado" };
  if (isSupremeAdmin(actor)) {
    const password_hash = await hashPassword(newPassword);
    await usuariosRepo.resetPassword(id_usuario, {
      password_hash,
      debe_cambiar_password: 1,
      password_expires_at: buildExpiryDate(90),
    });
    return { ok: true, status: 200 };
  }

  const actorRole = normalizeRoleName(actor?.rol);
  const targetRole = normalizeRoleName(targetUser?.rol);

  if (isAdminPrincipalRole(actorRole)) {
    if (isAdminPrincipalRole(targetRole)) {
      return {
        ok: false,
        status: 403,
        message: "Un ADMIN_PRINCIPAL no puede restablecer la clave de otro ADMIN_PRINCIPAL.",
      };
    }
  } else if (isAdminRoleOnly(actorRole)) {
    if (isAdminPrincipalRole(targetRole)) {
      return {
        ok: false,
        status: 403,
        message: "Un ADMIN no puede restablecer la clave de un ADMIN_PRINCIPAL.",
      };
    }
    if (isAdminRoleOnly(targetRole)) {
      return {
        ok: false,
        status: 403,
        message: "Un ADMIN no puede restablecer la clave de otro ADMIN.",
      };
    }
  } else {
    return {
      ok: false,
      status: 403,
      message: "No autorizado para restablecer claves.",
    };
  }

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

export default {
  list,
  listCatalogos,
  create,
  upsertPorDni,
  ensureUserForInspectorByDni,
  update,
  changeStatus,
  adminResetPassword,
  buscar
};
