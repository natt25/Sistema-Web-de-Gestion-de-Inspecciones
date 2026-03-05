import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listarInspecciones } from "../api/inspecciones.api";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";
import { listarPlantillas } from "../api/plantillas.api";

function normalizeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.ok === true && Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
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

function formatDateOnly(raw) {
  if (!raw) return "-";
  const str = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function getEstadoVariant(nombreEstado) {
  const e = String(nombreEstado || "").toUpperCase().trim();
  if (!e) return "gray";
  if (e.includes("BORRADOR")) return "gray";
  if (e.includes("PENDIENTE")) return "yellow";
  if (e.includes("PROGRESO")) return "blue";
  if (e.includes("CERRADA") || e.includes("CERRADO") || e.includes("FINALIZ")) return "green";
  return "gray";
}

function getEstadoLabel(it) {
  return it?.estado_inspeccion || it?.nombre_estado_inspeccion || "-";
}

export default function InspeccionesList() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const plantillaId = params.get("plantilla");
  const plantillaIdNum = plantillaId ? Number(plantillaId) : null;

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
  const [pageTitle, setPageTitle] = useState("Inspecciones");

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
    if (Number.isFinite(plantillaIdNum)) p.plantilla = plantillaIdNum;
    const { desde, hasta } = getRangeDates(filters.range, filters.desde, filters.hasta);
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
    return p;
  }, [filters, plantillaIdNum]);

  async function load() {
    try {
      setLoading(true);

      const payload = await listarInspecciones(queryParams);
      const list = normalizeArray(payload);
      setItems(list);

      if (Number.isFinite(plantillaIdNum) && list.length > 0) {
        const nombre = list[0]?.nombre_formato || "Inspecciones";
        const cod = String(list[0]?.codigo_formato ?? "").trim();
        const codigo = cod ? ` (${cod})` : "";
        setPageTitle(`${nombre}${codigo}`);
        return;
      }

      if (Number.isFinite(plantillaIdNum)) {
        const plantillas = await listarPlantillas();
        const p = plantillas.find((x) => Number(x?.id_plantilla_inspec) === plantillaIdNum);
        if (p) {
          setPageTitle(String(p.nombre_formato ?? "Inspecciones").trim());
        } else {
          setPageTitle(`Inspecciones (Plantilla ${plantillaIdNum})`);
        }
      } else {
        setPageTitle("Inspecciones");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.key, queryParams]);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  const columns = [
    { key: "id", label: "ID", render: (it) => it.id_inspeccion ?? "-" },
    {
      key: "fecha",
      label: "FECHA",
      render: (it) => formatDateOnly(it.fecha_inspeccion || it.created_at),
    },
    {
      key: "cliente",
      label: "CLIENTE",
      render: (it) => it.raz_social || it.otro_cliente_texto || "-",
    },
    { key: "area", label: "AREA", render: (it) => it.desc_area || "-" },
    {
      key: "servicio",
      label: "SERVICIO",
      render: (it) => it.nombre_servicio || it.servicio_detalle || it.otro_servicio_texto || "-",
    },
    {
      key: "estado",
      label: "ESTADO",
      render: (it) => {
        const label = getEstadoLabel(it);
        return <Badge variant={getEstadoVariant(label)}>{label}</Badge>;
      },
    },
    {
      key: "accion",
      label: "ACCIÓN",
      render: (it) => (
        <Link
          to={`/inspecciones/${it.id_inspeccion}`}
          style={{ color: "#f97316", textDecoration: "none", fontWeight: 900 }}
        >
          Ver detalle
        </Link>
      ),
    },
  ];

  return (
    <DashboardLayout title={pageTitle}>
      <Card title="Filtros">
        {Number.isFinite(plantillaIdNum) ? (
          <div style={{ marginBottom: 10 }}>
            <Badge>Filtrando por plantilla: {plantillaIdNum}</Badge>
          </div>
        ) : null}
        <div className="grid-cards filters-grid">
          <Input label="id_area" name="id_area" value={filters.id_area} onChange={onChange} placeholder="Ej: 1" />
          <Input
            label="id_estado_inspeccion"
            name="id_estado_inspeccion"
            value={filters.id_estado_inspeccion}
            onChange={onChange}
            placeholder="Ej: 1"
          />
          <label className="ins-field">
            <span>Rango</span>
            <select className="ins-input" name="range" value={filters.range} onChange={onChange}>
              <option value="7d">7 dias</option>
              <option value="1m">1 mes</option>
              <option value="3m">3 meses</option>
              <option value="6m">6 meses</option>
              <option value="1y">1 año</option>
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
      </Card>

      <Card title="Listado">
        <Table columns={columns} data={items} emptyText={loading ? "Cargando..." : "Sin registros."} />
      </Card>
      {error ? (
        <div style={{ marginTop: 10 }}>
          <Badge variant="red">{error}</Badge>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
