import axios from "axios";
import { getToken } from "../auth/auth.storage";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default http;
