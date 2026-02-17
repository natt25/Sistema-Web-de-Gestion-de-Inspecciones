import http from "../api/http";

export async function login({ dni, password }) {
  const res = await http.post("/api/auth/login", { dni, password });
  return res.data;
}
