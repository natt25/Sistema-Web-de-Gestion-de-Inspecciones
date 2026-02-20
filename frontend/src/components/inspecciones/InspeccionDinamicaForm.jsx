import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";

/**
 * JSON esperado (según tu caso):
 * definicion.items = [{ id, categoria, texto }, ...]
 * - categoria: "ORDEN_Y_LIMPIEZA"
 * - texto: la descripción del PDF
 */
export default function InspeccionDinamicaForm({ plantilla, definicion, onSubmit }) {
  const items = definicion?.items || [];
  const [answers, setAnswers] = useState({}); // { [key]: "BUENO"|"MALO"|"NA" }
  const [notes, setNotes] = useState({});     // { [key]: string }
  const [actions, setActions] = useState({}); // { [key]: { que, quien, cuando } }
  const [errors, setErrors] = useState({});   // { [key]: { note?, que?, quien?, cuando? } }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const sec = String(it.categoria || "GENERAL");
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec).push(it);
    }
    // ordenar por id (o item_ref si luego lo agregas)
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => Number(a.id) - Number(b.id));
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const total = items.length;
  const filled = Object.keys(answers).length;

  const getKey = (it) => it.id ?? `${it.categoria}_${it.texto}`;

  const setAnswer = (it, value) => {
    const key = getKey(it);
    setAnswers((p) => ({ ...p, [key]: value }));

    // Si cambia a BUENO/NA, limpia requisitos de MALO
    if (value !== "MALO") {
      setErrors((p) => {
        const copy = { ...p };
        delete copy[key];
        return copy;
      });
      // opcional: no borro note/actions por si vuelve a MALO, pero puedes borrarlo si quieres
      // setNotes((p) => { const c={...p}; delete c[key]; return c; });
      // setActions((p) => { const c={...p}; delete c[key]; return c; });
    }
  };

  const validate = () => {
    const newErrors = {};

    for (const it of items) {
      const key = getKey(it);
      const ans = answers[key];

      // Si el usuario aún no responde, no lo obligo aquí (depende de tu negocio).
      // Si quieres obligar TODO, descomenta:
      // if (!ans) newErrors[key] = { ...(newErrors[key] || {}), ans: "Selecciona BUENO/MALO/N/A" };

      if (ans === "MALO") {
        const note = (notes[key] || "").trim();
        const act = actions[key] || {};

        // PDF: Observación obligatoria cuando es MALO
        if (note.length < 10) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            note: "Obligatorio si es MALO (mín. 10 caracteres).",
          };
        }

        // Flujo: Acción obligatoria cuando es MALO
        if (!act.que || act.que.trim().length < 5) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            que: "Indica ¿Qué? (acción) (mín. 5 caracteres).",
          };
        }
        if (!act.quien || act.quien.trim().length < 3) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            quien: "Indica ¿Quién? (responsable).",
          };
        }
        if (!act.cuando) {
          newErrors[key] = {
            ...(newErrors[key] || {}),
            cuando: "Indica ¿Cuándo? (fecha).",
          };
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
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
        return {
          id_item: it.id,
          categoria: it.categoria || null,
          descripcion: it.texto || null, // <- ESTO ES lo del PDF
          estado: ans,                   // BUENO/MALO/NA
          observacion: (notes[key] || "").trim(),
          accion: ans === "MALO" ? (actions[key] || null) : null,
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
          <div className="ins-title">Rellenar inspección</div>
          <div className="ins-sub" style={{ marginTop: 6 }}>
            Si marcas <b>MALO (X)</b>, debes escribir observación y registrar un plan de acción.
          </div>
        </div>

        <div className="ins-progress">
          <Badge>{filled}/{total} respondidas</Badge>
          <Button type="submit">Guardar (prueba)</Button>
        </div>
      </div>

      {grouped.map(([seccion, arr]) => (
        <section key={seccion} className="ins-section">
          <div className="ins-section-title">{formatTitle(seccion)}</div>

          <div className="ins-grid">
            {arr.map((it) => {
              const key = getKey(it);
              const value = answers[key] || "";
              const desc = it.texto || ""; // <- texto del PDF
              const err = errors[key] || {};
              const act = actions[key] || { que: "", quien: "", cuando: "" };
              const [respQuery, setRespQuery] = useState({});
              const [respOptions, setRespOptions] = useState({});
              
              return (
                <div key={key} className="card ins-item">
                  <div className="ins-item-top">
                    <div className="ins-item-title">
                      <span className="ins-item-ref">{String(it.id).padStart(2, "0")}</span>
                      {desc || "Sin descripción"}
                    </div>
                    <div className="ins-item-badge">
                      {value === "BUENO" ? (
                        <span className="status-badge good">✔ BUENO</span>
                        ) : value === "MALO" ? (
                        <span className="status-badge bad">✖ MALO</span>
                        ) : value === "NA" ? (
                        <span className="status-badge na">➖ N/A</span>
                        ) : (
                        <span className="status-badge pending">⚠ Sin responder</span>
                        )}
                    </div>
                  </div>

                  <div className="ins-options">
                    <Option name={`opt_${key}`} label="BUENO" checked={value === "BUENO"} onChange={() => setAnswer(it, "BUENO")} />
                    <Option name={`opt_${key}`} label="MALO" checked={value === "MALO"} onChange={() => setAnswer(it, "MALO")} />
                    <Option name={`opt_${key}`} label="N/A" checked={value === "NA"} onChange={() => setAnswer(it, "NA")} />
                  </div>

                  {/* Observación: obligatoria si MALO */}
                  <div className="ins-note">
                    <label className="ins-note-label">
                        {value === "MALO" ? (
                            <span className="ins-required">
                            <span className="dot" />
                            Observación (obligatoria)
                            </span>
                        ) : (
                            "Observación (opcional)"
                        )}
                    </label>
                    <textarea
                      className={`ins-note-input ${err.note ? "is-error" : ""}`}
                      rows={2}
                      value={notes[key] || ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Detalla observaciones, lugar específico y medidas inmediatas..."
                    />
                    {err.note ? <div className="ins-error">{err.note}</div> : null}
                  </div>

                  {/* Acción: obligatoria si MALO */}
                  {value === "MALO" ? (
                    <div className="ins-action">
                      <div className="ins-action-title">Plan de acción (obligatorio)</div>

                      <label className="ins-field">
                        <span>¿Qué?</span>
                        <textarea
                            className={`ins-note-input ${err.que ? "is-error" : ""}`}
                            rows={3}
                            value={act.que || ""}
                            onChange={(e) =>
                                setActions((p) => ({ ...p, [key]: { ...act, que: e.target.value } }))
                            }
                            placeholder="Describe la acción correctiva inmediata..."
                        />
                        {err.que ? <div className="ins-error">{err.que}</div> : null}
                      </label>

                      <label className="ins-field">
                        <span>¿Quién?</span>
                        <input
                            className={`ins-input ${err.quien ? "is-error" : ""}`}
                            value={act.quien || ""}
                            onChange={async (e) => {
                                const v = e.target.value;
                                setActions((p) => ({ ...p, [key]: { ...act, quien: v } }));
                                setRespQuery((p) => ({ ...p, [key]: v }));

                                if (v.trim().length >= 2) {
                                const opts = await buscarResponsables(v.trim());
                                setRespOptions((p) => ({ ...p, [key]: opts }));
                                } else {
                                setRespOptions((p) => ({ ...p, [key]: [] }));
                                }
                            }}
                            placeholder="DNI o Apellido/Nombres"
                            />

                            {(respOptions[key] || []).length ? (
                            <div className="ins-dropdown">
                                {(respOptions[key] || []).map((u) => (
                                <button
                                    type="button"
                                    key={u.id_usuario}
                                    className="ins-dd-item"
                                    onClick={() => {
                                    const label = `${u.dni} - ${u.apellidos} ${u.nombres}`;
                                    setActions((p) => ({ ...p, [key]: { ...act, quien: label, id_usuario_responsable: u.id_usuario } }));
                                    setRespOptions((p) => ({ ...p, [key]: [] }));
                                    }}
                                >
                                    <b>{u.dni}</b> — {u.apellidos} {u.nombres}
                                </button>
                                ))}
                            </div>
                            ) : null}
                        {err.quien ? <div className="ins-error">{err.quien}</div> : null}
                      </label>

                      <label className="ins-field">
                        <span>¿Cuándo?</span>
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
  const cls =
    label === "BUENO" ? "good" :
    label === "MALO" ? "bad" : "na";

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