// backend/src/middlewares/role.middleware.js
export default function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    // req.user lo setea auth.middleware.js
    const rol = String(req.user?.rol || "").toUpperCase();

    // Si no hay roles requeridos, deja pasar
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return next();

    const allowed = allowedRoles.map((r) => String(r).toUpperCase());

    if (!rol) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!allowed.includes(rol)) {
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    next();
  };
}
