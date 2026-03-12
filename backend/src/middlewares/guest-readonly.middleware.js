export default function guestReadOnlyMiddleware(req, res, next) {
  const rol = String(req.user?.rol || "").trim().toUpperCase();
  if (rol === "INVITADO") {
    return res.status(403).json({ message: "Modo invitado: solo lectura." });
  }
  next();
}
