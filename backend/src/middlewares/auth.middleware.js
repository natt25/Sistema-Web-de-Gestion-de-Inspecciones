import { verifyToken } from "../utils/jwt.js";

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log("[auth.middleware] enter", {
    method: req.method,
    url: req.originalUrl,
    hasAuthHeader: Boolean(authHeader),
  });

  if (!authHeader) {
    console.warn("[auth.middleware] missing authorization header");
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.warn("[auth.middleware] invalid bearer format");
    return res.status(401).json({ message: "Formato de token invalido" });
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);
    req.user = {
      id_usuario: decoded.id_usuario,
      rol: decoded.rol,
    };

    console.log("[auth.middleware] ok", {
      id_usuario: req.user.id_usuario,
      rol: req.user.rol,
    });
    next();
  } catch (error) {
    console.warn("[auth.middleware] token rejected", { message: error?.message });
    return res.status(401).json({ message: "Token invalido o expirado" });
  }
}

export default authMiddleware;
