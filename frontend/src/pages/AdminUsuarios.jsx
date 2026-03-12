import { useEffect, useState } from "react";
import {
  listarUsuarios,
  listarCatalogosUsuarios,
  crearUsuario,
  cambiarEstadoUsuario,
  resetPasswordUsuario,
} from "../api/usuarios.api";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";

export default function AdminUsuarios() {
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
  const [password, setPassword] = useState("Cambio123*");

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

  async function onCreate(e) {
    e.preventDefault();
    setMsg("");

    if (!idRol || !idEstado) {
      setMsg("Debes seleccionar rol y estado.");
      return;
    }

    try {
      await crearUsuario({ dni, id_rol: Number(idRol), id_estado_usuario: Number(idEstado), password });
      setMsg("Usuario creado");
      setDni("");
      await load();
    } catch (e) {
      setMsg(e?.message || "Error creando usuario");
    }
  }

  async function toggleActivo(u) {
    const next = String(u.estado).toUpperCase() === "ACTIVO" ? 2 : 1;
    try {
      await cambiarEstadoUsuario(u.id_usuario, next);
      await load();
    } catch {
      setMsg("No se pudo cambiar estado");
    }
  }

  async function onResetPassword(u) {
    const nueva = prompt(`Nueva contraseña para DNI ${u.dni}:`);
    if (!nueva) return;
    try {
      await resetPasswordUsuario(u.id_usuario, nueva);
      setMsg("Password reseteado");
      await load();
    } catch {
      setMsg("No se pudo resetear password");
    }
  }

  const columns = [
    { key: "id_usuario", label: "ID" },
    { key: "dni", label: "DNI" },
    { key: "rol", label: "Rol" },
    { key: "estado", label: "Estado" },
    { key: "locked_until", label: "Locked", render: (u) => (u.locked_until ? "Si" : "No") },
    { key: "last_login_at", label: "Ultimo login", render: (u) => (u.last_login_at ? String(u.last_login_at) : "-") },
  ];

  return (
    <DashboardLayout title="Administracion">
      <div className="grid-cards" style={{ gridTemplateColumns: "1.1fr 1.6fr" }}>
        <Card title="Crear usuario">
          <form className="form" onSubmit={onCreate}>
            <Input label="DNI" value={dni} onChange={(e) => setDni(e.target.value)} required />
            <label className="ins-field">
              <span>Rol</span>
              <select className="ins-input" value={idRol} onChange={(e) => setIdRol(e.target.value)} required>
                <option value="">Selecciona un rol</option>
                {roles.map((rol) => (
                  <option key={rol.id_rol} value={String(rol.id_rol)}>
                    {rol.nombre_rol}
                  </option>
                ))}
              </select>
            </label>
            <label className="ins-field">
              <span>Estado</span>
              <select className="ins-input" value={idEstado} onChange={(e) => setIdEstado(e.target.value)} required>
                <option value="">Selecciona un estado</option>
                {estados.map((estado) => (
                  <option key={estado.id_estado_usuario} value={String(estado.id_estado_usuario)}>
                    {estado.nombre_estado}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Password inicial" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="primary" type="submit">Crear</Button>
            {msg && <Badge>{msg}</Badge>}
          </form>
        </Card>

        <Card title="Usuarios">
          <Table
            columns={columns}
            data={rows}
            emptyText={loading ? "Cargando..." : "Sin usuarios"}
            renderActions={(u) => (
              <>
                <Button variant="outline" onClick={() => toggleActivo(u)}>
                  {String(u.estado).toUpperCase() === "ACTIVO" ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="ghost" onClick={() => onResetPassword(u)}>Reset PW</Button>
              </>
            )}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}
