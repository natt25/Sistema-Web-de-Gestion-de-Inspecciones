import http from "./http";

// GET /api/usuarios
export function listarUsuarios() {
  return http.get("/usuarios");
}

// POST /api/usuarios
export function crearUsuario(payload) {
  // payload: { dni, id_rol, id_estado_usuario, password }
  return http.post("/usuarios", payload);
}

// PUT /api/usuarios/:id
export function actualizarUsuario(id_usuario, payload) {
  // payload: { id_rol?, id_estado_usuario? }
  return http.put(`/usuarios/${id_usuario}`, payload);
}

// PATCH /api/usuarios/:id/estado
export function cambiarEstadoUsuario(id_usuario, id_estado_usuario) {
  return http.patch(`/usuarios/${id_usuario}/estado`, { id_estado_usuario });
}

// POST /api/usuarios/:id/reset-password
export function resetPasswordUsuario(id_usuario, password) {
  return http.post(`/usuarios/${id_usuario}/reset-password`, { password });
}

export async function buscarResponsables(q) {
  const r = await http.get(`/api/usuarios/buscar?q=${encodeURIComponent(q)}`);
  return r.data; // [{id_usuario, dni, nombres, apellidos}, ...]
}