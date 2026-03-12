import http from "./http";

// GET /api/usuarios
export async function listarUsuarios() {
  const res = await http.get("/usuarios");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function listarCatalogosUsuarios() {
  const res = await http.get("/usuarios/catalogos");
  return {
    roles: Array.isArray(res?.data?.roles) ? res.data.roles : [],
    estados: Array.isArray(res?.data?.estados) ? res.data.estados : [],
  };
}

// POST /api/usuarios
export async function crearUsuario(payload) {
  const res = await http.post("/usuarios", payload);
  return res?.data;
}

// PUT /api/usuarios/:id
export function actualizarUsuario(id_usuario, payload) {
  // payload: { id_rol?, id_estado_usuario? }
  return http.put(`/usuarios/${id_usuario}`, payload);
}

// PATCH /api/usuarios/:id/estado
export async function cambiarEstadoUsuario(id_usuario, id_estado_usuario) {
  const res = await http.patch(`/usuarios/${id_usuario}/estado`, { id_estado_usuario });
  return res?.data;
}

// POST /api/usuarios/:id/reset-password
export async function resetPasswordUsuario(id_usuario, password) {
  const res = await http.post(`/usuarios/${id_usuario}/reset-password`, { password });
  return res?.data;
}

export async function buscarResponsables(q) {
  const r = await http.get(`/api/usuarios/buscar?q=${encodeURIComponent(q)}`);
  return r.data; // [{id_usuario, dni, nombres, apellidos}, ...]
}
