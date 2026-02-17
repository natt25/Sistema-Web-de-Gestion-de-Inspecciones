import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";
import { crearObservacion } from "../api/observaciones.api";
import { crearAccion } from "../api/acciones.api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

function fileUrl(archivo_ruta) {
  if (!archivo_ruta || archivo_ruta.startsWith("PENDING_UPLOAD/")) return null;
  return `${API_BASE}/${archivo_ruta}`;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function Badge({ children }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: "#f7f7f7",
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

function getErrorMessage(err) {
  const status = err?.response?.status;
  const msg = err?.response?.data?.message;

  if (status === 401) return "Sesión expirada (401). Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permisos (403).";
  if (status === 404) return "Endpoint no encontrado (404).";
  if (status === 409) return msg || "Conflicto (409).";
  if (status === 500) return "Error interno del servidor (500).";
  return msg || "Error inesperado. Revisa consola/backend.";
}

function EvidenceGrid({ evidencias }) {
  if (!evidencias || evidencias.length === 0) {
    return <p style={{ margin: "6px 0", opacity: 0.7 }}>Sin evidencias.</p>;
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
      {evidencias.map((e) => {
        const key = e.id_obs_evidencia ?? e.id_acc_evidencia ?? e.id ?? e.archivo_ruta;
        const url = fileUrl(e.archivo_ruta);

        if (!url) {
          return (
            <div
              key={key}
              style={{
                width: 200,
                border: "1px dashed #bbb",
                borderRadius: 12,
                padding: 10,
                background: "#fffdf5",
              }}
            >
              <b style={{ fontSize: 12 }}>PENDIENTE</b>
              <div style={{ fontSize: 12, wordBreak: "break-all" }}>{e.archivo_ruta}</div>
            </div>
          );
        }

        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              width: 200,
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #ddd",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <img
              src={url}
              alt={e.archivo_nombre || "evidencia"}
              style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
              onError={(ev) => (ev.currentTarget.style.display = "none")}
            />
            <div style={{ padding: 10, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, wordBreak: "break-all" }}>
                {e.archivo_nombre || e.archivo_ruta}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{e.mime_type || "-"}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Capturada: {fmtDate(e.capturada_en)}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/** ✅ FORM: Crear Acción (se muestra debajo de cada observación) */
function CrearAccionForm({ idObservacion, onCreated }) {
  const [form, setForm] = useState({
    desc_accion: "",
    fecha_compromiso: "",
    id_estado_accion: "1",
    responsable_interno_dni: "",
    responsable_externo_nombre: "",
    responsable_externo_cargo: "",
  });


  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!form.desc_accion.trim()) return setError("Falta desc_accion.");
    if (!form.fecha_compromiso) return setError("Falta fecha_compromiso.");

    const dni = form.responsable_interno_dni.trim();
    const externoNombre = form.responsable_externo_nombre.trim();
    const externoCargo = form.responsable_externo_cargo.trim();

    if (dni && (externoNombre || externoCargo)) {
      return setError("Usa responsable interno por DNI o responsable externo (nombre y cargo), no ambos.");
    }

    if (!dni && (!externoNombre || !externoCargo)) {
      return setError("Si no indicas DNI, debes completar responsable_externo_nombre y responsable_externo_cargo.");
    }

    setSaving(true);
    try {
      const payload = {
        desc_accion: form.desc_accion.trim(),
        fecha_compromiso: form.fecha_compromiso,
        id_estado_accion: Number(form.id_estado_accion),
      };

      if (dni) {
        payload.responsable_interno_dni = dni;
      } else {
        payload.responsable_externo_nombre = externoNombre;
        payload.responsable_externo_cargo = externoCargo;
      }

      await crearAccion(idObservacion, payload);


      setOk("Acción creada ✅");
      setForm((p) => ({
        ...p,
        desc_accion: "",
        responsable_interno_dni: "",
        responsable_externo_nombre: "",
        responsable_externo_cargo: "",
      }));

      // recargar todo el detalle
      await onCreated?.();

      setTimeout(() => setOk(""), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #eee",
        borderRadius: 12,
        display: "grid",
        gap: 8,
        maxWidth: 520,
        background: "#fafafa",
      }}
    >
      <b>Crear acción (Obs #{idObservacion})</b>

      <label style={{ display: "grid", gap: 6 }}>
        Descripción (desc_accion)
        <textarea name="desc_accion" value={form.desc_accion} onChange={onChange} rows={2} />
      </label>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          Fecha compromiso
          <input type="date" name="fecha_compromiso" value={form.fecha_compromiso} onChange={onChange} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Estado (id_estado_accion)
          <select name="id_estado_accion" value={form.id_estado_accion} onChange={onChange}>
            <option value="1">1 - ABIERTA</option>
            <option value="2">2 - EN PROCESO</option>
            <option value="3">3 - CUMPLIDA</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          DNI responsable interno
          <input
            name="responsable_interno_dni"
            value={form.responsable_interno_dni}
            onChange={onChange}
            placeholder="Ej: 12345678"
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          Responsable externo nombre
          <input
            name="responsable_externo_nombre"
            value={form.responsable_externo_nombre}
            onChange={onChange}
            placeholder="Si no hay DNI interno"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Responsable externo cargo
          <input
            name="responsable_externo_cargo"
            value={form.responsable_externo_cargo}
            onChange={onChange}
            placeholder="Si no hay DNI interno"
          />
        </label>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {error}
        </div>
      )}

      {ok && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #b3ffb3", background: "#ecffec" }}>
          {ok}
        </div>
      )}

      <button disabled={saving} type="submit">
        {saving ? "Guardando..." : "Crear acción"}
      </button>
    </form>
  );
}

export default function InspeccionDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [data, setData] = useState(null);

  // Form crear observación
  const [form, setForm] = useState({
    item_ref: "",
    desc_observacion: "",
    id_nivel_riesgo: "1",
    id_estado_observacion: "1",
  });

  const [savingObs, setSavingObs] = useState(false);
  const [obsError, setObsError] = useState("");
  const [obsOk, setObsOk] = useState("");

  async function load() {
    setLoading(true);
    setPageError("");
    try {
      const res = await getInspeccionFull(id);
      setData(res);
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cab = data?.cabecera;
  const observaciones = data?.observaciones || [];

  function onChangeForm(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function onCrearObservacion(e) {
    e.preventDefault();
    setObsError("");
    setObsOk("");

    if (!form.item_ref.trim()) return setObsError("Falta item_ref.");
    if (!form.desc_observacion.trim()) return setObsError("Falta descripción.");
    if (!form.id_nivel_riesgo) return setObsError("Falta nivel de riesgo.");

    setSavingObs(true);
    try {
      await crearObservacion(id, {
        item_ref: form.item_ref.trim(),
        desc_observacion: form.desc_observacion.trim(),
        id_nivel_riesgo: Number(form.id_nivel_riesgo),
        id_estado_observacion: Number(form.id_estado_observacion),
      });

      setObsOk("Observación creada ✅");
      setForm({ item_ref: "", desc_observacion: "", id_nivel_riesgo: "1", id_estado_observacion: "1" });

      await load();
    } catch (err) {
      setObsError(getErrorMessage(err));
    } finally {
      setSavingObs(false);
      setTimeout(() => setObsOk(""), 2500);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link to="/inspecciones">← Volver</Link>
        <button onClick={load} disabled={loading}>
          {loading ? "Recargando..." : "Recargar"}
        </button>
      </div>

      <h2 style={{ margin: 0 }}>Inspección #{id}</h2>

      {pageError && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {pageError}
        </div>
      )}

      {/* CABECERA */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cabecera</h3>

        {!cab ? (
          <p style={{ opacity: 0.7 }}>Sin cabecera.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge>Estado: {cab.estado_inspeccion}</Badge>
              <Badge>Modo: {cab.modo_registro}</Badge>
              <Badge>Área: {cab.desc_area}</Badge>
              <Badge>
                Formato: {cab.codigo_formato} v{cab.version_actual}
              </Badge>
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <div>
                <b>Fecha inspección:</b> {fmtDate(cab.fecha_inspeccion)}
              </div>
              <div>
                <b>Servicio:</b> {cab.nombre_servicio}{" "}
                {cab.servicio_detalle ? `- ${cab.servicio_detalle}` : ""}
              </div>
              <div>
                <b>Cliente:</b> {cab.id_cliente} {cab.raz_social ? `- ${cab.raz_social}` : ""}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* CREAR OBSERVACIÓN */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Crear observación</h3>

        <form onSubmit={onCrearObservacion} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6 }}>
            item_ref
            <input name="item_ref" value={form.item_ref} onChange={onChangeForm} placeholder="Ej: 1.1" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Nivel de riesgo (id_nivel_riesgo)
            <select name="id_nivel_riesgo" value={form.id_nivel_riesgo} onChange={onChangeForm}>
              <option value="1">1 - BAJO</option>
              <option value="2">2 - MEDIO</option>
              <option value="3">3 - ALTO</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Estado observación (id_estado_observacion)
            <select name="id_estado_observacion" value={form.id_estado_observacion} onChange={onChangeForm}>
              <option value="1">1 - ABIERTA</option>
              <option value="2">2 - EN PROCESO</option>
              <option value="3">3 - CERRADA</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Descripción
            <textarea
              name="desc_observacion"
              value={form.desc_observacion}
              onChange={onChangeForm}
              rows={3}
              placeholder="Describe la observación..."
            />
          </label>

          {obsError && (
            <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
              {obsError}
            </div>
          )}

          {obsOk && (
            <div style={{ padding: 10, borderRadius: 10, border: "1px solid #b3ffb3", background: "#ecffec" }}>
              {obsOk}
            </div>
          )}

          <button disabled={savingObs} type="submit">
            {savingObs ? "Guardando..." : "Crear observación"}
          </button>
        </form>
      </section>

      {/* OBSERVACIONES */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Observaciones ({observaciones.length})</h3>

        {loading && <p>Cargando...</p>}

        {!loading && observaciones.length === 0 && <p style={{ opacity: 0.7 }}>Sin observaciones.</p>}

        {!loading &&
          observaciones.map((o) => (
            <div key={o.id_observacion} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <b>Obs #{o.id_observacion}</b>
                <Badge>Riesgo: {o.nivel_riesgo}</Badge>
                <Badge>Estado: {o.estado_observacion}</Badge>
                <Badge>Ítem: {o.item_ref}</Badge>
              </div>

              <div style={{ marginTop: 6 }}>
                <b>Descripción:</b> {o.desc_observacion}
              </div>

              <div style={{ marginTop: 10 }}>
                <b>Evidencias (Obs)</b>
                <EvidenceGrid evidencias={o.evidencias} />
              </div>

              {/* ✅ FORM CREAR ACCIÓN para esta observación */}
              <CrearAccionForm idObservacion={o.id_observacion} onCreated={load} />

              <div style={{ marginTop: 12 }}>
                <b>Acciones ({o.acciones?.length || 0})</b>

                {!o.acciones || o.acciones.length === 0 ? (
                  <p style={{ margin: "6px 0", opacity: 0.7 }}>Sin acciones.</p>
                ) : (
                  o.acciones.map((a) => (
                    <div
                      key={a.id_accion}
                      style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #eee" }}
                    >
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <b>Acc #{a.id_accion}</b>
                        <Badge>Estado: {a.estado_accion}</Badge>
                        <Badge>Compromiso: {fmtDate(a.fecha_compromiso)}</Badge>
                        <Badge>Resp: {a.dni || a.responsable_interno_dni || "-"}</Badge>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <b>Descripción:</b> {a.desc_accion}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <b>Evidencias (Acc)</b>
                        <EvidenceGrid evidencias={a.evidencias} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}
