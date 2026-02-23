import { useEffect } from "react";

export default function useLoadingWatchdog({
  loading,
  setLoading,
  setMessage,
  label = "Carga",
  timeoutMs = 8000,
}) {
  useEffect(() => {
    if (!loading) return undefined;

    const timer = setTimeout(() => {
      setLoading(false);
      if (typeof setMessage === "function") {
        setMessage((prev) => prev || `${label}: timeout watchdog (${timeoutMs}ms). Revisa Network/Console.`);
      }
      console.error("[watchdog] timeout", { label, timeoutMs });
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [label, loading, setLoading, setMessage, timeoutMs]);
}
