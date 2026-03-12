function tryParseJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeChecklistSections(json) {
  const rawSections = Array.isArray(json?.secciones) ? json.secciones : null;
  const rawItems = Array.isArray(json?.items) ? json.items : [];

  const sections =
    rawSections && rawSections.length
      ? rawSections
          .map((sec, secIdx) => {
            const secItems = Array.isArray(sec?.items) ? sec.items : [];
            const key = String(sec?.key_seccion ?? sec?.key ?? `SECCION_${secIdx + 1}`).trim();
            const titulo = String((sec?.titulo ?? sec?.nombre ?? key) || `SECCION ${secIdx + 1}`).trim();
            return {
              key: key || `SECCION_${secIdx + 1}`,
              titulo: titulo || `SECCION ${secIdx + 1}`,
              items: secItems.map((it, itemIdx) => ({
                ...it,
                categoria: it?.categoria ?? titulo,
                id: it?.id ?? it?.item_ref ?? it?.ref ?? `${secIdx + 1}.${itemIdx + 1}`,
              })),
            };
          })
          .filter((sec) => sec.items.length > 0)
      : [
          {
            key: "GENERAL",
            titulo: "GENERAL",
            items: rawItems.map((it, idx) => ({
              ...it,
              categoria: it?.categoria ?? "GENERAL",
              id: it?.id ?? it?.item_ref ?? it?.ref ?? idx + 1,
            })),
          },
        ].filter((sec) => sec.items.length > 0);

  return sections;
}

export function detectPlantillaTipo(json, rawPlantilla) {
  const raw = String(json?.tipo || "").trim().toLowerCase();

  // tipos explÍ­citos (cuando el JSON ya trae "tipo")
  if (raw === "observaciones_acciones") return "observaciones_acciones";
  if (raw === "observaciones_seguridad") return "observaciones_seguridad";
  if (raw === "tabla_extintores") return "tabla_extintores";
  if (raw === "tabla_epps") return "tabla_epps";
  if (raw === "tabla_kit_antiderrames") return "tabla_kit_antiderrames";
  if (raw === "tabla_lavaojos") return "tabla_lavaojos";
  if (raw === "tabla_epps_caliente") return "tabla_epps_caliente";
  if (raw === "tabla_botiquin") return "tabla_botiquin";
  if (raw === "tabla_epps_corte") return "tabla_epps_corte";
  if (raw === "tabla_camilla") return "tabla_camilla";

  // fallback por código formato (cuando el JSON NO trae "tipo")
  const codigo = String(
    rawPlantilla?.codigo_formato ||
      json?.codigo_formato ||
      json?.codigo ||
      ""
  ).toUpperCase();

  if (codigo.includes("AQP-SSOMA-FOR-014")) return "observaciones_seguridad";
  if (codigo.includes("AQP-SSOMA-FOR-034")) return "tabla_extintores";
  if (codigo.includes("AQP-SSOMA-FOR-033")) return "tabla_epps";
  if (codigo.includes("AQP-SSOMA-FOR-035")) return "tabla_kit_antiderrames";
  if (codigo.includes("AQP-SSOMA-FOR-036")) return "tabla_lavaojos";
  if (codigo.includes("AQP-SSOMA-FOR-037")) return "tabla_epps_caliente";
  if (codigo.includes("AQP-SSOMA-FOR-038")) return "tabla_botiquin";
  if (codigo.includes("AQP-SSOMA-FOR-041")) return "tabla_epps_corte";
  if (codigo.includes("AQP-SSOMA-FOR-043")) return "tabla_camilla";
  return "checklist";
}

export function normalizePlantillaDef(raw) {
  const jsonRaw = raw?.json ?? raw?.json_definicion ?? raw?.json_template ?? null;
  const parsedJson = tryParseJson(jsonRaw);
  const json = parsedJson && typeof parsedJson === "object" ? parsedJson : {};
  const tipo = detectPlantillaTipo(json, raw);
  const sections = tipo === "checklist" ? normalizeChecklistSections(json) : [];
  const items = sections.flatMap((sec) => sec.items);

  if (!Object.keys(json).length) {
    console.warn("[plantillaRenderer] json_definicion vacio o invalido", {
      id_plantilla_inspec: raw?.id_plantilla_inspec,
    });
  }

  return {
    ...raw,
    tipo,
    codigo_formato: raw?.codigo_formato ?? json?.codigo_formato ?? json?.codigo ?? null,
    nombre_formato: raw?.nombre_formato ?? json?.nombre_formato ?? json?.nombre ?? null,
    version: raw?.version ?? raw?.version_actual ?? json?.version ?? null,
    json: {
      ...json,
      tipo,
      secciones: sections,
      items,
    },
    secciones: sections,
    items,
  };
}

export function deserializeTableRowsFromRespuestas(respuestas, tipo) {
  const list = Array.isArray(respuestas) ? respuestas : [];
  const parsed = [];

  for (const r of list) {
    const data = r?.row_data ?? null;
    if (!data || typeof data !== "object") continue;
    if (tipo === "observaciones_acciones" && data?.__tipo === "observaciones_acciones") {
      parsed.push(data);
    }
    if (tipo === "tabla_extintores" && data?.__tipo === "tabla_extintores") {
      parsed.push(data);
    }
    if (tipo === "tabla_epps" && data?.__tipo === "tabla_epps") {
      parsed.push(data);
    }
  }
  return parsed;
}

function onlyFileNames(arr) {
  // soporta: ["a.jpg"] o [{name:"a.jpg",...}]
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === "string" ? x : x?.name))
    .filter(Boolean);
}

export function serializeObservacionesAccionesRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, idx) => {
    const evidenciaObsNames = onlyFileNames(row?.evidencia_obs);
    const evidenciaLevNames = onlyFileNames(row?.evidencia_lev);

    const canPorcentaje = evidenciaLevNames.length > 0;
    const porcentajeNum = Number(row?.porcentaje);
    const porcentaje = canPorcentaje && Number.isFinite(porcentajeNum) ? porcentajeNum : null;

    return {
      id: `row_${idx + 1}`,
      id_campo: null,
      item_ref: `row_${idx + 1}`,
      categoria: "OBSERVACIONES_ACCIONES",
      descripcion: row?.observacion?.trim() || `Fila ${idx + 1}`,

      // ESTADO = riesgo (lo sigues usando así)
      estado: row?.riesgo || null,

      // observacion (texto)
      observacion: row?.observacion?.trim() || "",

      // acción (tu forma actual)
      accion: {
        accion_correctiva: row?.accion_correctiva?.trim() || "",
        fecha_ejecucion: row?.fecha_ejecucion || null,
        porcentaje,
        responsable: typeof row?.responsable === "string" ? row.responsable.trim() : "",
        evidencia_obs: evidenciaObsNames,
        evidencia_lev: evidenciaLevNames,
      },

      // row_data SOLO â€œsafeâ€ (sin File/URL)
      row_data: {
        __tipo: "observaciones_acciones",
        rowIndex: idx + 1,
        observacion: row?.observacion?.trim() || "",
        riesgo: row?.riesgo || "",
        accion_correctiva: row?.accion_correctiva?.trim() || "",
        fecha_ejecucion: row?.fecha_ejecucion || null,
        responsable: typeof row?.responsable === "string" ? row.responsable.trim() : "",
        responsable_data: row?.responsable_data ?? null,
        evidencia_obs: evidenciaObsNames,
        evidencia_lev: evidenciaLevNames,
        porcentaje,
      },
    };
  });
}

// frontend/src/utils/plantillaRenderer.js
export function serializeTablaExtintoresRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, idx) => ({
    id_campo: null,
    item_ref: `row_${idx + 1}`,
    categoria: "TABLA_EXTINTORES",
    descripcion: row?.codigo?.trim() || row?.ubicacion?.trim() || `Fila ${idx + 1}`,
    estado: null,
    observacion: row?.observaciones?.trim() || "",
    accion: null,
    row_data: {
      __tipo: "tabla_extintores",
      rowIndex: idx + 1,
      ...row,
    },
  }));
}

function normalizeEppsCell(cellLike, legacyRow = null) {
  if (cellLike && typeof cellLike === "object" && !Array.isArray(cellLike)) {
    const estado = String(cellLike?.estado || "").toUpperCase();
    const observacion = estado === "MALO" ? String(cellLike?.observacion || cellLike?.observaciones || "").trim() : "";
    return {
      estado,
      observacion,
      accion:
        estado === "MALO"
          ? {
              que: String(cellLike?.accion?.que || "").trim(),
              quien: String(cellLike?.accion?.quien || "").trim(),
              quien_dni: String(cellLike?.accion?.quien_dni || "").trim(),
              cuando: String(cellLike?.accion?.cuando || "").trim(),
            }
          : { que: "", quien: "", quien_dni: "", cuando: "" },
    };
  }

  if (typeof cellLike === "string") {
    const estado = String(cellLike || "").toUpperCase();
    const useLegacy = estado === "MALO" && legacyRow && typeof legacyRow === "object";
    return {
      estado,
      observacion: useLegacy ? String(legacyRow?.observaciones || "").trim() : "",
      accion: useLegacy
        ? {
            que: String(legacyRow?.accion?.que || "").trim(),
            quien: String(legacyRow?.accion?.quien || "").trim(),
            quien_dni: String(legacyRow?.accion?.quien_dni || "").trim(),
            cuando: String(legacyRow?.accion?.cuando || "").trim(),
          }
        : { que: "", quien: "", quien_dni: "", cuando: "" },
    };
  }

  return {
    estado: "",
    observacion: "",
    accion: { que: "", quien: "", quien_dni: "", cuando: "" },
  };
}

function normalizeEppsColumns(columnsLike, eppsLike) {
  const rawColumns = Array.isArray(columnsLike) ? columnsLike : [];
  const normalizedColumns = rawColumns
    .map((col, idx) => {
      const key = String(col?.key || "").trim();
      if (!key) return null;
      const fallbackLabel = key.startsWith("otros_") ? `OTROS ${idx + 1}` : key;
      return {
        key,
        label: String(col?.label || fallbackLabel).trim() || fallbackLabel,
      };
    })
    .filter(Boolean);

  if (normalizedColumns.length) return normalizedColumns;

  return Object.keys(eppsLike || {}).map((key, idx) => ({
    key,
    label: key.startsWith("otros_") ? `OTROS ${idx + 1}` : key,
  }));
}

function normalizeEppsRow(row, idx, columnsLike = null) {
  const source = row && typeof row === "object" ? row : {};
  const rawEpps = source?.epps && typeof source.epps === "object" ? source.epps : {};
  const epps = {};
  const columns = normalizeEppsColumns(columnsLike || source?.columns, rawEpps);

  columns.forEach((col) => {
    epps[col.key] = normalizeEppsCell(rawEpps[col.key], source);
  });

  return {
    __tipo: "tabla_epps",
    rowIndex: source?.rowIndex ?? idx + 1,
    apellidos_nombres: String(source?.apellidos_nombres || "").trim(),
    puesto_trabajo: String(source?.puesto_trabajo || "").trim(),
    columns,
    epps,
  };
}

export function serializeTablaEppsRows(rows, columns = null) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.map((row, idx) => {
    const normalized = normalizeEppsRow(row, idx, columns);
    return {
      id_campo: null,
      item_ref: `row_${idx + 1}`,
      categoria: "TABLA_EPPS",
      descripcion:
        normalized.apellidos_nombres ||
        normalized.puesto_trabajo ||
        `Fila ${idx + 1}`,
      estado: null,
      observacion: "",
      accion: null,
      row_data: normalized,
    };
  });
}

export function deserializeTablaEppsRowsFromRespuestas(respuestas) {
  const list = Array.isArray(respuestas) ? respuestas : [];
  return list
    .filter((x) => {
      const categoria = String(x?.categoria || "").toUpperCase();
      const tipo = String(x?.row_data?.__tipo || "").toLowerCase();
      return categoria === "TABLA_EPPS" || tipo === "tabla_epps";
    })
    .map((x, idx) => normalizeEppsRow(x?.row_data || {}, idx, x?.row_data?.columns));
}


export function serializeTablaKitAntiderrames({ meta, rows }) {
  const out = [];

  // meta (días: fecha/realizado/firma)
  out.push({
    categoria: "TABLA_KIT_ANTIDERRAMES",
    item_ref: "meta",
    valor: null,
    row_data: { __tipo: "tabla_kit_antiderrames_meta", meta },
  });

  // filas materiales
  (rows || []).forEach((r, i) => {
    out.push({
      categoria: "TABLA_KIT_ANTIDERRAMES",
      item_ref: r.item_ref || `m${i + 1}`,
      valor: null,
      row_data: { __tipo: "tabla_kit_antiderrames_row", rowIndex: i + 1, ...r },
    });
  });

  return out;
}

export function deserializeTablaKitAntiderramesFromRespuestas(respuestas = []) {
  const list = Array.isArray(respuestas) ? respuestas : [];
  const ours = list.filter((r) => String(r?.categoria || "").toUpperCase() === "TABLA_KIT_ANTIDERRAMES");

  let meta = null;
  const rows = [];

  for (const r of ours) {
    const rd = r?.row_data;
    const rowData = typeof rd === "string" ? safeJsonParse2(rd) : rd;

    if (rowData?.__tipo === "tabla_kit_antiderrames_meta") meta = rowData?.meta || null;
    if (rowData?.__tipo === "tabla_kit_antiderrames_row") rows.push(rowData);
  }

  rows.sort((a, b) => Number(a.rowIndex || 0) - Number(b.rowIndex || 0));
  return { meta, rows };
}

function safeJsonParse2(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function serializeTablaEppsCalienteRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];

  function normalizeCell(cellLike) {
    if (cellLike && typeof cellLike === "object" && !Array.isArray(cellLike)) {
      return {
        estado: String(cellLike?.estado || "").toUpperCase(),
        observacion: String(cellLike?.observacion || ""),
        accion: {
          que: String(cellLike?.accion?.que || ""),
          quien: String(cellLike?.accion?.quien || ""),
          quien_dni: String(cellLike?.accion?.quien_dni || ""),
          cuando: String(cellLike?.accion?.cuando || ""),
        },
      };
    }

    if (typeof cellLike === "string") {
      return {
        estado: String(cellLike || "").toUpperCase(),
        observacion: "",
        accion: { que: "", quien: "", quien_dni: "", cuando: "" },
      };
    }

    return {
      estado: "",
      observacion: "",
      accion: { que: "", quien: "", quien_dni: "", cuando: "" },
    };
  }

  return safeRows.map((row, idx) => {
    const eppsRaw = row?.epps && typeof row.epps === "object" ? row.epps : {};
    const epps = {};
    Object.keys(eppsRaw).forEach((key) => {
      epps[key] = normalizeCell(eppsRaw[key]);
    });

    return {
      categoria: "TABLA_EPPS_CALIENTE",
      item_ref: `row_${idx + 1}`,
      row_data: {
        __tipo: "tabla_epps_caliente",
        rowIndex: idx + 1,
        trabajador: String(row?.trabajador || row?.apellidos_nombres || ""),
        epps,
      },
    };
  });
}

export function deserializeTablaEppsCalienteRowsFromRespuestas(respuestas = []) {
  const list = Array.isArray(respuestas) ? respuestas : [];

  function parseRowData(row) {
    const raw = row?.row_data ?? row?.rowData ?? null;
    if (raw && typeof raw === "object") return raw;
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function normalizeCell(cellLike) {
    if (cellLike && typeof cellLike === "object" && !Array.isArray(cellLike)) {
      return {
        estado: String(cellLike?.estado || "").toUpperCase(),
        observacion: String(cellLike?.observacion || ""),
        accion: {
          que: String(cellLike?.accion?.que || ""),
          quien: String(cellLike?.accion?.quien || ""),
          quien_dni: String(cellLike?.accion?.quien_dni || ""),
          cuando: String(cellLike?.accion?.cuando || ""),
        },
      };
    }

    if (typeof cellLike === "string") {
      return {
        estado: String(cellLike || "").toUpperCase(),
        observacion: "",
        accion: { que: "", quien: "", quien_dni: "", cuando: "" },
      };
    }

    return {
      estado: "",
      observacion: "",
      accion: { que: "", quien: "", quien_dni: "", cuando: "" },
    };
  }

  return list
    .filter((r) => {
      const categoria = String(r?.categoria || "").toUpperCase();
      if (categoria === "TABLA_EPPS_CALIENTE") return true;
      const rd = parseRowData(r);
      return String(rd?.__tipo || "").toLowerCase() === "tabla_epps_caliente";
    })
    .map((r, idx) => {
      const rd = parseRowData(r) || {};
      const sourceEpps = rd?.epps && typeof rd.epps === "object" ? rd.epps : {};
      const epps = {};
      Object.keys(sourceEpps).forEach((key) => {
        epps[key] = normalizeCell(sourceEpps[key]);
      });

      return {
        __rowOrder: Number(rd?.rowIndex ?? idx + 1),
        trabajador: String(rd?.trabajador || rd?.apellidos_nombres || ""),
        epps,
      };
    })
    .sort((a, b) => a.__rowOrder - b.__rowOrder)
    .map((row) => {
      const out = { ...row };
      delete out.__rowOrder;
      return out;
    });
}

// === FOR-038 BOTIQUIN ===
export function serializeTablaBotiquin(payload) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return [];

  return [
    {
      categoria: "TABLA_BOTIQUIN",
      item_ref: "botiquin_1",
      valor: null,
      row_data: {
        __tipo: "tabla_botiquin",
        ...data,
      },
    },
  ];
}

export function deserializeTablaBotiquinFromRespuestas(respuestas = []) {
  const arr = Array.isArray(respuestas) ? respuestas : [];
  const row = arr.find((x) => String(x?.categoria || "").toUpperCase() === "TABLA_BOTIQUIN");
  if (!row?.row_data) return null;
  if (typeof row.row_data === "string") return tryParseJson(row.row_data);
  return row.row_data;
}

// =========================
// FOR-036 - Tabla Lavaojos 
// =========================
export function serializeTablaLavaojos({ meta, rows }) {
  const out = [];

  // meta por días (fecha/realizado/firma)
  out.push({
    categoria: "TABLA_LAVAOJOS",
    item_ref: "meta",
    valor: null,
    row_data: { __tipo: "tabla_lavaojos_meta", meta },
  });

  // filas items
  (rows || []).forEach((r, i) => {
    out.push({
      categoria: "TABLA_LAVAOJOS",
      item_ref: r.item_ref || `i${i + 1}`,
      valor: null,
      row_data: {
        __tipo: "tabla_lavaojos_row",
        rowIndex: i + 1,
        item_ref: r.item_ref || `i${i + 1}`,
        descripcion: r.descripcion || "",
        checks: r.checks || {},
        __locked: !!r.__locked,
      },
    });
  });

  return out;
}

export function deserializeTablaLavaojosFromRespuestas(respuestas = []) {
  const list = Array.isArray(respuestas) ? respuestas : [];
  const ours = list.filter((r) => String(r?.categoria || "").toUpperCase() === "TABLA_LAVAOJOS");

  let meta = null;
  const rows = [];

  for (const r of ours) {
    const rd = r?.row_data;
    const rowData = typeof rd === "string" ? safeJsonParse(rd) : rd;

    if (rowData?.__tipo === "tabla_lavaojos_meta") meta = rowData?.meta || null;

    if (rowData?.__tipo === "tabla_lavaojos_row") {
      rows.push({
        rowIndex: rowData?.rowIndex,
        item_ref: rowData?.item_ref || r?.item_ref,
        descripcion: rowData?.descripcion || "",
        checks: rowData?.checks || {},
        __locked: !!rowData?.__locked,
      });
    }
  }

  rows.sort((a, b) => Number(a.rowIndex || 0) - Number(b.rowIndex || 0));
  return { meta, rows };
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function serializeTablaCamilla({ codigo_camilla, meta, rows }) {
  return {
    codigo_camilla: String(codigo_camilla || ""),
    meta: meta || {},
    rows: Array.isArray(rows)
      ? rows.map((r) => ({
          item_ref: r?.item_ref || null,
          descripcion: r?.descripcion ?? r?.desc ?? "",
          __locked: Boolean(r?.__locked),
          checks: r?.checks || {},
        }))
      : [],
  };
}
