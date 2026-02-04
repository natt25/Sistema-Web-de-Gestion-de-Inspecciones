const { verifyToken } = require("../utils/jwt");

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  // Debe venir como: Authorization: Bearer <token>
  if (!authHeader) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ message: "Formato de token inválido" });
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);

    // Inyectamos el usuario en la request
    req.user = {
      id_usuario: decoded.id_usuario,
      rol: decoded.rol,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

module.exports = authMiddleware;
