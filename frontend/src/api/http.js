import axios from "axios";
import { clearToken, getToken } from "../auth/auth.storage";

const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, ""),
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
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      clearToken();
    }
    return Promise.reject(error);
  }
);

export default http;
