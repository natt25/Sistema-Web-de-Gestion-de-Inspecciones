const authService = require("../services/auth.service");

async function login(req, res, next) {
  try {
    const { dni, password } = req.body;

    if (!dni || !password) {
      return res.status(400).json({ ok: false, message: "dni y password son requeridos" });
    }

    const result = await authService.login({ dni, password });

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, message: result.message });
    }

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { login };
