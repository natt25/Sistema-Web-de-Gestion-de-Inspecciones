import { useEffect, useState } from "react";
import {
  listarUsuarios,
  crearUsuario,
  cambiarEstadoUsuario,
  resetPasswordUsuario,
} from "../api/usuarios.api";

export default function AdminUsuarios() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // form crear
  const [dni, setDni] = useState("");
  const [idRol, setIdRol] = useState(3); // 1=ADMIN_PRINCIPAL,2=ADMIN,3=INSPECTOR (ajusta según tu tabla)
  const [idEstado, setIdEstado] = useState(1); // 1=ACTIVO (ajusta)
  const [password, setPassword] = useState("Cambio123*"); // inicial

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listarUsuarios();
      setRows(data);
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
      setMsg("✅ Usuario creado");
      setDni("");
      await load();
    } catch (e) {
      setMsg(e?.message || "Error creando usuario");
    }
  }

  async function toggleActivo(u) {
    // aquí depende de tu catálogo de estados; asumo 1=ACTIVO y 2=INACTIVO
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
      setMsg("✅ Password reseteado (usuario debe cambiar al ingresar)");
      await load();
    } catch {
      setMsg("No se pudo resetear password");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Administración de Usuarios</h2>
      {msg && <p>{msg}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <form onSubmit={onCreate} style={{ border: "1px solid #ddd", padding: 12 }}>
          <h3>Crear usuario</h3>
          <div>
            <label>DNI</label>
            <input value={dni} onChange={(e) => setDni(e.target.value)} required />
          </div>

          <div>
            <label>Rol (id_rol)</label>
            <input type="number" value={idRol} onChange={(e) => setIdRol(e.target.value)} />
            <small>Ej: 1=ADMIN_PRINCIPAL, 2=ADMIN, 3=INSPECTOR</small>
          </div>

          <div>
            <label>Estado (id_estado_usuario)</label>
            <input type="number" value={idEstado} onChange={(e) => setIdEstado(e.target.value)} />
            <small>Ej: 1=ACTIVO, 2=INACTIVO</small>
          </div>

          <div>
            <label>Password inicial</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button type="submit">Crear</button>
        </form>

        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h3>Usuarios</h3>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>DNI</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Locked</th>
                    <th>Último login</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id_usuario}>
                      <td>{u.id_usuario}</td>
                      <td>{u.dni}</td>
                      <td>{u.rol}</td>
                      <td>{u.estado}</td>
                      <td>{u.locked_until ? "Sí" : "No"}</td>
                      <td>{u.last_login_at ? String(u.last_login_at) : "-"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => toggleActivo(u)}>
                          {String(u.estado).toUpperCase() === "ACTIVO" ? "Desactivar" : "Activar"}
                        </button>{" "}
                        <button onClick={() => onResetPassword(u)}>Reset PW</button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan="7">Sin usuarios</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
