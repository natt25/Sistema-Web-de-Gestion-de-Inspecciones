import { useEffect, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

async function pingBackend() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const tokenRef = useRef(0);

  useEffect(() => {
    const token = ++tokenRef.current;
    let cancelled = false;
    let inFlight = false;

    const check = async () => {
      if (cancelled || token !== tokenRef.current) return;
      if (inFlight) return;
      inFlight = true;
      const ok = navigator.onLine ? await pingBackend() : false;
      inFlight = false;
      if (cancelled || token !== tokenRef.current) return;
      setOnline(ok);
    };

    const handleOnline = () => {
      //setOnline(true);
      check();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    check();
    const interval = setInterval(check, 4000);

    return () => {
      cancelled = true;
      if (token === tokenRef.current) tokenRef.current += 1;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
