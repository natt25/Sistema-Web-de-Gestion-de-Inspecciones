import http from "./http";

export async function listarPendientes({
  dias = 7,
  solo_mias = 0,
  estado = "ALL",
  id_usuario,
  id_plantilla_inspec,
} = {}) {
  const q = new URLSearchParams();

  if (dias !== null && dias !== undefined) {
    q.set("dias", String(dias));
  }

  q.set("solo_mias", String(solo_mias));

  if (estado && estado !== "ALL") {
    q.set("estado", estado);
  }

  if (id_usuario !== null && id_usuario !== undefined && id_usuario !== "") {
    q.set("id_usuario", String(id_usuario));
  }

  if (id_plantilla_inspec !== null && id_plantilla_inspec !== undefined && id_plantilla_inspec !== "") {
    q.set("id_plantilla_inspec", String(id_plantilla_inspec));
  }

  const res = await http.get(`/api/inspecciones/acciones/pendientes?${q.toString()}`);
  return res.data;
}

export async function contarPendientes({
  dias = null,
  solo_mias = 1,
  estado = "ALL",
  id_usuario,
  id_plantilla_inspec,
} = {}) {
  const q = new URLSearchParams();

  if (dias !== null && dias !== undefined) {
    q.set("dias", String(dias));
  }

  q.set("solo_mias", String(solo_mias));

  if (estado && estado !== "ALL") {
    q.set("estado", estado);
  }

  if (id_usuario !== null && id_usuario !== undefined && id_usuario !== "") {
    q.set("id_usuario", String(id_usuario));
  }

  if (id_plantilla_inspec !== null && id_plantilla_inspec !== undefined && id_plantilla_inspec !== "") {
    q.set("id_plantilla_inspec", String(id_plantilla_inspec));
  }

  const res = await http.get(`/api/inspecciones/acciones/pendientes/count?${q.toString()}`);
  return res.data;
}
