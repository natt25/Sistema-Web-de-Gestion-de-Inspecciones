// frontend/src/pages/Pendientes.jsx
import { useEffect, useMemo, useState } from "react";
import { listarPendientes } from "../api/pendientes.api";
import { getUser } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diffDays(desdeISO, hastaISO) {
  if (!desdeISO || !hastaISO) return 7;
  const a = new Date(desdeISO);
  const b = new Date(hastaISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 7;

  // Normaliza a medianoche para evitar desfases por hora
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  const ms = b.getTime() - a.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1; // inclusivo
  return Math.max(1, Math.min(3650, days)); // hard cap por seguridad
}

function rangeToDias(range) {
  if (range === "7d") return 7;
  if (range === "1m") return 30;
  if (range === "3m") return 90;
  if (range === "6m") return 180;
  if (range === "1y") return 365;
  return 7;
}

export default function Pendientes() {
  const user = getUser();

  const [filters, setFilters] = useState({
    range: "7d",
    desde: "",
    hasta: "",
    soloMias: 0,
  });

  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setMsg,
    label: "Pendientes.load",
    timeoutMs: 8000,
  });

  const diasComputed = useMemo(() => {
    if (filters.range === "custom") return diffDays(filters.desde, filters.hasta);
    return rangeToDias(filters.range);
  }, [filters.range, filters.desde, filters.hasta]);

  const rangeLabel = useMemo(() => {
    const map = {
      "7d": "7 días",
      "1m": "1 mes",
      "3m": "3 meses",
      "6m": "6 meses",
      "1y": "1 año",
      "custom": "Personalizado",
    };
    return map[filters.range] || "7 días";
  }, [filters.range]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listarPendientes({ dias: diasComputed, solo_mias: filters.soloMias });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setMsg("No se pudo cargar pendientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // carga inicial (7 días)
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "soloMias") {
      setFilters((p) => ({ ...p, soloMias: checked ? 1 : 0 }));
      return;
    }

    setFilters((p) => ({ ...p, [name]: value }));
  }

  const columns = [
    { key: "id_accion", label: "ID Acción" },
    { key: "id_observacion", label: "Obs", render: (a) => a.id_observacion ?? "-" },
    { key: "desc_accion", label: "Descripción", render: (a) => a.desc_accion ?? a.descripcion ?? "-" },
    { key: "responsable", label: "Responsable", render: (a) => a.responsable ?? "-" },
    {
      key: "fecha_compromiso",
      label: "Fecha",
      render: (a) => (a.fecha_compromiso ? String(a.fecha_compromiso).slice(0, 10) : "-"),
    },
    { key: "estado", label: "Estado", render: (a) => a.estado ?? "-" },
    { key: "dias_restantes", label: "Días", render: (a) => a.dias_restantes ?? "-" },
  ];

  const hint = useMemo(() => {
    if (filters.range !== "custom") return `Mostrando por: ${rangeLabel} (≈ ${diasComputed} días)`;
    if (!filters.desde || !filters.hasta) return "Elige 'desde' y 'hasta' para el rango personalizado.";
    return `Rango: ${filters.desde} → ${filters.hasta} (≈ ${diasComputed} días)`;
  }, [filters.range, filters.desde, filters.hasta, rangeLabel, diasComputed]);

  return (
    <DashboardLayout title="Pendientes">
      <Card title="Filtros">
        <div className="grid-cards filters-grid">
          <label className="ins-field">
            <span>Rango</span>
            <select className="ins-input" name="range" value={filters.range} onChange={onChange}>
              <option value="7d">7 días</option>
              <option value="1m">1 mes</option>
              <option value="3m">3 meses</option>
              <option value="6m">6 meses</option>
              <option value="1y">1 año</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          {filters.range === "custom" ? (
            <>
              <Input label="Desde" type="date" name="desde" value={filters.desde} onChange={onChange} />
              <Input label="Hasta" type="date" name="hasta" value={filters.hasta} onChange={onChange} />
            </>
          ) : (
            <>
              <div className="ins-field">
                <span>Desde (auto)</span>
                <input className="ins-input" value="—" disabled />
              </div>
              <div className="ins-field">
                <span>Hasta (auto)</span>
                <input className="ins-input" value={formatDateISO(new Date())} disabled />
              </div>
            </>
          )}

          <label className="input-row" style={{ alignSelf: "end" }}>
            <span className="label">Solo mis acciones</span>
            <input
              className="input"
              type="checkbox"
              name="soloMias"
              checked={filters.soloMias === 1}
              onChange={onChange}
            />
          </label>
        </div>

        <div className="actions" style={{ marginTop: 12, gap: 10 }}>
          <Button
            variant="primary"
            onClick={() => {
              // validación mínima en personalizado
              if (filters.range === "custom" && (!filters.desde || !filters.hasta)) {
                setMsg("Completa 'desde' y 'hasta' para el rango personalizado.");
                return;
              }
              load();
            }}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Aplicar filtros"}
          </Button>

          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setFilters({ range: "7d", desde: "", hasta: "", soloMias: 0 });
              setMsg("");
              setTimeout(load, 0);
            }}
            disabled={loading}
          >
            Limpiar
          </Button>

          {msg ? <Badge>{msg}</Badge> : null}
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{hint}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Usuario: {user?.dni} ({user?.rol})
          </div>
        </div>
      </Card>

      <Card title="Listado">
        <Table columns={columns} data={rows} emptyText={loading ? "Cargando..." : "No hay pendientes"} />
      </Card>
    </DashboardLayout>
  );
}