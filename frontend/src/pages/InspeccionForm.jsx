import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { getDefinicionPlantilla } from "../api/plantillas.api";
import { getUser } from "../auth/auth.storage";
import { crearInspeccion } from "../api/inspecciones.api";

const ESTADOS = [
  { v: "BUENO", label: "Bueno" },
  { v: "MALO", label: "Malo" },
  { v: "NO_APLICA", label: "N/A" },
];

export default function InspeccionForm() {
  const { idPlantilla } = useParams();
  const [def, setDef] = useState(null);
  const [resp, setResp] = useState({});
  const [planes, setPlanes] = useState(Array.from({ length: 6 }, () => ({ que: "", quien: "", cuando: "" })));
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);

  useEffect(() => {
    (async () => {
      const r = await getDefinicionPlantilla(Number(idPlantilla));
      setDef(r.definicion);

      // header auto (realizado_por, cargo, firma, fecha)
      setResp((prev) => ({
        ...prev,
        header: {
          fecha_inspeccion: new Date().toISOString().slice(0, 10),
          realizado_por: user?.dni ?? "",
          cargo: user?.cargo ?? "",
          firma_path: user?.firma_path ?? "",
          cliente: "",
          servicio: "",
          area: "",
          lugar: "",
        },
        items: {},
      }));
    })();
  }, [idPlantilla, user]);

  function setItem(id, patch) {
    setResp((prev) => ({
      ...prev,
      items: {
        ...(prev.items || {}),
        [id]: { ...(prev.items?.[id] || {}), ...patch },
      },
    }));
  }

  async function guardar() {
    try {
      const payload = {
        header: resp?.header || {},
        plantilla: {
          id_plantilla_inspec: Number(idPlantilla),
        },
        // ✅ convertir items del form a array de respuestas
        respuestas: Object.entries(resp?.items || {}).map(([idItem, v]) => ({
          // BACKEND te está pidiendo id_campo, así que lo mandamos desde def.items
          id_item: idItem,
          id_campo: Number(def?.items?.find((x) => String(x.id) === String(idItem))?.id_campo || 0),
          item_ref: def?.items?.find((x) => String(x.id) === String(idItem))?.item_ref ?? idItem,
          estado: v?.estado ?? null,
          observacion: (v?.obs ?? "").trim(),
        })),
        planes_accion: planes,
        createdAt: new Date().toISOString(),
      };

      // ✅ validación mínima para evitar 400 "Falta id_campo"
      const faltanCampos = (payload.respuestas || []).some((r) => !r.id_campo || Number.isNaN(Number(r.id_campo)));
      if (faltanCampos) {
        console.error("[guardar] payload con id_campo faltante:", payload);
        alert("ERROR: Hay items sin id_campo. Revisa la definición de plantilla (id_campo no está mapeado).");
        return;
      }

      console.log("[guardar] POST /api/inspecciones payload:", payload);

      await crearInspeccion(payload);

      alert("Inspección guardada ✅");
      navigate("/inspecciones");
    } catch (err) {
      console.error("[guardar] error:", err);
      const msg = err?.response?.data?.message || err?.message || "Error al guardar";
      alert(msg);
    }
  }

  return (
    <DashboardLayout title={def ? def.nombre_formato : "Cargando..."}>
      {!def ? (
        <div>Cargando...</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <Card title="Datos generales">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Fecha inspección</div>
                <Input
                  value={resp?.header?.fecha_inspeccion || ""}
                  onChange={(e) =>
                    setResp((p) => ({ ...p, header: { ...(p.header || {}), fecha_inspeccion: e.target.value } }))
                  }
                  placeholder="YYYY-MM-DD"
                />
              </div>

              {/* Estos 3 son display-only */}
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Realizado por (DNI)</div>
                <Input value={resp?.header?.realizado_por ?? ""} disabled />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Cargo</div>
                <Input value={resp?.header?.realizado_por ?? ""} disabled />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div className="label">Firma (ruta)</div>
                <Input value={resp?.header?.cargo ?? ""} disabled />
              </div>

              {/* Estos sí se llenan */}
              {["cliente", "servicio", "area", "lugar"].map((k) => (
                <div key={k} style={{ display: "grid", gap: 6 }}>
                  <div className="label">{k.toUpperCase()}</div>
                  <Input
                    value={resp?.header?.[k] || ""}
                    onChange={(e) => setResp((p) => ({ ...p, header: { ...(p.header || {}), [k]: e.target.value } }))}
                    placeholder={`Ingrese ${k}`}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Checklist">
            <div style={{ display: "grid", gap: 12 }}>
              {def.items.map((it) => {
                const val = resp?.items?.[it.id] || {};
                return (
                  <div
                    key={it.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      padding: 14,
                      display: "grid",
                      gap: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 900 }}>
                      {it.categoria.replaceAll("_", " ")}
                    </div>
                    <div style={{ fontWeight: 800 }}>{it.texto}</div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {ESTADOS.map((op) => (
                        <label key={op.v} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="radio"
                            name={it.id}
                            checked={val.estado === op.v}
                            onChange={() => setItem(it.id, { estado: op.v })}
                          />
                          <span>{op.label}</span>
                        </label>
                      ))}
                    </div>

                    <Input
                      placeholder="Observaciones (si es MALO, detalla lugar y corrección inmediata)"
                      value={val.obs || ""}
                      onChange={(e) => setItem(it.id, { obs: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Planes de acción">
            <div style={{ display: "grid", gap: 10 }}>
              {planes.map((r, idx) => (
                <div key={idx} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 140px" }}>
                  <Input
                    placeholder="¿Qué?"
                    value={r.que}
                    onChange={(e) => setPlanes((p) => p.map((x, i) => (i === idx ? { ...x, que: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="¿Quién?"
                    value={r.quien}
                    onChange={(e) =>
                      setPlanes((p) => p.map((x, i) => (i === idx ? { ...x, quien: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="¿Cuándo?"
                    value={r.cuando}
                    onChange={(e) =>
                      setPlanes((p) => p.map((x, i) => (i === idx ? { ...x, cuando: e.target.value } : x)))
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={guardar}>Guardar</Button>
            <Button variant="outline" onClick={() => navigate("/inspecciones")}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}