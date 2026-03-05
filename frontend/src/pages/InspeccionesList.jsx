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
import { listarPlantillas } from "../api/plantillas.api";

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

      const plantillaIdNum = Number.isFinite(Number(plantillaId)) ? Number(plantillaId) : null;

      // 1) Traer inspecciones como ya haces
      const list = await listarInspecciones(); // o tu llamada actual con filtros
      const next =
        plantillaIdNum != null
          ? list.filter((it) => Number(it?.id_plantilla_inspec) === plantillaIdNum)
          : list;

      setItems(next);

      // 2) Título: si hay items, usa eso
      if (plantillaIdNum != null && next.length > 0) {
        const nombre = next[0]?.nombre_formato || "Inspecciones";
        const cod = String(next[0]?.codigo_formato ?? "").trim();
        const codigo = cod ? ` (${cod})` : "";
        setPageTitle(`${nombre}${codigo}`);
        return;
      }

      // 3) Si NO hay items, igual resuelve título desde tabla de plantillas
      if (plantillaIdNum != null) {
        // 1) traer plantilla desde catálogo (siempre)
        const plantillas = await listarPlantillas();
        const p = plantillas.find((x) => Number(x?.id_plantilla_inspec) === plantillaIdNum);

        // helper
        const buildTitle = (nombreRaw) => String(nombreRaw ?? "Inspecciones").trim();

        // 2) preferir catálogo de plantillas (más confiable)
        if (p) {
          setPageTitle(buildTitle(p.nombre_formato));
        } else if (next.length > 0) {
          // 3) fallback: usar lo que venga en el listado
          setPageTitle(buildTitle(next[0]?.nombre_formato));
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
  }, [location.key]);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  const columns = [
    { key: "id", label: "ID", render: (it) => it.id_inspeccion ?? "-" },

    {
      key: "fecha",
      label: "Fecha",
      render: (it) => {
        const raw = it.fecha_inspeccion ?? it.created_at ?? "";
        return raw ? String(raw).slice(0, 10) : "-";
      },
    },

    { key: "area", label: "Area", render: (it) => it.desc_area ?? it.id_area ?? "-" },
    { key: "estado", label: "Estado", render: (it) => it.estado_inspeccion ?? it.id_estado_inspeccion ?? "-" },

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
          <Input label="id_estado_inspeccion" name="id_estado_inspeccion" value={filters.id_estado_inspeccion} onChange={onChange} placeholder="Ej: 1" />
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
        <Table
          columns={columns}
          data={items}
          emptyText={loading ? "Cargando..." : "Sin registros."}
          renderActions={(it) => (
            <button
              type="button"
              onClick={() => navigate(`/inspecciones/${it.id_inspeccion}`)}
              style={{
                padding: 0,
                border: 0,
                background: "transparent",
                color: "#f97316",
                textDecoration: "none", // 👈 sin subrayado
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Ver detalle
            </button>
          )}
        />
      </Card>
    </DashboardLayout>
  );
}
