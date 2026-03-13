import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../auth/auth.storage";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { listarPlantillas } from "../api/plantillas.api";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.recordset)) return payload.recordset;
  return [];
}

export default function PlantillasInspeccion() {
  const navigate = useNavigate();
  const user = getUser();
  const esInvitado = String(user?.rol || "").trim().toUpperCase() === "INVITADO";
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const itemRefs = useRef({});

  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setError,
    label: "PlantillasInspeccion.load",
    timeoutMs: 8000,
  });

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setError("");
        setLoading(true);
        const data = await listarPlantillas();
        if (!ok) return;
        const rowsData = normalizeRows(data);
        const onlyActive = rowsData.filter((p) => {
          const estadoNum = Number(p?.estado);
          const estadoTxt = String(p?.estado ?? "").trim().toUpperCase();
          return estadoNum === 1 || estadoTxt === "ACTIVO" || estadoTxt === "HABILITADO";
        });
        const withoutPlantilla1 = onlyActive.filter((p) => Number(p?.id_plantilla_inspec) !== 1);
        setRows(withoutPlantilla1);
      } catch (e) {
        if (!ok) return;
        const status = e?.response?.status;
        const url = e?.config?.url;
        const message = e?.response?.data?.message || e?.message || "Error desconocido";
        console.error("[PlantillasInspeccion] Error cargando plantillas:", {
          status,
          url,
          message,
          data: e?.response?.data,
        });
        setError("No se pudieron cargar las plantillas.");
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      const nombre = String(p?.nombre_formato || "").toLowerCase();
      const codigo = String(p?.codigo_formato || "").toLowerCase();
      return nombre.includes(q) || codigo.includes(q);
    });
  }, [rows, search]);

  const suggestions = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return [];
    return rows
      .filter((p) => {
        const nombre = String(p?.nombre_formato || "").toLowerCase();
        const codigo = String(p?.codigo_formato || "").toLowerCase();
        return nombre.includes(q) || codigo.includes(q);
      })
      .slice(0, 8);
  }, [rows, search]);

  const handlePickSuggestion = (p) => {
    const next = String(p?.nombre_formato || p?.codigo_formato || "");
    setSearch(next);
    setShowSuggest(false);

    const node = itemRefs.current?.[p?.id_plantilla_inspec];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <DashboardLayout title="Plantillas de inspección">
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Selecciona una plantilla para iniciar una inspeccion">
          {loading ? <div>Cargando...</div> : null}
          {error ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}

          <div style={{ position: "relative", marginTop: 12 }}>
            <input
              className="ins-input"
              placeholder="Buscar por nombre o codigo..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => {
                setTimeout(() => setShowSuggest(false), 150);
              }}
            />

            {showSuggest && suggestions.length > 0 ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  boxShadow: "0 18px 55px rgba(17,24,39,.10)",
                  zIndex: 999,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((p) => (
                  <button
                    key={`s-${p.id_plantilla_inspec}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePickSuggestion(p)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: 0,
                      borderBottom: "1px solid var(--border)",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{p?.nombre_formato || "-"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{p?.codigo_formato || "-"}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {filteredRows.map((p) => (
              <div
                key={p.id_plantilla_inspec}
                ref={(el) => {
                  itemRefs.current[p.id_plantilla_inspec] = el;
                }}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  padding: 14,
                  background: "#fff",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>{p.nombre_formato}</div>
                <div style={{ color: "var(--muted)", marginTop: 4 }}>{p.codigo_formato}</div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {!esInvitado ? (
                    <Button onClick={() => navigate(`/inspecciones/nueva?plantilla=${p.id_plantilla_inspec}`)}>
                      Usar plantilla
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => navigate(`/inspecciones?plantilla=${p.id_plantilla_inspec}`)}>
                    Ver inspecciones
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {!loading && filteredRows.length === 0 ? (
            <div style={{ marginTop: 10, color: "var(--muted)" }}>No hay plantillas que coincidan.</div>
          ) : null}
        </Card>
      </div>
    </DashboardLayout>
  );
}
