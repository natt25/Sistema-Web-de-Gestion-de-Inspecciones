const usuarioRepo = require("../repositories/usuario.repository");
const { verifyPassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");

async function login({ dni, password }) {
  if (!dni || !password) {
    return { ok: false, status: 400, message: "dni y password son requeridos" };
  }

  const user = await usuarioRepo.findByDni(dni);
  if (!user) return { ok: false, status: 401, message: "Credenciales inválidas" };

  if (String(user.estado).toUpperCase() !== "ACTIVO") {
    return { ok: false, status: 403, message: `Usuario no habilitado: ${user.estado}` };
  }

  const match = await verifyPassword(password, user.password_hash);
  if (!match) return { ok: false, status: 401, message: "Credenciales inválidas" };

  const token = signToken({
    id_usuario: user.id_usuario,
    rol: user.rol,
  });

  const usuario = {
    id_usuario: user.id_usuario,
    dni: user.dni,
    rol: user.rol,
    debe_cambiar_password: !!user.debe_cambiar_password,
  };

  return { ok: true, status: 200, data: { token, usuario } };
}

module.exports = { login };
