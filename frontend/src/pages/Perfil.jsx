import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { getUser } from "../auth/auth.storage";

export default function Perfil() {
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const [firmaFile, setFirmaFile] = useState(null);
  const [firmaPreview, setFirmaPreview] = useState("");

  const nombre = user?.nombre || user?.name || "Usuario";
  const dni = user?.dni || "—";
  const rol = user?.rol || user?.role || "—";
  const email = user?.email || "";

  function onPickFirma(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFirmaFile(file);
    setFirmaPreview(URL.createObjectURL(file));
  }

  async function guardarFirma() {
    // TODO: aquí conectas tu endpoint real para firma
    // Ejemplo:
    // const form = new FormData();
    // form.append("firma", firmaFile);
    // await usuariosApi.subirFirma(form);
    alert("Pendiente: conectar endpoint para guardar firma.");
  }

  return (
    <DashboardLayout title="Mi perfil">
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Datos del usuario">
          <div style={{ display: "grid", gap: 10 }}>
            <div><b>Nombre:</b> {nombre}</div>
            <div><b>DNI:</b> {dni}</div>
            <div><b>Rol:</b> {rol}</div>
            {email ? <div><b>Email:</b> {email}</div> : null}
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Estos datos son solo lectura.
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={() => navigate("/change-password")}>
              Cambiar contraseña
            </Button>
          </div>
        </Card>

        <Card title="Firma">
          <div style={{ display: "grid", gap: 12 }}>
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={onPickFirma}
            />

            {firmaPreview && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 900 }}>Vista previa:</div>
                <img
                  src={firmaPreview}
                  alt="Firma"
                  style={{ maxWidth: 420, width: "100%", borderRadius: 14, border: "1px solid var(--border)" }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button disabled={!firmaFile} onClick={guardarFirma}>
                Guardar firma
              </Button>
              <Button
                variant="ghost"
                disabled={!firmaFile}
                onClick={() => { setFirmaFile(null); setFirmaPreview(""); }}
              >
                Limpiar
              </Button>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Solo puedes actualizar tu firma y tu contraseña.
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
