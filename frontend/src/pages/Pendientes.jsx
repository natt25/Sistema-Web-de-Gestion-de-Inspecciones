// frontend/src/pages/Pendientes.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarPendientes } from "../api/pendientes.api";
import { listarPlantillas } from "../api/plantillas.api.js";
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
  if (range === "all") return null;
  return 7;
}

const ESTADO_OPTIONS = ["ALL", "PENDIENTE", "EN_PROGRESO", "VENCIDA", "CERRADA"];

function getEstadoMeta(estadoRaw) {
  const estado = String(estadoRaw || "").trim().toUpperCase();

  if (!estado || estado === "ALL") return { label: "TODOS", className: "badge-all" };
  if (estado.includes("VENC")) return { label: "VENCIDA", className: "badge-vencida" };
  if (estado.includes("PEND")) return { label: "PENDIENTE", className: "badge-pendiente" };
  if (estado.includes("PROG") || estado.includes("EN_PROCESO")) return { label: "EN PROGRESO", className: "badge-progreso" };
  if (estado.includes("CERR")) return { label: "CERRADA", className: "badge-cerrada" };

  return { label: estado.replaceAll("_", " "), className: "badge-all" };
}

function renderEstadoBadge(estadoRaw) {
  const meta = getEstadoMeta(estadoRaw);
  return <span className={`badge ${meta.className}`}>{meta.label}</span>;
}

export default function Pendientes() {
  const navigate = useNavigate();
  const user = getUser();
  const estadoMenuRef = useRef(null);

  const [filters, setFilters] = useState({
    range: "7d",
    desde: "",
    hasta: "",
    soloMias: 1,
    estado: "ALL",
    idPlantilla: "",
  });

  const [rows, setRows] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [estadoMenuOpen, setEstadoMenuOpen] = useState(false);

  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setMsg,
    label: "Pendientes.load",
    timeoutMs: 8000,
  });

  const diasComputed = useMemo(() => {
    if (filters.range === "custom") return diffDays(filters.desde, filters.hasta);
    return rangeToDias(filters.range); // puede devolver null (all)
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
      try {
        const data = await listarPendientes({
          dias: diasComputed,
          solo_mias: filters.soloMias,
          estado: filters.estado,
          id_plantilla_inspec: filters.idPlantilla,
        });
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        const isWideRange =
          filters.range === "3m" ||
          filters.range === "6m" ||
          filters.range === "1y" ||
          filters.range === "all";

        if (!isWideRange) throw e;

        const data = await listarPendientes({
          dias: null,
          solo_mias: filters.soloMias,
          estado: filters.estado,
          id_plantilla_inspec: filters.idPlantilla,
        });
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      setMsg("No se pudo cargar pendientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await listarPlantillas();
        if (!alive) return;
        setPlantillas(Array.isArray(data) ? data : []);
      } catch {
        if (!alive) return;
        setPlantillas([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (filters.range === "custom" && (!filters.desde || !filters.hasta)) {
      setMsg("Completa 'desde' y 'hasta' para el rango personalizado.");
      return;
    }
    setMsg("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasComputed, filters.soloMias, filters.estado, filters.idPlantilla, filters.range, filters.desde, filters.hasta]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "soloMias") {
      setFilters((p) => ({ ...p, soloMias: checked ? 1 : 0 }));
      return;
    }

    setFilters((p) => ({ ...p, [name]: value }));
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!estadoMenuRef.current) return;
      if (!estadoMenuRef.current.contains(e.target)) {
        setEstadoMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const columns = [
    // ID Inspección
    {
      key: "id_inspeccion",
      label: "ID",
      render: (a) => a?.id_inspeccion ?? "-",
    },

    // Inspección
    {
      key: "inspeccion",
      label: "Inspección",
      render: (a) => {
        const nombre = a?.nombre_formato || "Inspección";
        const codigo = a?.codigo_formato || "-";
        return `${nombre} (${codigo})`;
      },
    },

    // Descripción
    {
      key: "desc_accion",
      label: "Descripción",
      render: (a) => <span>{a?.desc_accion ?? a?.descripcion ?? "-"}</span>,
    },

    { key: "responsables", label: "Responsables", render: (a) => a.responsables ?? "-" },

    {
      key: "fecha_compromiso",
      label: "Fecha",
      render: (a) => (a.fecha_compromiso ? String(a.fecha_compromiso).slice(0, 10) : "-"),
    },

    {
      key: "estado",
      label: "Estado",
      render: (a) => renderEstadoBadge(a?.estado),
    },

    {
      key: "dias_restantes",
      label: "Días",
      render: (a) => {
        const val = Number(a?.dias_restantes);
        if (!Number.isFinite(val)) return a?.dias_restantes ?? "-";
        const color = val < 0 ? "#b91c1c" : val > 0 ? "#22c55e" : "#92400e";
        return <span style={{ color, fontWeight: 800 }}>{val}</span>;
      },
    },

    // Acción: link
    {
      key: "accion",
      label: "Acción",
      render: (a) => {
        const idIns = a?.id_inspeccion;
        if (!idIns) return "-";
        return (
          <button
            type="button"
            onClick={() => navigate(`/inspecciones/${idIns}`)}
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
        );
      },
    },
  ];

  const hint = useMemo(() => {
    if (filters.range !== "custom") {
      return diasComputed == null
        ? `Mostrando por: ${rangeLabel} (sin límite de días)`
        : `Mostrando por: ${rangeLabel} (≈ ${diasComputed} días)`;
    }
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

          <label className="ins-field">
            <span>Estado</span>
            <div style={{ position: "relative" }} ref={estadoMenuRef}>
              <button
                type="button"
                className="estado-dd-trigger"
                onClick={() => setEstadoMenuOpen((v) => !v)}
                style={{ width: "100%", justifyContent: "space-between", height: 40, padding: "0 12px" }}
              >
                {renderEstadoBadge(filters.estado)}
                <span className={`estado-dd-tri ${estadoMenuOpen ? "open" : ""}`} />
              </button>

              {estadoMenuOpen ? (
                <div className="estado-dd-menu" style={{ width: "100%" }}>
                  {ESTADO_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="estado-dd-item estado-dd-item-reset"
                      onClick={() => {
                        setFilters((p) => ({ ...p, estado: opt }));
                        setEstadoMenuOpen(false);
                      }}
                    >
                      {renderEstadoBadge(opt)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

          <label className="ins-field">
            <span>Tipo de inspección</span>
            <select className="ins-input" name="idPlantilla" value={filters.idPlantilla} onChange={onChange}>
              <option value="">Todos</option>
              {plantillas.map((plantilla) => {
                const id = plantilla?.id_plantilla_inspec;
                if (id == null) return null;
                const codigo = String(plantilla?.codigo_formato || "").trim() || "-";
                const nombre = String(plantilla?.nombre_formato || "").trim() || "SIN NOMBRE";
                return (
                  <option key={id} value={String(id)}>
                    {`${codigo} - ${nombre}`}
                  </option>
                );
              })}
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

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={filters.soloMias === 1}
                onChange={(e) => setFilters((p) => ({ ...p, soloMias: e.target.checked ? 1 : 0 }))}
                style={{ display: "none" }}
              />

              <span
                style={{
                  width: 44,
                  height: 26,
                  borderRadius: 999,
                  background: filters.soloMias === 1 ? "rgba(34,197,94,.35)" : "rgba(0,0,0,.15)",
                  position: "relative",
                  transition: "0.2s",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: filters.soloMias === 1 ? 21 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "0.2s",
                    boxShadow: "0 2px 8px rgba(0,0,0,.18)",
                  }}
                />
              </span>

              <span style={{ fontWeight: 900, color: filters.soloMias === 1 ? "#166534" : "#374151" }}>
                {filters.soloMias === 1 ? "Activado" : "Desactivado"}
              </span>
            </label>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 12, gap: 10 }}>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setFilters({ range: "7d", desde: "", hasta: "", soloMias: 1, estado: "ALL", idPlantilla: "" });
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
