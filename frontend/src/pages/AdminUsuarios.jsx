import { useEffect, useState } from "react";
import {
  listarUsuarios,
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

export default function AdminUsuarios() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [dni, setDni] = useState("");
  const [idRol, setIdRol] = useState(3);
  const [idEstado, setIdEstado] = useState(1);
  const [password, setPassword] = useState("Cambio123*");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listarUsuarios();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e) {
    e.preventDefault();
    setMsg("");
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
    const nueva = prompt(`Nueva contraseÃ±a para DNI ${u.dni}:`);
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
            <Input label="Rol (id_rol)" type="number" value={idRol} onChange={(e) => setIdRol(e.target.value)} />
            <Input label="Estado (id_estado_usuario)" type="number" value={idEstado} onChange={(e) => setIdEstado(e.target.value)} />
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
