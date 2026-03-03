import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import Badge from "../ui/Badge.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaEppsCalienteRows } from "../../utils/plantillaRenderer.js";

const DEFAULT_COLS = [
  { key: "casaca_cuero", label: "Casaca de cuero" },
  { key: "mandil_cuero", label: "Mandil de cuero" },
  { key: "pantalon_cuero", label: "Pantalon de cuero" },
  { key: "guantes_cuero", label: "Guantes de cuero" },
  { key: "careta_soldador", label: "Careta de soldador" },
  { key: "careta_facial", label: "Careta facial" },
  { key: "escarpines", label: "Escarpines" },
  { key: "orejeras_tapones", label: "Orejeras y/o tapones" },
  { key: "respirador_media_cara", label: "Respirador media cara + filtros" },
];

const ESTADOS = ["", "BUENO", "MALO", "NA"];

function buildEmptyEpps(cols) {
  return cols.reduce((acc, c) => {
    acc[c.key] = "";
    return acc;
  }, {});
}

function createEmptyRow(cols) {
  return {
    trabajador: "",
    dni: "",
    epps: buildEmptyEpps(cols),
    observacion: "",
    accion: { que: "", quien: null, cuando: "" },
  };
}

function isRowMalo(row) {
  return Object.values(row?.epps || {}).some((v) => String(v || "").toUpperCase() === "MALO");
}

function rowHasAnyData(row) {
  if (!row) return false;
  if (String(row?.trabajador || "").trim()) return true;
  if (String(row?.dni || "").trim()) return true;
  if (Object.values(row?.epps || {}).some((v) => String(v || "").trim())) return true;
  if (String(row?.observacion || "").trim()) return true;
  if (String(row?.accion?.que || "").trim()) return true;
  if (String(row?.accion?.quien?.dni || row?.accion?.quien || "").trim()) return true;
  if (String(row?.accion?.cuando || "").trim()) return true;
  return false;
}

function empleadoLabel(opt) {
  if (!opt) return "";
  if (typeof opt === "string") return opt;
  return `${opt?.dni ?? ""} - ${opt?.apellido ?? ""} ${opt?.nombre ?? ""}`.trim();
}

export default function TablaEppsCalienteForm({
  definicion,
  value,
  onChange,
  onSubmit,
}) {
  const cols = useMemo(() => {
    const fromJson = definicion?.columns || definicion?.json?.columns || definicion?.json_definicion?.columns;
    return Array.isArray(fromJson) && fromJson.length ? fromJson : DEFAULT_COLS;
  }, [definicion]);

  const rows = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [searchCtx, setSearchCtx] = useState({ rowIdx: null, field: null, text: "" });
  const [empOptions, setEmpOptions] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);

  useEffect(() => {
    console.log("[FOR-037] render OK");
  }, []);

  useEffect(() => {
    if (rows.length > 0) return;
    onChange?.([createEmptyRow(cols)]);
  }, [rows.length, cols, onChange]);

  const setRows = useCallback((updater) => {
    const next = typeof updater === "function" ? updater(rows) : updater;
    onChange?.(next);
  }, [rows, onChange]);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow(cols)]);
  }, [setRows, cols]);

  const removeRow = useCallback((idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, [setRows]);

  const updateRow = useCallback((idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, [setRows]);

  const updateEppEstado = useCallback((idx, key, estado) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, epps: { ...(r?.epps || {}), [key]: estado } };
        if (!isRowMalo(next)) {
          next.observacion = "";
          next.accion = { que: "", quien: null, cuando: "" };
        }
        return next;
      })
    );
  }, [setRows]);

  useEffect(() => {
    const q = String(searchCtx?.text || "").trim();
    if (searchCtx?.rowIdx == null || !q) {
      setEmpOptions([]);
      setEmpLoading(false);
      return;
    }
    let alive = true;
    setEmpLoading(true);
    const t = setTimeout(async () => {
      try {
        const list = await buscarEmpleados(q);
        if (!alive) return;
        setEmpOptions(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!alive) return;
        console.error("[FOR-037] buscarEmpleados error", e);
        setEmpOptions([]);
      } finally {
        if (alive) setEmpLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [searchCtx]);

  const validateRows = useCallback(() => {
    const nextErrors = {};
    rows.forEach((row, idx) => {
      if (!rowHasAnyData(row)) return;
      if (!isRowMalo(row)) return;
      if (!String(row?.observacion || "").trim()) nextErrors[`obs:${idx}`] = "Observacion obligatoria cuando existe MALO.";
      if (!String(row?.accion?.que || "").trim()) nextErrors[`que:${idx}`] = "Accion (que) obligatoria cuando existe MALO.";
      const quienText = typeof row?.accion?.quien === "string"
        ? row.accion.quien
        : `${row?.accion?.quien?.dni || ""} ${row?.accion?.quien?.apellido || ""} ${row?.accion?.quien?.nombre || ""}`.trim();
      if (!String(quienText || "").trim()) nextErrors[`quien:${idx}`] = "Accion (quien) obligatoria cuando existe MALO.";
      if (!String(row?.accion?.cuando || "").trim()) nextErrors[`cuando:${idx}`] = "Accion (cuando) obligatoria cuando existe MALO.";
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [rows]);

  const handleSubmit = async () => {
    if (!validateRows()) return;
    const serialized = serializeTablaEppsCalienteRows(rows);
    console.log(`[FOR-037] serialize rows = ${serialized.length}`);
    try {
      setSaving(true);
      await onSubmit?.({
        tipo: "tabla_epps_caliente",
        respuestas: serialized,
        rows,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Inspeccion de EPPs (Trabajos en caliente)</div>
          <div className="text-sm opacity-70">
            Marca BUENO / MALO / N/A. Si hay MALO, completa Observacion y plan de accion.
          </div>
        </div>
        <Button onClick={addRow}>+ Agregar fila</Button>
      </div>

      <div className="overflow-auto rounded-2xl border bg-white">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left w-[280px]">Trabajador (Apellidos y nombres)</th>
              <th className="p-3 text-left w-[140px]">DNI</th>
              {cols.map((c) => (
                <th key={c.key} className="p-3 text-left min-w-[170px]">{c.label}</th>
              ))}
              <th className="p-3 text-right w-[120px]">Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const malo = isRowMalo(row);
              return (
                <FragmentRow
                  key={idx}
                  row={row}
                  idx={idx}
                  cols={cols}
                  malo={malo}
                  updateRow={updateRow}
                  updateEppEstado={updateEppEstado}
                  removeRow={removeRow}
                  searchCtx={searchCtx}
                  setSearchCtx={setSearchCtx}
                  empOptions={empOptions}
                  empLoading={empLoading}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {Object.keys(errors).length > 0 ? (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
          {Object.values(errors)[0]}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button onClick={addRow}>+ Agregar fila</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Guardando..." : "Guardar inspeccion"}
        </Button>
      </div>
    </div>
  );
}

function FragmentRow({
  row,
  idx,
  cols,
  malo,
  updateRow,
  updateEppEstado,
  removeRow,
  searchCtx,
  setSearchCtx,
  empOptions,
  empLoading,
}) {
  const estadoBadge = malo ? <Badge variant="danger">MALO</Badge> : <Badge variant="success">OK</Badge>;
  const trabajadorValue = String(row?.trabajador || "");
  const quienValue = typeof row?.accion?.quien === "string"
    ? row.accion.quien
    : empleadoLabel(row?.accion?.quien);

  return (
    <>
      <tr className="border-t">
        <td className="p-3 align-top">
          <Input
            value={trabajadorValue}
            placeholder="Apellidos y nombres"
            onChange={(e) => updateRow(idx, { trabajador: e.target.value })}
          />
          <div className="mt-2">{estadoBadge}</div>
        </td>
        <td className="p-3 align-top">
          <Input
            value={String(row?.dni || "")}
            placeholder="DNI"
            onChange={(e) => updateRow(idx, { dni: e.target.value })}
          />
        </td>
        {cols.map((c) => {
          const v = String(row?.epps?.[c.key] || "").toUpperCase();
          return (
            <td key={c.key} className="p-3 align-top">
              <select
                className="w-full rounded-xl border p-2"
                value={v}
                onChange={(e) => updateEppEstado(idx, c.key, e.target.value)}
              >
                {ESTADOS.map((op) => (
                  <option key={op} value={op}>
                    {op === "" ? "-" : op === "NA" ? "N/A" : op}
                  </option>
                ))}
              </select>
            </td>
          );
        })}
        <td className="p-3 align-top text-right">
          <Button variant="danger" onClick={() => removeRow(idx)}>
            Eliminar
          </Button>
        </td>
      </tr>

      {malo ? (
        <tr className="border-t">
          <td colSpan={2 + cols.length + 1} className="p-3 bg-red-50">
            <div className="rounded-2xl border border-red-200 bg-white p-4 space-y-3">
              <div className="text-base font-semibold text-red-700">
                Observacion (obligatoria) + Plan de accion (obligatorio)
              </div>

              <div className="space-y-1">
                <div className="font-medium text-red-700">Observacion</div>
                <textarea
                  className="w-full rounded-xl border p-2 min-h-[80px]"
                  placeholder="Detalla observaciones y medidas correctivas..."
                  value={String(row?.observacion || "")}
                  onChange={(e) => updateRow(idx, { observacion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="font-medium">Que</div>
                  <Input
                    value={String(row?.accion?.que || "")}
                    placeholder="Accion correctiva inmediata..."
                    onChange={(e) =>
                      updateRow(idx, { accion: { ...(row?.accion || {}), que: e.target.value } })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <div className="font-medium">Quien</div>
                  <Autocomplete
                    placeholder="DNI / Apellido / Nombre"
                    displayValue={quienValue}
                    onInputChange={(text) => {
                      setSearchCtx({ rowIdx: idx, field: "quien", text });
                      updateRow(idx, { accion: { ...(row?.accion || {}), quien: text } });
                    }}
                    onFocus={() => {
                      setSearchCtx({ rowIdx: idx, field: "quien", text: quienValue });
                    }}
                    options={searchCtx?.rowIdx === idx && searchCtx?.field === "quien" ? empOptions : []}
                    loading={searchCtx?.rowIdx === idx && searchCtx?.field === "quien" ? empLoading : false}
                    getOptionLabel={empleadoLabel}
                    onSelect={(emp) =>
                      updateRow(idx, { accion: { ...(row?.accion || {}), quien: emp } })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <div className="font-medium">Cuando</div>
                  <Input
                    type="date"
                    value={String(row?.accion?.cuando || "")}
                    onChange={(e) =>
                      updateRow(idx, { accion: { ...(row?.accion || {}), cuando: e.target.value } })
                    }
                  />
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
