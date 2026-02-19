import authService from "../services/auth.service.js";
async function login(req, res) {
  try {
    const result = await authService.login(req.body, {
      ip_origen: req.ip,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
      modo_cliente: String(req.headers["x-client-mode"] || "UNKNOWN").toUpperCase(),
    });

    if (!result.ok) return res.status(result.status).json({ message: result.message });
      return res.status(result.status).json(result.data);
    } catch (err) {
    console.error("auth.login error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function changePassword(req, res) {
  try {
    const id_usuario = req.user?.id_usuario;
    const { old_password, new_password } = req.body;

    const result = await authService.changePassword(
      { id_usuario, old_password, new_password },
      {
        ip_origen: req.ip,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
        modo_cliente: String(req.headers["x-client-mode"] || "UNKNOWN").toUpperCase(),
      }
    );

    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error("auth.changePassword error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default { login, changePassword };
