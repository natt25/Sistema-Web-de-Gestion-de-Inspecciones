const usuarioRepo = require("../repositories/usuario.repository");
const { comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");

async function login({ dni, password }) {
  const user = await usuarioRepo.findByDni(dni);
  if (!user) {
    return { ok: false, status: 401, message: "Credenciales inválidas" };
  }

  // Asume que tu catálogo tiene un estado "ACTIVO".
  // Aquí validamos por id (ideal: mapearlo a constante cuando tengas seeds confirmados).
  // Mientras tanto: si no es 1, se bloquea.
  if (user.id_estado_usuario !== 1) {
    return { ok: false, status: 403, message: "Usuario inactivo/bloqueado" };
  }

  const match = await comparePassword(password, user.password_hash);
  if (!match) {
    return { ok: false, status: 401, message: "Credenciales inválidas" };
  }

  const token = signToken({
    id_usuario: user.id_usuario,
    dni: user.dni,
    id_rol: user.id_rol
  });

  return {
    ok: true,
    token,
    user: {
      id_usuario: user.id_usuario,
      dni: user.dni,
      id_rol: user.id_rol,
      debe_cambiar_password: user.debe_cambiar_password
    }
  };
}

module.exports = { login };
