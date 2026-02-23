import { useEffect, useRef, useState } from "react";

export default function Autocomplete({
  label,
  placeholder,
  displayValue,
  onInputChange,
  onSelect,
  options,
  getOptionLabel,
  loading = false,
  allowCustom = false,
  onCreateCustom,
  hint,
  required,
  disabled = false,
  onFocus,
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

  const list = Array.isArray(options) ? options : [];
  const hasOptions = list.length > 0;
  const cleanText = String(displayValue || "").trim();

  return (
    <div ref={wrapRef} className="ins-field" style={{ position: "relative" }}>
      {label ? (
        <span style={{ fontWeight: required ? 900 : 800 }}>
          {label} {required ? " *" : ""}
        </span>
      ) : null}

      <input
        className="ins-input"
        placeholder={placeholder}
        value={displayValue ?? ""}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onInputChange?.(e.target.value);
          if (!disabled) setOpen(true);
        }}
        onFocus={(e) => {
          if (disabled) return;
          setOpen(true);
          onFocus?.(e);
        }}
      />

      {hint ? <div className="help">{hint}</div> : null}

      {open && !disabled ? (
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
          <div
            style={{
              padding: 10,
              borderBottom: "1px solid var(--border)",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <b style={{ fontSize: 12, color: "var(--muted)" }}>
              {loading ? "Buscando..." : hasOptions ? "Resultados" : "Sin resultados"}
            </b>
          </div>

          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {list.map((it, idx) => (
              <button
                key={`${it?.id_cliente ?? it?.id_servicio ?? it?.id_area ?? it?.id_lugar ?? it?.dni ?? idx}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
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
              >
                <div style={{ fontWeight: 800 }}>{getOptionLabel(it)}</div>
              </button>
            ))}

            {allowCustom && !loading && cleanText ? (
              <button
                type="button"
                className="ins-dd-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCreateCustom?.(cleanText);
                  setOpen(false);
                }}
              >
                + Crear "{cleanText}"
              </button>
            ) : null}

            {!hasOptions && !loading ? (
              <div style={{ padding: 12, color: "var(--muted)" }}>No hay coincidencias.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
