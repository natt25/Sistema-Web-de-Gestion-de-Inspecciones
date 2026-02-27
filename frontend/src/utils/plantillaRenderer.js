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

export function detectPlantillaTipo(json) {
  const raw = String(json?.tipo || "").trim().toLowerCase();
  if (raw === "observaciones_acciones") return "observaciones_acciones";
  if (raw === "tabla_extintores") return "tabla_extintores";
  return "checklist";
}

export function normalizePlantillaDef(raw) {
  const jsonRaw = raw?.json ?? raw?.json_definicion ?? null;
  const parsedJson = tryParseJson(jsonRaw);
  const json = parsedJson && typeof parsedJson === "object" ? parsedJson : {};
  const tipo = detectPlantillaTipo(json);
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

      // row_data SOLO “safe” (sin File/URL)
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
      evidencia_fotos: Array.isArray(row?.evidencia_fotos) ? row.evidencia_fotos : [],
    },
  }));
}
