import axios from "axios";
import { clearAuth, getToken } from "../auth/auth.storage.js";

function resolveBaseURL() {
  const raw = String(
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:3000"
  );

  // Siempre trabajamos con host base para evitar /api/api cuando el env ya incluye /api.
  return raw.replace(/\/+$/, "").replace(/\/api$/i, "");
}

const http = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      clearAuth();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default http;
