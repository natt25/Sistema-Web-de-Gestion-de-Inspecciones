import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import { listarPlantillas } from "../api/plantillas.api";
import { listarMisInspecciones } from "../api/inspecciones.api";

const ESTADOS = ["ALL", "PENDIENTE", "EN PROGRESO", "VENCIDA", "CERRADA"];
const RELACIONES = ["ALL", "CREADOR", "PARTICIPANTE", "RESPONSABLE"];

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.recordset)) return payload.recordset;
  return [];
}

function normalizeToken(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function formatDateOnly(raw) {
  if (!raw) return "-";
  const str = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function getEstadoVariant(value) {
  const estado = normalizeToken(value);
  if (estado === "VENCIDA") return "red";
  if (estado === "EN PROGRESO") return "blue";
  if (estado === "CERRADA") return "green";
  return "yellow";
}

export default function MisInspecciones() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    estado: "ALL",
    idPlantilla: "",
    relacion: "ALL",
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [misInspeccionesData, plantillasData] = await Promise.all([
          listarMisInspecciones(),
          listarPlantillas().catch(() => []),
        ]);

        if (!alive) return;
        setRows(normalizeRows(misInspeccionesData));
        setPlantillas(Array.isArray(plantillasData) ? plantillasData : []);
      } catch (err) {
        console.error("misInspecciones.load:", err);
        if (!alive) return;
        setRows([]);
        setError("No se pudo cargar mis inspecciones.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  const filteredRows = useMemo(() => {
    const q = normalizeSearch(filters.q);
    return rows.filter((row) => {
      const estado = normalizeToken(row?.estado_inspeccion_calculado);
      const relacionRaw = String(row?.relacion_usuario || "");
      const relacionTokens = relacionRaw
        .split(",")
        .map((x) => normalizeToken(x))
        .filter(Boolean);

      if (filters.estado !== "ALL" && estado !== normalizeToken(filters.estado)) {
        return false;
      }

      if (filters.idPlantilla && String(row?.id_plantilla_inspec ?? "") !== String(filters.idPlantilla)) {
        return false;
      }

      if (filters.relacion !== "ALL" && !relacionTokens.includes(normalizeToken(filters.relacion))) {
        return false;
      }

      if (!q) return true;

      const haystack = normalizeSearch(
        [
          row?.id_inspeccion,
          row?.codigo_formato,
          row?.nombre_formato,
          row?.desc_area,
          row?.desc_lugar,
          row?.raz_social,
          row?.relacion_usuario,
          row?.estado_inspeccion_calculado,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(q);
    });
  }, [rows, filters]);

  const columns = [
    {
      key: "id_inspeccion",
      label: "ID",
      render: (row) => row?.id_inspeccion ?? "-",
    },
    {
      key: "inspeccion",
      label: "Inspeccion",
      render: (row) => {
        const nombre = String(row?.nombre_formato || "Inspeccion").trim();
        const codigo = String(row?.codigo_formato || "").trim();
        return (
          <div style={{ display: "grid", gap: 4, minWidth: 220 }}>
            <strong style={{ lineHeight: "18px" }}>{nombre}</strong>
            <span style={{ color: "var(--muted)", lineHeight: "18px", wordBreak: "break-word" }}>
              {codigo || `Plantilla ${row?.id_plantilla_inspec ?? "-"}`}
            </span>
          </div>
        );
      },
    },
    {
      key: "fecha",
      label: "Fecha",
      render: (row) => formatDateOnly(row?.fecha_inspeccion || row?.created_at),
    },
    {
      key: "area",
      label: "Area",
      render: (row) => (
        <div style={{ display: "grid", gap: 4, minWidth: 140 }}>
          <span style={{ lineHeight: "18px" }}>{row?.desc_area || "-"}</span>
          <span style={{ color: "var(--muted)", lineHeight: "18px", wordBreak: "break-word" }}>
            {row?.desc_lugar || row?.raz_social || "-"}
          </span>
        </div>
      ),
    },
    {
      key: "estado",
      label: "Estado",
      render: (row) => (
        <Badge variant={getEstadoVariant(row?.estado_inspeccion_calculado)}>
          {row?.estado_inspeccion_calculado || "PENDIENTE"}
        </Badge>
      ),
    },
    {
      key: "relacion_usuario",
      label: "Relacion conmigo",
      render: (row) => row?.relacion_usuario || "-",
    },
    {
      key: "accion",
      label: "Accion",
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/inspecciones/${row?.id_inspeccion}`)}
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
      ),
    },
  ];

  return (
    <DashboardLayout title="Mis inspecciones">
      <Card title="Consulta rapida">
        <div style={{ marginBottom: 12, color: "var(--muted)", lineHeight: "20px" }}>
          Inspecciones donde participaste, creaste o tuviste acciones a cargo.
        </div>

        <div className="grid-cards filters-grid">
          <Input
            label="Buscar"
            name="q"
            value={filters.q}
            onChange={onChange}
            placeholder="ID, formato, area, lugar, cliente..."
          />

          <label className="ins-field">
            <span>Estado</span>
            <select className="ins-input" name="estado" value={filters.estado} onChange={onChange}>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado === "ALL" ? "Todos" : estado}
                </option>
              ))}
            </select>
          </label>

          <label className="ins-field">
            <span>Tipo de inspeccion</span>
            <select className="ins-input" name="idPlantilla" value={filters.idPlantilla} onChange={onChange}>
              <option value="">Todos</option>
              {plantillas.map((plantilla) => {
                const id = plantilla?.id_plantilla_inspec;
                if (id == null) return null;
                return (
                  <option key={id} value={String(id)}>
                    {`${String(plantilla?.codigo_formato || "").trim() || "-"} - ${String(plantilla?.nombre_formato || "").trim() || "SIN NOMBRE"}`}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="ins-field">
            <span>Relacion conmigo</span>
            <select className="ins-input" name="relacion" value={filters.relacion} onChange={onChange}>
              {RELACIONES.map((relacion) => (
                <option key={relacion} value={relacion}>
                  {relacion === "ALL" ? "Todos" : relacion}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title="Listado">
        <Table columns={columns} data={filteredRows} emptyText={loading ? "Cargando..." : error || "Sin registros."} />
      </Card>
    </DashboardLayout>
  );
}
