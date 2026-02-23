import { useEffect, useMemo, useRef, useState } from "react";

export default function Autocomplete({
  label,
  placeholder,
  value,              // objeto seleccionado (o null)
  displayValue,       // string que se muestra en el input
  onInputChange,      // (text) => void
  onSelect,           // (item) => void
  options,            // lista [{...}]
  getOptionLabel,     // (item) => string
  loading,
  allowCustom = false,
  onCreateCustom,     // (text) => void (si allowCustom)
  hint,
  required,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hasOptions = (options?.length || 0) > 0;

  return (
    <div ref={wrapRef} className="ins-field" style={{ position: "relative" }}>
      <span style={{ fontWeight: required ? 900 : 800 }}>
        {label} {required ? " *" : ""}
      </span>

      <input
        className="ins-input"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          onInputChange?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />

      {hint ? <div className="help">{hint}</div> : null}

      {open ? (
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
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
            <b style={{ fontSize: 12, color: "var(--muted)" }}>
              {loading ? "Buscando..." : hasOptions ? "Resultados" : "Sin resultados"}
            </b>

            {allowCustom && !loading ? (
              <button
                type="button"
                className="menu-btn"
                style={{ height: 34, marginLeft: "auto" }}
                onClick={() => {
                  if (!displayValue?.trim()) return;
                  onCreateCustom?.(displayValue.trim());
                  setOpen(false);
                }}
              >
                + Crear “{displayValue?.trim() || ""}”
              </button>
            ) : null}
          </div>

          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {options?.map((it, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelect?.(it);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
                onMouseDown={(e) => e.preventDefault()} // evita blur antes del click
              >
                <div style={{ fontWeight: 800 }}>{getOptionLabel(it)}</div>
              </button>
            ))}

            {!hasOptions && !loading ? (
              <div style={{ padding: 12, color: "var(--muted)" }}>
                No hay coincidencias.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}