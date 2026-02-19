import accionesService from "../services/acciones.service.js";

async function pendientes(req, res) {
  try {
    const id_usuario = req.user?.id_usuario;
    const { dias, solo_mias } = req.query;

    const result = await accionesService.pendientes({ dias, solo_mias, id_usuario });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("acciones.pendientes error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default { pendientes };
