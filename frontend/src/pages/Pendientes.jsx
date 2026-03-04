// frontend/src/pages/Pendientes.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const user = getUser();

  const [filters, setFilters] = useState({
    range: "7d",
    desde: "",
    hasta: "",
    soloMias: 1,
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
    if (filters.range === "custom" && (!filters.desde || !filters.hasta)) {
      setMsg("Completa 'desde' y 'hasta' para el rango personalizado.");
      return;
    }
    setMsg("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasComputed, filters.soloMias, filters.range, filters.desde, filters.hasta]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "soloMias") {
      setFilters((p) => ({ ...p, soloMias: checked ? 1 : 0 }));
      return;
    }

    setFilters((p) => ({ ...p, [name]: value }));
  }

  function estadoBadge(estadoRaw) {
    const estado = String(estadoRaw || "").trim().toUpperCase();
    if (estado.includes("VENC")) return { text: estadoRaw || "VENCIDO", bg: "#fee2e2", color: "#b91c1c" };
    if (estado.includes("PEND")) return { text: estadoRaw || "PENDIENTE", bg: "#fef3c7", color: "#92400e" };
    if (estado.includes("PROG")) return { text: estadoRaw || "EN PROGRESO", bg: "#dbeafe", color: "#1d4ed8" };
    if (estado.includes("CERR") || estado.includes("COMPLE")) return { text: estadoRaw || "COMPLETADO", bg: "#dcfce7", color: "#166534" };
    return { text: estadoRaw || "-", bg: "#e5e7eb", color: "#374151" };
  }

  const columns = [
    { key: "id_accion", label: "ID Acción" },
    { key: "id_observacion", label: "Obs", render: (a) => a.id_observacion ?? "-" },
    {
      key: "desc_accion",
      label: "Descripción",
      render: (a) => {
        const id = a?.id_inspeccion ?? a?.id_inspec ?? a?.id;
        const text = a?.desc_accion ?? a?.descripcion ?? "-";
        if (!id) return text;
        return (
          <button
            type="button"
            onClick={() => navigate(`/inspecciones/${id}`)}
            style={{
              padding: 0,
              border: 0,
              background: "transparent",
              color: "#2563eb",
              textDecoration: "underline",
              cursor: "pointer",
              textAlign: "left",
            }}
            title="Abrir inspección"
          >
            {text}
          </button>
        );
      },
    },
    { key: "responsable", label: "Responsable", render: (a) => a.responsable ?? "-" },
    {
      key: "fecha_compromiso",
      label: "Fecha",
      render: (a) => (a.fecha_compromiso ? String(a.fecha_compromiso).slice(0, 10) : "-"),
    },
    {
      key: "estado",
      label: "Estado",
      render: (a) => {
        const ui = estadoBadge(a?.estado);
        return (
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: 999,
              background: ui.bg,
              color: ui.color,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {ui.text}
          </span>
        );
      },
    },
    {
      key: "dias_restantes",
      label: "Días",
      render: (a) => {
        const val = Number(a?.dias_restantes);
        if (!Number.isFinite(val)) return a?.dias_restantes ?? "-";
        const color = val < 0 ? "#b91c1c" : val > 0 ? "#166534" : "#92400e";
        return <span style={{ color, fontWeight: 800 }}>{val}</span>;
      },
    },
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

          <div className="ins-field" style={{ alignSelf: "end" }}>
            <span>Solo mis acciones</span>
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, soloMias: p.soloMias === 1 ? 0 : 1 }))}
              style={{
                marginTop: 6,
                height: 40,
                borderRadius: 999,
                border: "1px solid var(--border)",
                padding: "0 14px",
                fontWeight: 800,
                cursor: "pointer",
                background: filters.soloMias === 1 ? "#dcfce7" : "#fff",
                color: filters.soloMias === 1 ? "#166534" : "#374151",
              }}
              title="Mostrar solo acciones asignadas a mí"
            >
              {filters.soloMias === 1 ? "Activo: solo mías" : "Mostrar todas"}
            </button>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 12, gap: 10 }}>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setFilters({ range: "7d", desde: "", hasta: "", soloMias: 1 });
              setMsg("");
            }}
            disabled={loading}
          >
            Limpiar
          </Button>

          {loading ? <Badge>Actualizando...</Badge> : null}
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
