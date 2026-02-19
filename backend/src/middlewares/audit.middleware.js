import auditoriaService from "../services/auditoria.service.js";

function getClientMode(req) {
  const h = String(req.headers["x-client-mode"] || "").toUpperCase();
  return h === "ONLINE" || h === "OFFLINE" ? h : "UNKNOWN";
}

export function audit(action, { entity = null, entityIdFrom = null } = {}) {
  return (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const ok = res.statusCode < 400;

      const id_usuario = req.user?.id_usuario ?? null;
      const modo_cliente = getClientMode(req);

      let id_entidad = null;
      if (entityIdFrom?.startsWith("params.")) {
        id_entidad = req.params?.[entityIdFrom.replace("params.", "")] ?? null;
      } else if (entityIdFrom?.startsWith("body.")) {
        id_entidad = req.body?.[entityIdFrom.replace("body.", "")] ?? null;
      }

      auditoriaService.log({
        id_usuario,
        accion: action,
        entidad: entity,
        id_entidad: id_entidad != null ? String(id_entidad) : null,
        modo_cliente,
        exito: ok,
        detalle: `${req.method} ${req.originalUrl} (${res.statusCode}) ${Date.now() - start}ms`,
        ip_origen: req.ip,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
      });
    });

    next();
  };
}
