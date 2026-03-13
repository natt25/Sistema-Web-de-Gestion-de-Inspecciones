import { useEffect, useState } from "react";
import {
  listarUsuarios,
  listarCatalogosUsuarios,
  asegurarOActualizarUsuario,
  resetPasswordUsuario,
} from "../api/usuarios.api";
import { getUser } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeRoleName(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeEstadoName(value) {
  return String(value || "").trim().toUpperCase();
}

function isAdminPrincipalRole(value) {
  return normalizeRoleName(value) === "ADMIN_PRINCIPAL";
}

function isAdminRoleOnly(value) {
  return normalizeRoleName(value) === "ADMIN";
}

function isAdminAnyRole(value) {
  const role = normalizeRoleName(value);
  return role === "ADMIN_PRINCIPAL" || role === "ADMIN";
}

function isSupremeAdmin(actor) {
  return String(actor?.dni || "").trim() === "00000000";
}

function isInspectorRole(value) {
  return normalizeRoleName(value) === "INSPECTOR";
}

function isEstadoInactivo(value) {
  return normalizeEstadoName(value) === "INACTIVO";
}

function isEstadoActivo(value) {
  return normalizeEstadoName(value) === "ACTIVO";
}

function isEstadoBloqueado(value) {
  return normalizeEstadoName(value) === "BLOQUEADO";
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function AdminUsuarios() {
  const actor = getUser();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setMsg,
    label: "AdminUsuarios.load",
    timeoutMs: 8000,
  });

  const [dni, setDni] = useState("");
  const [idRol, setIdRol] = useState("");
  const [idEstado, setIdEstado] = useState("");
  const [rolFilter, setRolFilter] = useState("TODOS");
  const normalizedDni = String(dni || "").trim();
  const supremeAdmin = isSupremeAdmin(actor);
  const actorRole = normalizeRoleName(actor?.rol);
  const currentUser = rows.find((row) => String(row?.dni || "").trim() === normalizedDni) || null;
  const currentUserRole = normalizeRoleName(currentUser?.rol);
  const currentUserEstado = normalizeEstadoName(currentUser?.estado);
  const canEditRol = !currentUser
    ? true
    : supremeAdmin
      ? true
      : isAdminPrincipalRole(actorRole)
        ? !isAdminPrincipalRole(currentUserRole)
        : isAdminRoleOnly(actorRole)
          ? isInspectorRole(currentUserRole)
          : false;
  const filteredRoles = roles.filter((rol) => {
    if (!currentUser || supremeAdmin) return true;
    if (isAdminPrincipalRole(actorRole)) {
      if (isAdminPrincipalRole(currentUserRole)) {
        return isAdminPrincipalRole(rol?.nombre_rol);
      }
      return true;
    }
    if (isAdminRoleOnly(actorRole)) {
      if (isAdminPrincipalRole(currentUserRole) || isAdminRoleOnly(currentUserRole)) {
        return normalizeRoleName(rol?.nombre_rol) === currentUserRole;
      }
      return true;
    }
    return true;
  });
  const filteredEstados = estados.filter((estado) => {
    if (!currentUser || supremeAdmin) return true;
    if (isAdminPrincipalRole(actorRole)) {
      if (isAdminPrincipalRole(currentUserRole)) {
        return normalizeEstadoName(estado?.nombre_estado) === currentUserEstado;
      }
      return true;
    }
    if (isAdminRoleOnly(actorRole)) {
      if (isAdminPrincipalRole(currentUserRole) || isAdminRoleOnly(currentUserRole)) {
        return normalizeEstadoName(estado?.nombre_estado) === currentUserEstado;
      }
      return true;
    }
    return true;
  });
  const canEditEstado = !currentUser
    ? true
    : supremeAdmin
      ? true
      : isAdminPrincipalRole(actorRole)
        ? !isAdminPrincipalRole(currentUserRole)
        : isAdminRoleOnly(actorRole)
          ? isInspectorRole(currentUserRole)
          : false;
  const roleSelectDisabled = Boolean(currentUser) && !canEditRol;
  const estadoSelectDisabled = Boolean(currentUser) && !canEditEstado;
  const filteredRowsByRole = rows.filter((row) => {
    if (rolFilter === "TODOS") return true;
    return normalizeRoleName(row?.rol) === rolFilter;
  });

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [usuariosData, catalogosData] = await Promise.all([
        listarUsuarios(),
        listarCatalogosUsuarios(),
      ]);

      setRows(Array.isArray(usuariosData) ? usuariosData : []);
      setRoles(Array.isArray(catalogosData?.roles) ? catalogosData.roles : []);
      setEstados(Array.isArray(catalogosData?.estados) ? catalogosData.estados : []);

      setIdRol((prev) => {
        if (prev) return prev;
        const rolInspector = (catalogosData?.roles || []).find(
          (it) => String(it?.nombre_rol || "").trim().toUpperCase() === "INSPECTOR"
        );
        const fallback = rolInspector?.id_rol ?? catalogosData?.roles?.[0]?.id_rol ?? "";
        return fallback === "" ? "" : String(fallback);
      });

      setIdEstado((prev) => {
        if (prev) return prev;
        const estadoActivo = (catalogosData?.estados || []).find(
          (it) => String(it?.nombre_estado || "").trim().toUpperCase() === "ACTIVO"
        );
        const fallback = estadoActivo?.id_estado_usuario ?? catalogosData?.estados?.[0]?.id_estado_usuario ?? "";
        return fallback === "" ? "" : String(fallback);
      });
    } catch (e) {
      console.error("admin.usuarios.load:", e);
      setMsg("No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!idRol) return;
    const exists = filteredRoles.some((rol) => String(rol.id_rol) === String(idRol));
    if (!exists) {
      setIdRol(filteredRoles[0] ? String(filteredRoles[0].id_rol) : "");
    }
  }, [idRol, filteredRoles]);

  useEffect(() => {
    if (!idEstado) return;
    const exists = filteredEstados.some((estado) => String(estado.id_estado_usuario) === String(idEstado));
    if (!exists) {
      setIdEstado(filteredEstados[0] ? String(filteredEstados[0].id_estado_usuario) : "");
    }
  }, [idEstado, filteredEstados]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!idRol || !idEstado) {
      setMsg("Debes seleccionar rol y estado.");
      return;
    }

    try {
      await asegurarOActualizarUsuario({
        dni: normalizedDni,
        id_rol: Number(idRol),
        id_estado_usuario: Number(idEstado),
      });
      setMsg("Usuario actualizado correctamente");
      setDni("");
      await load();
    } catch (e) {
      setMsg(getErrorMessage(e, "Error actualizando usuario"));
    }
  }

  async function onResetPassword(u) {
    const nueva = prompt(`Nueva contraseña para DNI ${u.dni}:`);
    if (!nueva) return;
    try {
      await resetPasswordUsuario(u.id_usuario, nueva);
      setMsg("Clave restablecida");
      await load();
    } catch (e) {
      setMsg(getErrorMessage(e, "No se pudo restablecer la clave"));
    }
  }

  const columns = [
    { key: "id_usuario", label: "ID" },
    { key: "dni", label: "DNI" },
    { key: "apellidos_nombres", label: "Apellidos y nombres", render: (u) => u.apellidos_nombres || "-" },
    { key: "rol", label: "Rol" },
    { key: "estado", label: "Estado" },
    { key: "last_login_at", label: "Último login", render: (u) => formatDateTime(u.last_login_at) },
  ];

  return (
    <DashboardLayout title="Administración">
      <div className="grid-cards" style={{ gridTemplateColumns: "1.1fr 1.6fr" }}>
        <Card title="Actualizar usuario">
          <form className="form" onSubmit={onSubmit}>
            <Input label="DNI" value={dni} onChange={(e) => setDni(e.target.value)} required />
            {currentUser ? (
              <Badge variant="outline">
                Actual: {currentUser.rol} / {currentUser.estado}
              </Badge>
            ) : null}
            <label className="ins-field">
              <span>Rol</span>
              <select
                className="ins-input"
                value={idRol}
                onChange={(e) => setIdRol(e.target.value)}
                required
                disabled={roleSelectDisabled}
              >
                <option value="">Selecciona un rol</option>
                {filteredRoles.map((rol) => (
                  <option key={rol.id_rol} value={String(rol.id_rol)}>
                    {rol.nombre_rol}
                  </option>
                ))}
              </select>
            </label>
            <label className="ins-field">
              <span>Estado</span>
              <select
                className="ins-input"
                value={idEstado}
                onChange={(e) => setIdEstado(e.target.value)}
                required
                disabled={estadoSelectDisabled}
              >
                <option value="">Selecciona un estado</option>
                {filteredEstados.map((estado) => (
                  <option key={estado.id_estado_usuario} value={String(estado.id_estado_usuario)}>
                    {estado.nombre_estado}
                  </option>
                ))}
              </select>
            </label>
            {supremeAdmin ? (
              <div className="help">
                ADMIN PRINCIPAL SUPREMO: acceso total de modificación.
              </div>
            ) : null}
            {!supremeAdmin && isAdminPrincipalRole(actorRole) && isAdminPrincipalRole(currentUser?.rol) ? (
              <div className="help">
                Un ADMIN_PRINCIPAL no puede modificar a otro ADMIN_PRINCIPAL.
              </div>
            ) : null}
            {isAdminRoleOnly(actorRole) && isAdminRoleOnly(currentUser?.rol) ? (
              <div className="help">
                Un ADMIN no puede cambiar el rol ni el estado de otro ADMIN.
              </div>
            ) : null}
            {isAdminRoleOnly(actorRole) && isAdminPrincipalRole(currentUser?.rol) ? (
              <div className="help">
                Un ADMIN no puede modificar a un ADMIN_PRINCIPAL.
              </div>
            ) : null}
            <Button variant="primary" type="submit">Actualizar</Button>
            {msg && <Badge>{msg}</Badge>}
          </form>
        </Card>

        <Card title="Usuarios">
          <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
            <label className="ins-field" style={{ marginTop: 0, minWidth: 220 }}>
              <span>Filtrar por rol</span>
              <select
                className="ins-input"
                value={rolFilter}
                onChange={(e) => setRolFilter(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                <option value="ADMIN_PRINCIPAL">ADMIN_PRINCIPAL</option>
                <option value="ADMIN">ADMIN</option>
                <option value="INSPECTOR">INSPECTOR</option>
              </select>
            </label>
            <Badge variant="outline">
              Cantidad: {filteredRowsByRole.length}
            </Badge>
          </div>
          <Table
            columns={columns}
            data={filteredRowsByRole}
            emptyText={loading ? "Cargando..." : "Sin usuarios"}
            renderActions={(u) =>
              !supremeAdmin && isAdminAnyRole(actor?.rol) && isAdminAnyRole(u?.rol) ? null : (
                <Button variant="ghost" onClick={() => onResetPassword(u)}>
                  Restablecer clave
                </Button>
              )
            }
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}
