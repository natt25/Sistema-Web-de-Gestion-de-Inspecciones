import accionesService from "../services/acciones.service.js";

async function pendientes(req, res) {
  try {
    const id_usuario = req.user?.id_usuario ?? req.query?.id_usuario;
    const { dias, solo_mias, estado, id_plantilla_inspec } = req.query;

    const result = await accionesService.pendientes({
      dias,
      solo_mias,
      estado,
      id_usuario,
      id_plantilla_inspec,
    });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("acciones.pendientes error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

async function pendientesCount(req, res) {
  try {
    const id_usuario = req.user?.id_usuario ?? req.query?.id_usuario;
    const { dias, solo_mias, estado, id_plantilla_inspec } = req.query;

    const result = await accionesService.contarPendientes({
      dias,
      solo_mias,
      estado,
      id_usuario,
      id_plantilla_inspec,
    });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    return res.status(200).json(result.data);
  } catch (err) {
    console.error("acciones.pendientesCount error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default { pendientes, pendientesCount };
