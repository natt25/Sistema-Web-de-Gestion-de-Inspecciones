import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";

export default function InspeccionDinamicaForm({ plantilla, definicion, onSubmit }) {
  const sections = useMemo(() => {
    if (Array.isArray(definicion?.secciones) && definicion.secciones.length) {
      return definicion.secciones
        .map((sec, idx) => {
          const key = String(sec?.key ?? sec?.key_seccion ?? `SECCION_${idx + 1}`).trim() || `SECCION_${idx + 1}`;
          const titulo = String(sec?.titulo ?? sec?.nombre ?? key).trim() || key;
          const secItems = Array.isArray(sec?.items) ? sec.items : [];
          return {
            key,
            titulo,
            items: secItems.map((it, itemIdx) => ({
              ...it,
              categoria: it?.categoria ?? titulo,
              id: it?.id ?? it?.item_ref ?? it?.ref ?? `${idx + 1}.${itemIdx + 1}`,
            })),
          };
        })
        .filter((sec) => sec.items.length > 0);
    }

    const baseItems = Array.isArray(definicion?.items) ? definicion.items : [];
    const grouped = new Map();

    for (const it of baseItems) {
      const sec = String(it?.categoria || "GENERAL");
      if (!grouped.has(sec)) grouped.set(sec, []);
      grouped.get(sec).push(it);
    }

    return Array.from(grouped.entries()).map(([titulo, arr], idx) => ({
      key: `SECCION_${idx + 1}`,
      titulo,
      items: arr.map((it, itemIdx) => ({
        ...it,
        categoria: it?.categoria ?? titulo,
        id: it?.id ?? it?.item_ref ?? it?.ref ?? `${idx + 1}.${itemIdx + 1}`,
      })),
    }));
  }, [definicion]);

  const items = useMemo(() => sections.flatMap((sec) => sec.items), [sections]);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState({});
  const [actions, setActions] = useState({});
  const [errors, setErrors] = useState({});
  const [respOptions, setRespOptions] = useState({});

  const grouped = useMemo(
    () =>
      sections.map((sec) => ({
        ...sec,
        items: [...sec.items].sort((a, b) => {
          const na = parseInt(String(a.id).replace(/\D/g, ""), 10) || 0;
          const nb = parseInt(String(b.id).replace(/\D/g, ""), 10) || 0;
          return na - nb;
        }),
      })),
    [sections]
  );

  const total = items.length;
  const filled = Object.keys(answers).length;
  const getKey = (it) =>
    normItemRef(
      it.item_ref
      ?? it.ref
      ?? `${it.categoria || "GENERAL"}_${it.id_campo ?? "sin_campo"}_${it.id ?? "sin_id"}_${it.texto ?? ""}`,
    );

  const setAnswer = (it, value) => {
    const key = getKey(it);
    // Guard para evitar setState redundante con el mismo valor.
    setAnswers((p) => {
      if (p[key] === value) return p;
      return { ...p, [key]: value };
    });
    if (value !== "MALO") {
      setErrors((p) => {
        if (!p[key]) return p;
        const copy = { ...p };
        delete copy[key];
        return copy;
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    for (const it of items) {
      const key = getKey(it);
      const ans = answers[key];

      if (ans === "MALO") {
        const note = (notes[key] || "").trim();
        const act = actions[key] || {};

        if (note.length < 10) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            note: "Obligatorio si es MALO (min. 10 caracteres).",
          };
        }

        if (!act.que || act.que.trim().length < 5) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            que: "Indica Que (accion) (min. 5 caracteres).",
          };
        }

        const quienText = typeof act.quien === "string" ? act.quien : act?.quien?.nombre || "";
        if (!quienText || quienText.trim().length < 3) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            quien: "Indica Quien (responsable).",
          };
        }

        if (!act.cuando) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            cuando: "Indica Cuando (fecha).",
          };
        }
      }
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      console.warn("Validacion fallo:", newErrors);
    }
    return isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("[DinamicaForm] handleSubmit triggered");
    if (!validate()) return;

    const payload = {
      plantilla: {
        id: plantilla?.id_plantilla_inspec,
        codigo: plantilla?.codigo_formato,
        nombre: plantilla?.nombre_formato,
        version: plantilla?.version,
      },
      respuestas: items.map((it) => {
        const key = getKey(it);
        const ans = answers[key] || null;
        const idCampo = it?.id_campo == null || it?.id_campo === "" ? null : Number(it.id_campo);
        return {
          id_campo: idCampo,
          item_ref: it.item_ref ?? it.ref ?? it.id ?? null,
          categoria: it.categoria || null,
          descripcion: it.texto ?? it.descripcion ?? null,
          estado: ans,
          observacion: (notes[key] || "").trim(),
          accion: ans === "MALO" ? actions[key] || null : null,
        };
      }),
      resumen: { total, respondidas: filled },
      createdAt: new Date().toISOString(),
    };

    onSubmit?.(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Rellenar inspeccion</div>
          <div className="ins-sub" style={{ marginTop: 6 }}>
            Si marcas <b>MALO (X)</b>, debes escribir observacion y registrar un plan de accion.
          </div>
        </div>

        <div className="ins-progress">
          <Badge>{filled}/{total} respondidas</Badge>
          <Button type="submit">Guardar (prueba)</Button>
        </div>
      </div>

      {grouped.map((sec) => (
        <section key={sec.key} className="ins-section">
          <div className="ins-section-title">{formatTitle(sec.titulo)}</div>

          <div className="ins-grid">
            {sec.items.map((it) => {
              const key = getKey(it);
              const value = answers[key] || "";
              const desc = it.texto || it.descripcion || "";
              const err = errors[key] || {};
              const act = actions[key] || { que: "", quien: "", cuando: "" };

              return (
                <div key={key} className="card ins-item">
                  <div className="ins-item-top">
                    <div className="ins-item-title">
                      <span className="ins-item-ref">{String(it.item_ref ?? it.ref ?? it.id ?? "-")}</span>
                      {desc || "Sin descripcion"}
                    </div>
                    <div className="ins-item-badge">
                      {value === "BUENO" ? (
                        <span className="status-badge good">BUENO</span>
                      ) : value === "MALO" ? (
                        <span className="status-badge bad">MALO</span>
                      ) : value === "NA" ? (
                        <span className="status-badge na">N/A</span>
                      ) : (
                        <span className="status-badge pending">Sin responder</span>
                      )}
                    </div>
                  </div>

                  <div className="ins-options">
                    <Option name={`opt_${key}`} label="BUENO" checked={value === "BUENO"} onChange={() => setAnswer(it, "BUENO")} />
                    <Option name={`opt_${key}`} label="MALO" checked={value === "MALO"} onChange={() => setAnswer(it, "MALO")} />
                    <Option name={`opt_${key}`} label="N/A" checked={value === "NA"} onChange={() => setAnswer(it, "NA")} />
                  </div>

                  <div className="ins-note">
                    <label className="ins-note-label">
                      {value === "MALO" ? (
                        <span className="ins-required">
                          <span className="dot" />
                          Observacion (obligatoria)
                        </span>
                      ) : (
                        "Observacion (opcional)"
                      )}
                    </label>
                    <textarea
                      className={`ins-note-input ${err.note ? "is-error" : ""}`}
                      rows={2}
                      value={notes[key] || ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Detalla observaciones y medidas correctivas."
                    />
                    {err.note ? <div className="ins-error">{err.note}</div> : null}
                  </div>

                  {value === "MALO" ? (
                    <div className="ins-action">
                      <div className="ins-action-title">Plan de accion (obligatorio)</div>

                      <label className="ins-field">
                        <span>Que</span>
                        <textarea
                          className={`ins-note-input ${err.que ? "is-error" : ""}`}
                          rows={3}
                          value={act.que || ""}
                          onChange={(e) =>
                            setActions((p) => ({ ...p, [key]: { ...act, que: e.target.value } }))
                          }
                          placeholder="Describe la accion correctiva inmediata..."
                        />
                        {err.que ? <div className="ins-error">{err.que}</div> : null}
                      </label>

                      <label className="ins-field">
                        <span>Quien</span>
                        <Autocomplete
                          placeholder="DNI / Apellido / Nombre"
                          displayValue={act.quien || ""}
                          options={respOptions[key] || []}
                          getOptionLabel={(e) => {
                            const nom = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                            const dni = e.dni ? `(${e.dni})` : "";
                            const cargo = e.cargo ? `- ${e.cargo}` : "";
                            return `${nom} ${dni} ${cargo}`.trim();
                          }}
                          onFocus={async () => {
                            try {
                              const rows = await buscarEmpleados("");
                              setRespOptions((p) => ({ ...p, [key]: Array.isArray(rows) ? rows : [] }));
                            } catch {
                              setRespOptions((p) => ({ ...p, [key]: [] }));
                            }
                          }}
                          onInputChange={async (txt) => {
                            setActions((p) => ({
                              ...p,
                              [key]: {
                                ...act,
                                quien: txt,
                                responsable: txt?.trim()
                                  ? { tipo: "EXTERNO", nombre: txt.trim(), cargo: "EXTERNO" }
                                  : null,
                              },
                            }));

                            if (!txt.trim()) {
                              setRespOptions((p) => ({ ...p, [key]: [] }));
                              return;
                            }

                            try {
                              const rows = await buscarEmpleados(txt.trim());
                              setRespOptions((p) => ({ ...p, [key]: Array.isArray(rows) ? rows : [] }));
                            } catch {
                              setRespOptions((p) => ({ ...p, [key]: [] }));
                            }
                          }}
                          onSelect={(e) => {
                            const nombre = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                            const label = `${nombre}${e.dni ? ` (${e.dni})` : ""}`;
                            setActions((p) => ({
                              ...p,
                              [key]: {
                                ...act,
                                quien: label,
                                responsable: {
                                  tipo: "INTERNO",
                                  dni: e.dni || "",
                                  nombre: nombre || e.dni || "",
                                  cargo: e.cargo || "",
                                },
                              },
                            }));
                            setRespOptions((p) => ({ ...p, [key]: [] }));
                          }}
                          allowCustom
                          onCreateCustom={(text) => {
                            setActions((p) => ({
                              ...p,
                              [key]: {
                                ...act,
                                quien: text,
                                responsable: { tipo: "EXTERNO", nombre: text, cargo: "EXTERNO" },
                              },
                            }));
                            setRespOptions((p) => ({ ...p, [key]: [] }));
                          }}
                        />
                        {err.quien ? <div className="ins-error">{err.quien}</div> : null}
                      </label>

                      <label className="ins-field">
                        <span>Cuando</span>
                        <input
                          type="date"
                          className={`ins-input ${err.cuando ? "is-error" : ""}`}
                          value={act.cuando || ""}
                          onChange={(e) =>
                            setActions((p) => ({ ...p, [key]: { ...act, cuando: e.target.value } }))
                          }
                        />
                        {err.cuando ? <div className="ins-error">{err.cuando}</div> : null}
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </form>
  );
}

function Option({ name, label, checked, onChange }) {
  const cls = label === "BUENO" ? "good" : label === "MALO" ? "bad" : "na";

  return (
    <label className={`ins-opt ${cls} ${checked ? "is-checked" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function formatTitle(s) {
  return String(s).replace(/_/g, " ").toUpperCase();
}

function normItemRef(v) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
