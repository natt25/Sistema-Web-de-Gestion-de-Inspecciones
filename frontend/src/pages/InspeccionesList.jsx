import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { listarInspecciones } from "../api/inspecciones.api";
import { clearToken } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";

function normalizeArray(payload) {
  if (Array.isArray(payload)) return payload;

  // si backend devuelve { data: [...] }
  if (Array.isArray(payload?.data)) return payload.data;

  // si backend devuelve { ok:true, data:[...] }
  if (payload?.ok === true && Array.isArray(payload?.data)) return payload.data;

  // si backend devuelve { rows: [...] }
  if (Array.isArray(payload?.rows)) return payload.rows;

  // si backend devuelve { recordset: [...] }
  if (Array.isArray(payload?.recordset)) return payload.recordset;

  return [];
}

function toInputDate(value) {
  return value || "";
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getRangeDates(range, customDesde, customHasta) {
  const today = new Date();
  const end = formatDateISO(today);

  if (range === "custom") {
    return { desde: customDesde || "", hasta: customHasta || "" };
  }

  const from = new Date(today);
  if (range === "7d") from.setDate(from.getDate() - 7);
  if (range === "1m") from.setMonth(from.getMonth() - 1);
  if (range === "3m") from.setMonth(from.getMonth() - 3);
  if (range === "6m") from.setMonth(from.getMonth() - 6);
  if (range === "1y") from.setFullYear(from.getFullYear() - 1);
  return { desde: formatDateISO(from), hasta: end };
}

export default function InspeccionesList() {
  const navigate = useNavigate();
  const location = useLocation();

  const [filters, setFilters] = useState({
    id_area: "",
    id_estado_inspeccion: "",
    range: "7d",
    desde: "",
    hasta: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setError,
    label: "InspeccionesList.load",
    timeoutMs: 8000,
  });

  const queryParams = useMemo(() => {
    const p = {};
    if (filters.id_area) p.id_area = Number(filters.id_area);
    if (filters.id_estado_inspeccion) p.id_estado_inspeccion = Number(filters.id_estado_inspeccion);
    const { desde, hasta } = getRangeDates(filters.range, filters.desde, filters.hasta);
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
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
  }, [location.key]);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  const columns = [
    { key: "id", label: "ID", render: (it) => it.id_inspeccion ?? "-" },
    { key: "fecha", label: "Fecha", render: (it) => it.fecha_inspeccion ?? it.created_at ?? "-" },
    { key: "area", label: "Area", render: (it) => it.desc_area ?? it.id_area ?? "-" },
    { key: "estado", label: "Estado", render: (it) => it.estado_inspeccion ?? it.id_estado_inspeccion ?? "-" },
    { key: "usuario", label: "Usuario", render: (it) => it.id_usuario ?? "-" }, // si no estás trayendo nombre aún
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
        <div className="grid-cards filters-grid">
          <Input label="id_area" name="id_area" value={filters.id_area} onChange={onChange} placeholder="Ej: 1" />
          <Input label="id_estado_inspeccion" name="id_estado_inspeccion" value={filters.id_estado_inspeccion} onChange={onChange} placeholder="Ej: 1" />
          <label className="ins-field">
            <span>Rango</span>
            <select className="ins-input" name="range" value={filters.range} onChange={onChange}>
              <option value="7d">7 dias</option>
              <option value="1m">1 mes</option>
              <option value="3m">3 meses</option>
              <option value="6m">6 meses</option>
              <option value="1y">1 ano</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {filters.range === "custom" ? (
            <>
              <Input label="desde" type="date" name="desde" value={toInputDate(filters.desde)} onChange={onChange} />
              <Input label="hasta" type="date" name="hasta" value={toInputDate(filters.hasta)} onChange={onChange} />
            </>
          ) : null}
        </div>

        <div className="actions" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={load} disabled={loading}>
            Aplicar filtros
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setFilters({ id_area: "", id_estado_inspeccion: "", range: "7d", desde: "", hasta: "" });
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
