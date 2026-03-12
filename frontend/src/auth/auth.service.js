import http from "../api/http";

export async function login({ dni, password }) {
  const res = await http.post("/api/auth/login", { dni, password });
  return res.data;
}

export async function guestLogin() {
  const res = await http.post("/api/auth/guest");
  return res.data;
}
