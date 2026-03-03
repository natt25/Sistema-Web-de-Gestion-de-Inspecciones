import http from "./http.js";

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.recordset)) return payload.recordset;
  return [];
}

function buildFinalUrl(config = {}) {
  const base = String(config.baseURL || "").replace(/\/+$/, "");
  const path = String(config.url || "");
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function listarPlantillas() {
  const response = await http.get("/api/plantillas");
  const finalUrl = buildFinalUrl(response?.config);
  console.log(`[plantillas.api] GET ${finalUrl} -> ${response.status}`);
  return extractRows(response?.data);
}

export async function obtenerDefinicionPlantilla(id, version, options = {}) {
  const qs = version ? `?version=${encodeURIComponent(version)}` : "";
  const response = await http.get(`/api/plantillas/${id}/definicion${qs}`, {
    signal: options.signal,
  });
  const finalUrl = buildFinalUrl(response?.config);
  console.log(`[plantillas.api] GET ${finalUrl} -> ${response.status}`);
  const data = response?.data || {};
  const rawJson = data?.json_definicion ?? data?.json ?? data?.json_template ?? null;
  const json =
    typeof rawJson === "string"
      ? JSON.parse(rawJson)
      : rawJson;
  return { ...data, json };
}

// alias compat
export async function getDefinicionPlantilla(id, version) {
  return obtenerDefinicionPlantilla(id, version);
}
