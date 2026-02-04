const jwt = require("jsonwebtoken");
const env = require("../config/env");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ ok: false, message: "Token requerido" });
  }

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, message: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { id_usuario, dni, id_rol }
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Token inválido o expirado" });
  }
}

module.exports = authMiddleware;
