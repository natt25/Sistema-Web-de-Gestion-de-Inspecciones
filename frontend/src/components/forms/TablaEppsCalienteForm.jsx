// frontend/src/components/forms/TablaEppsCalienteForm.jsx
import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import Badge from "../ui/Badge.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";

// Columnas por defecto (puedes ajustar textos)
const DEFAULT_COLS = [
  { key: "casaca_cuero", label: "Casaca de cuero" },
  { key: "mandil_cuero", label: "Mandil de cuero" },
  { key: "pantalon_cuero", label: "Pantalón de cuero" },
  { key: "guantes_cuero", label: "Guantes de cuero" },
  { key: "careta_soldador", label: "Careta de soldador" },
  { key: "careta_facial", label: "Careta facial" },
  { key: "escarpines", label: "Escarpines" },
  { key: "orejeras_tapones", label: "Orejeras y/o tapones" },
  { key: "respirador_media_cara", label: "Respirador media cara + filtros" },
];

const ESTADOS = ["", "BUENO", "MALO", "NA"];

function createEmptyRow() {
  const epps = {};
  for (const c of DEFAULT_COLS) epps[c.key] = "";
  return {
    trabajador: "",
    dni: "",
    epps,
    observacion: "",
    accion: { que: "", quien: null, cuando: "" }, // quien = objeto empleado (o string)
  };
}

function isRowMalo(row) {
  return Object.values(row?.epps || {}).some((v) => String(v).toUpperCase() === "MALO");
}

export default function TablaEppsCalienteForm({
  definicion,
  value,
  onChange,
  participantes = [], // opcional, por si quieres filtrar solo inspectores
}) {
  // columnas pueden venir desde JSON si quieres (fallback a DEFAULT_COLS)
  const cols = useMemo(() => {
    const fromJson = definicion?.json?.columns || definicion?.json_definicion?.columns;
    return Array.isArray(fromJson) && fromJson.length ? fromJson : DEFAULT_COLS;
  }, [definicion]);

  const rows = Array.isArray(value) ? value : [];

  const setRows = (updater) => {
    const next = typeof updater === "function" ? updater(rows) : updater;
    onChange?.(next);
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, patch) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  const updateEppEstado = (rowIdx, key, estado) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const next = {
          ...r,
          epps: { ...(r.epps || {}), [key]: estado },
        };

        // Si ya no hay MALO, limpiamos observación/acción para evitar basura
        if (!isRowMalo(next)) {
          next.observacion = "";
          next.accion = { que: "", quien: null, cuando: "" };
        }
        return next;
      })
    );
  };

  // Autocomplete (reutiliza tu API existente)
  const searchEmpleados = async (q) => {
    const r = await buscarEmpleados(q);
    return r?.data || r || [];
  };

  // Mostrar 1 fila inicial si está vacío
  useMemo(() => {
    if (!rows.length) onChange?.([createEmptyRow()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Inspección de EPPs (Trabajos en caliente)</div>
          <div className="text-sm opacity-70">
            Marca BUENO / MALO / N/A. Si hay MALO, completa Observación y Plan de acción.
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
                <th key={c.key} className="p-3 text-left min-w-[170px]">
                  {c.label}
                </th>
              ))}
              <th className="p-3 text-right w-[120px]">Acción</th>
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
                  searchEmpleados={searchEmpleados}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={addRow}>+ Agregar fila</Button>
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
  searchEmpleados,
}) {
  const estadoBadge = malo ? (
    <Badge variant="danger">MALO</Badge>
  ) : (
    <Badge variant="success">OK</Badge>
  );

  return (
    <>
      <tr className="border-t">
        <td className="p-3 align-top">
          <Input
            value={row.trabajador || ""}
            placeholder="Apellidos y nombres"
            onChange={(e) => updateRow(idx, { trabajador: e.target.value })}
          />
          <div className="mt-2">{estadoBadge}</div>
        </td>

        <td className="p-3 align-top">
          <Input
            value={row.dni || ""}
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
                    {op === "" ? "—" : op === "NA" ? "N/A" : op}
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

      {malo && (
        <tr className="border-t">
          <td colSpan={2 + cols.length + 1} className="p-3 bg-red-50">
            <div className="rounded-2xl border border-red-200 bg-white p-4 space-y-3">
              <div className="text-base font-semibold text-red-700">
                Observación (obligatoria) + Plan de acción (obligatorio)
              </div>

              <div className="space-y-1">
                <div className="font-medium text-red-700">Observación</div>
                <textarea
                  className="w-full rounded-xl border p-2 min-h-[80px]"
                  placeholder="Detalla observaciones y medidas correctivas..."
                  value={row.observacion || ""}
                  onChange={(e) => updateRow(idx, { observacion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="font-medium">Qué</div>
                  <Input
                    value={row.accion?.que || ""}
                    placeholder="Acción correctiva inmediata..."
                    onChange={(e) =>
                      updateRow(idx, { accion: { ...(row.accion || {}), que: e.target.value } })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <div className="font-medium">Quién</div>
                  <Autocomplete
                    placeholder="DNI / Apellido / Nombre"
                    value={row.accion?.quien || ""}
                    getOptionLabel={(opt) =>
                      opt?.nombre_completo ||
                      opt?.nombres ||
                      opt?.label ||
                      opt?.value ||
                      String(opt || "")
                    }
                    onSearch={searchEmpleados}
                    onSelect={(emp) =>
                      updateRow(idx, { accion: { ...(row.accion || {}), quien: emp } })
                    }
                    onClear={() =>
                      updateRow(idx, { accion: { ...(row.accion || {}), quien: null } })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <div className="font-medium">Cuándo</div>
                  <Input
                    type="date"
                    value={row.accion?.cuando || ""}
                    onChange={(e) =>
                      updateRow(idx, { accion: { ...(row.accion || {}), cuando: e.target.value } })
                    }
                  />
                </div>
              </div>

              <div className="text-xs opacity-70">
                * Si marcas “MALO” en cualquier EPP de la fila, este bloque es obligatorio.
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}