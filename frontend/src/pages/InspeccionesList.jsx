import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarInspecciones } from "../api/inspecciones.api";
import { clearToken } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function toInputDate(value) {
  return value || "";
}

export default function InspeccionesList() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    id_area: "",
    id_estado_inspeccion: "",
    id_usuario: "",
    desde: "",
    hasta: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const queryParams = useMemo(() => {
    const p = {};
    if (filters.id_area) p.id_area = Number(filters.id_area);
    if (filters.id_estado_inspeccion) p.id_estado_inspeccion = Number(filters.id_estado_inspeccion);
    if (filters.id_usuario) p.id_usuario = Number(filters.id_usuario);
    if (filters.desde) p.desde = filters.desde;
    if (filters.hasta) p.hasta = filters.hasta;
    return p;
  }, [filters]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await listarInspecciones(queryParams);
      setItems(normalizeArray(data));
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

      if (status === 401) setError("Sesion expirada (401). Vuelve a iniciar sesion.");
      else if (status === 403) setError("No tienes permisos (403).");
      else if (status === 404) setError("Endpoint no encontrado (404).");
      else if (status === 500) setError("Error interno del servidor (500).");
      else setError(msg || "No se pudo cargar el listado. Revisa backend/CORS.");

      if (status === 401) {
        clearToken();
        navigate("/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  const columns = [
    { key: "id", label: "ID", render: (it) => it.id_inspeccion ?? it.id ?? "-" },
    { key: "fecha", label: "Fecha", render: (it) => it.fecha ?? it.fecha_inspeccion ?? it.created_at ?? "-" },
    { key: "area", label: "Area", render: (it) => it.area ?? it.nom_area ?? it.id_area ?? "-" },
    { key: "estado", label: "Estado", render: (it) => it.estado ?? it.nom_estado ?? it.id_estado_inspeccion ?? it.id_estado ?? "-" },
    { key: "usuario", label: "Usuario", render: (it) => it.usuario ?? it.nom_usuario ?? it.id_usuario ?? "-" },
  ];

  const actions = (
    <div style={{ display: "flex", gap: 10 }}>
      <Button variant="outline" onClick={() => load()} disabled={loading}>
        {loading ? "Cargando..." : "Refrescar"}
      </Button>
      <Button variant="primary" onClick={() => navigate("/inspecciones/nueva")}>
        Nueva inspeccion
      </Button>
    </div>
  );

  return (
    <DashboardLayout title="Inspecciones" actions={actions}>
      <Card title="Filtros">
        <div className="grid-cards" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <Input label="id_area" name="id_area" value={filters.id_area} onChange={onChange} placeholder="Ej: 1" />
          <Input label="id_estado_inspeccion" name="id_estado_inspeccion" value={filters.id_estado_inspeccion} onChange={onChange} placeholder="Ej: 1" />
          <Input label="id_usuario" name="id_usuario" value={filters.id_usuario} onChange={onChange} placeholder="Ej: 5" />
          <Input label="desde" type="date" name="desde" value={toInputDate(filters.desde)} onChange={onChange} />
          <Input label="hasta" type="date" name="hasta" value={toInputDate(filters.hasta)} onChange={onChange} />
        </div>

        <div className="actions" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={load} disabled={loading}>
            Aplicar filtros
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setFilters({ id_area: "", id_estado_inspeccion: "", id_usuario: "", desde: "", hasta: "" });
              setTimeout(load, 0);
            }}
            disabled={loading}
          >
            Limpiar
          </Button>
          {error && <Badge>{error}</Badge>}
        </div>
      </Card>

      <Card title="Listado">
        <Table
          columns={columns}
          data={items}
          emptyText={loading ? "Cargando..." : "Sin registros."}
          renderActions={(it) => (
            <Button
              variant="ghost"
              onClick={() => {
                const id = it.id_inspeccion ?? it.id;
                if (!id) return;
                navigate(`/inspecciones/${id}`);
              }}
            >
              Ver detalle
            </Button>
          )}
        />
      </Card>
    </DashboardLayout>
  );
}
