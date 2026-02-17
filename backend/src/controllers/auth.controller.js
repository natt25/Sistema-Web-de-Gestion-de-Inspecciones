import authService from "../services/auth.service.js";
async function login(req, res) {
  try {
    const result = await authService.login(req.body);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("auth.login error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default { login };