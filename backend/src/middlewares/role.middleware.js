function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    if (!roles.includes(req.user.id_rol)) {
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    next();
  };
}

export default requireRole;