import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listarInspecciones } from "../api/inspecciones.api";
import { listarClientes, listarAreas, listarLugares, listarServicios } from "../api/catalogos.api";
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

const DEFAULT_ESTADOS = ["BORRADOR", "PENDIENTE", "EN PROGRESO", "CERRADA"];

export default function InspeccionesList() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const plantillaId = params.get("plantilla");
  const plantillaIdNum = plantillaId ? Number(plantillaId) : null;

  const [filters, setFilters] = useState({
    id_cliente: "",
    id_area: "",
    id_lugar: "",
    id_servicio: "",
    range: "7d",
    desde: "",
    hasta: "",
  });
  const [estadoTabla, setEstadoTabla] = useState("ALL");
  const [clientes, setClientes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [servicios, setServicios] = useState([]);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [clientesData, areasData, serviciosData] = await Promise.all([
          listarClientes(),
          listarAreas(),
          listarServicios(),
        ]);
        if (!mounted) return;
        setClientes(Array.isArray(clientesData) ? clientesData : []);
        setAreas(Array.isArray(areasData) ? areasData : []);
        setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      } catch {
        if (mounted) setError("No se pudieron cargar los catálogos de filtros.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!filters.id_area) {
        if (mounted) setLugares([]);
        return;
      }
      try {
        const data = await listarLugares(Number(filters.id_area));
        if (!mounted) return;
        setLugares(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setLugares([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [filters.id_area]);

  const estadoOptions = useMemo(() => {
    const discovered = [...new Set(items.map((it) => String(getEstadoLabel(it) || "").trim()).filter(Boolean))];
    const merged = [...DEFAULT_ESTADOS, ...discovered.filter((v) => !DEFAULT_ESTADOS.includes(v.toUpperCase()))];
    return ["ALL", ...merged];
  }, [items]);

  const queryParams = useMemo(() => {
    const p = {};
    if (filters.id_cliente) p.id_cliente = filters.id_cliente;
    if (filters.id_area) p.id_area = Number(filters.id_area);
    if (filters.id_lugar) p.id_lugar = Number(filters.id_lugar);
    if (filters.id_servicio) p.id_servicio = Number(filters.id_servicio);
    if (estadoTabla && estadoTabla !== "ALL") p.estado = estadoTabla;
    if (Number.isFinite(plantillaIdNum)) p.plantilla = plantillaIdNum;
    const { desde, hasta } = getRangeDates(filters.range, filters.desde, filters.hasta);
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
    return p;
  }, [filters, estadoTabla, plantillaIdNum]);

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
    setFilters((prev) => {
      if (name === "id_area") {
        return { ...prev, id_area: value, id_lugar: "" };
      }
      return { ...prev, [name]: value };
    });
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
      label: (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>ESTADO</span>
          <select
            className="ins-input"
            value={estadoTabla}
            onChange={(e) => setEstadoTabla(e.target.value)}
            style={{ minWidth: 120, height: 30, padding: "0 10px" }}
          >
            {estadoOptions.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
      ),
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
          <label className="ins-field">
            <span>Cliente</span>
            <select className="ins-input" name="id_cliente" value={filters.id_cliente} onChange={onChange}>
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={String(c.id_cliente)} value={String(c.id_cliente)}>
                  {c.raz_social || c.id_cliente}
                </option>
              ))}
            </select>
          </label>

          <label className="ins-field">
            <span>Área</span>
            <select className="ins-input" name="id_area" value={filters.id_area} onChange={onChange}>
              <option value="">Todas</option>
              {areas.map((a) => (
                <option key={String(a.id_area)} value={String(a.id_area)}>
                  {a.desc_area || a.id_area}
                </option>
              ))}
            </select>
          </label>

          <label className="ins-field">
            <span>Lugar</span>
            <select
              className="ins-input"
              name="id_lugar"
              value={filters.id_lugar}
              onChange={onChange}
              disabled={!filters.id_area}
            >
              {!filters.id_area ? <option value="">Selecciona área</option> : <option value="">Todos</option>}
              {lugares.map((l) => (
                <option key={String(l.id_lugar)} value={String(l.id_lugar)}>
                  {l.desc_lugar || l.id_lugar}
                </option>
              ))}
            </select>
          </label>

          <label className="ins-field">
            <span>Servicio</span>
            <select className="ins-input" name="id_servicio" value={filters.id_servicio} onChange={onChange}>
              <option value="">Todos</option>
              {servicios.map((s) => (
                <option key={String(s.id_servicio)} value={String(s.id_servicio)}>
                  {s.nombre_servicio || s.id_servicio}
                </option>
              ))}
            </select>
          </label>

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
