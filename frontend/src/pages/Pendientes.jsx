import { useEffect, useState } from "react";
import { listarPendientes } from "../api/pendientes.api";
import { getUser } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";

export default function Pendientes() {
  const [dias, setDias] = useState(7);
  const [soloMias, setSoloMias] = useState(0);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listarPendientes({ dias, solo_mias: soloMias });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("No se pudo cargar pendientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dias, soloMias]);

  const user = getUser();

  const columns = [
    { key: "id_accion", label: "ID Accion" },
    { key: "id_observacion", label: "Obs", render: (a) => a.id_observacion ?? "-" },
    { key: "desc_accion", label: "Descripcion", render: (a) => a.desc_accion ?? a.descripcion ?? "-" },
    { key: "responsable", label: "Responsable", render: (a) => a.responsable ?? "-" },
    { key: "fecha_compromiso", label: "Fecha", render: (a) => a.fecha_compromiso ? String(a.fecha_compromiso).slice(0,10) : "-" },
    { key: "estado", label: "Estado", render: (a) => a.estado ?? "-" },
    { key: "dias_restantes", label: "Dias", render: (a) => a.dias_restantes ?? "-" },
  ];

  return (
    <DashboardLayout title="Pendientes">
      <Card title="Parametros">
        <div className="actions">
          <Input
            label="Dias"
            type="number"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            min={1}
            max={60}
          />

          <label className="input-row">
            <span className="label">Solo mis acciones</span>
            <input
              className="input"
              type="checkbox"
              checked={soloMias === 1}
              onChange={(e) => setSoloMias(e.target.checked ? 1 : 0)}
            />
          </label>

          <Button variant="primary" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </Button>
        </div>

        {msg && <Badge>{msg}</Badge>}
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Usuario: {user?.dni} ({user?.rol})
        </div>
      </Card>

      <Card title="Listado">
        <Table columns={columns} data={rows} emptyText={loading ? "Cargando..." : "No hay pendientes"} />
      </Card>
    </DashboardLayout>
  );
}
