import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import { listarPendientes } from "../api/pendientes.api";
import { listarInspecciones } from "../api/inspecciones.api";

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.recordset)) return payload.recordset;
  return [];
}

function estadoBadge(estadoRaw) {
  const e = String(estadoRaw || "").trim().toUpperCase().replace(/[_-]+/g, " ");
  if (e === "VENCIDA") return { text: "VENCIDA", bg: "#fee2e2", color: "#b91c1c" };
  if (e === "EN PROGRESO") return { text: "EN PROGRESO", bg: "#dbeafe", color: "#1d4ed8" };
  if (e === "CERRADA") return { text: "CERRADA", bg: "#dcfce7", color: "#166534" };
  return { text: "PENDIENTE", bg: "#fef3c7", color: "#92400e" };
}

function normalizeEstado(estadoRaw) {
  return String(estadoRaw || "").trim().toUpperCase().replace(/[_-]+/g, " ");
}

const cellTextStyle = {
  display: "block",
  maxWidth: 280,
  lineHeight: 1.4,
  wordBreak: "break-word",
};

export default function Home() {
  const navigate = useNavigate();
  const user = getUser();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    pendientes: 0,
    vencidas: 0,
    enProceso: 0,
    cerradas: 0,
  });
  const [misAcciones, setMisAcciones] = useState([]);
  const [inspeccionesRecientes, setInspeccionesRecientes] = useState([]);
  const [pendientesError, setPendientesError] = useState("");
  const [inspeccionesError, setInspeccionesError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!alive) return;
      setLoading(true);
      setPendientesError("");
      setInspeccionesError("");

      const results = await Promise.allSettled([
        listarPendientes({
          dias: null,
          solo_mias: 1,
          estado: "ALL",
          id_usuario: user?.id_usuario,
        }),
        listarInspecciones({}),
      ]);

      if (results[0].status === "fulfilled") {
        const rows = normalizeRows(results[0].value);
        const pendientes = rows.filter((x) => normalizeEstado(x?.estado) === "PENDIENTE").length;
        const vencidas = rows.filter((x) => normalizeEstado(x?.estado) === "VENCIDA").length;
        const enProceso = rows.filter((x) => normalizeEstado(x?.estado) === "EN PROGRESO").length;
        const cerradas = rows.filter((x) => normalizeEstado(x?.estado) === "CERRADA").length;

        const sortedAcciones = rows
          .filter((x) => normalizeEstado(x?.estado) !== "CERRADA")
          .sort((a, b) => {
            const da = Number(a?.dias_restantes);
            const db = Number(b?.dias_restantes);
            const aV = Number.isFinite(da) && da < 0;
            const bV = Number.isFinite(db) && db < 0;
            if (aV !== bV) return aV ? -1 : 1;
            if (!Number.isFinite(da) && !Number.isFinite(db)) return 0;
            if (!Number.isFinite(da)) return 1;
            if (!Number.isFinite(db)) return -1;
            return da - db;
          });

        if (alive) {
          setKpis({ pendientes, vencidas, enProceso, cerradas });
          setMisAcciones(sortedAcciones.slice(0, 6));
        }
      } else {
        console.error("[HOME] Fallo listarPendientes:", results[0].reason);
        if (alive) {
          setKpis({ pendientes: 0, vencidas: 0, enProceso: 0, cerradas: 0 });
          setMisAcciones([]);
          setPendientesError("No se pudo cargar KPIs/Pendientes.");
        }
      }

      if (results[1].status === "fulfilled") {
        const inspRows = normalizeRows(results[1].value);
        const sortedInsp = [...inspRows].sort((a, b) => {
          const ta = new Date(a?.created_at || a?.fecha_inspeccion || 0).getTime();
          const tb = new Date(b?.created_at || b?.fecha_inspeccion || 0).getTime();
          return tb - ta;
        });
        if (alive) {
          setInspeccionesRecientes(sortedInsp.slice(0, 6));
        }
      } else {
        console.error("[HOME] Fallo listarInspecciones:", results[1].reason);
        if (alive) {
          setInspeccionesRecientes([]);
          setInspeccionesError("No se pudo cargar inspecciones recientes.");
        }
      }

      if (alive) setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [user?.id_usuario]);

  const kpiCards = useMemo(
    () => [
      { title: "Pendientes", value: kpis.pendientes, accent: "#f97316" },
      { title: "Vencidas", value: kpis.vencidas, accent: "#ef4444" },
      { title: "En progreso", value: kpis.enProceso, accent: "#3b82f6" },
      { title: "Cerradas", value: kpis.cerradas, accent: "#22c55e" },
    ],
    [kpis]
  );

  const colsAcciones = useMemo(
    () => [
      {
        key: "inspeccion",
        label: "Inspeccion",
        render: (a) => {
          const nombre = a?.nombre_formato || "Inspeccion";
          return <span style={{ ...cellTextStyle, fontWeight: 800 }}>{nombre}</span>;
        },
      },
      {
        key: "desc_accion",
        label: "Descripcion",
        render: (a) => <span style={cellTextStyle}>{a?.desc_accion || "-"}</span>,
      },
      {
        key: "responsables",
        label: "Responsables",
        render: (a) => <span style={{ ...cellTextStyle, maxWidth: 240 }}>{a?.responsables || "-"}</span>,
      },
      {
        key: "fecha_compromiso",
        label: "Fecha",
        render: (a) => (a?.fecha_compromiso ? String(a.fecha_compromiso).slice(0, 10) : "-"),
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
                fontWeight: 900,
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
        label: "Dias",
        render: (a) => {
          const val = Number(a?.dias_restantes);
          if (!Number.isFinite(val)) return a?.dias_restantes ?? "-";
          const color = val < 0 ? "#b91c1c" : val > 0 ? "#16a34a" : "#92400e";
          return <span style={{ color, fontWeight: 900 }}>{val}</span>;
        },
      },
    ],
    []
  );

  const colsInspecciones = useMemo(
    () => [
      { key: "id_inspeccion", label: "ID", render: (it) => it?.id_inspeccion ?? "-" },
      {
        key: "tipo",
        label: "Tipo",
        render: (it) => (
          <span style={cellTextStyle}>
            {it?.nombre_formato || it?.codigo_formato || `Plantilla ${it?.id_plantilla_inspec ?? "-"}`}
          </span>
        ),
      },
      { key: "area", label: "Area", render: (it) => it?.desc_area || it?.area || it?.id_area || "-" },
      {
        key: "estado",
        label: "Estado",
        render: (it) => {
          const ui = estadoBadge(it?.estado_inspeccion_calculado || it?.estado || it?.estado_inspeccion);
          return (
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 999,
                background: ui.bg,
                color: ui.color,
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {ui.text}
            </span>
          );
        },
      },
      {
        key: "fecha",
        label: "Fecha",
        render: (it) => {
          const raw = it?.fecha_inspeccion || it?.created_at;
          return raw ? String(raw).slice(0, 10) : "-";
        },
      },
    ],
    []
  );

  return (
    <DashboardLayout title="Home">
      <div className="grid-cards" style={{ marginBottom: 14 }}>
        {kpiCards.map((c) => (
          <Card key={c.title} title={c.title}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 1000, color: c.accent }}>{loading ? "..." : c.value}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{c.title}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="home-panels">
        <Card
          title="Mis acciones (pendientes / vencidas)"
          actions={
            <Button variant="outline" onClick={() => navigate("/pendientes")}>
              Ver todas
            </Button>
          }
        >
          <Table
            columns={colsAcciones}
            data={misAcciones}
            emptyText={loading ? "Cargando..." : pendientesError || "No tienes acciones pendientes."}
            renderActions={(a) => (
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <button
                  type="button"
                  onClick={() => a?.id_inspeccion && navigate(`/inspecciones/${a.id_inspeccion}`)}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    color: "#f97316",
                    textDecoration: "none",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Ver detalle
                </button>
              </div>
            )}
          />
        </Card>

        <Card
          title="Inspecciones recientes"
          actions={
            <Button variant="outline" onClick={() => navigate("/inspecciones")}>
              Ver listado
            </Button>
          }
        >
          <Table
            columns={colsInspecciones}
            data={inspeccionesRecientes}
            emptyText={loading ? "Cargando..." : inspeccionesError || "Sin inspecciones recientes."}
            renderActions={(it) => (
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <button
                  type="button"
                  onClick={() => it?.id_inspeccion && navigate(`/inspecciones/${it.id_inspeccion}`)}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    color: "#f97316",
                    textDecoration: "none",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Ver detalle
                </button>
              </div>
            )}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}
