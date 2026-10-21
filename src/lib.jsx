import { createContext, useContext, useEffect, useState } from "react";
let csrfToken = "";
export const setCsrf = (value) => {
  csrfToken = value || "";
};
export async function api(path, options = {}) {
  const { method = "GET", body, signal } = options;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    signal,
    headers:
      method === "GET"
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    ...(method !== "GET" ? { body: JSON.stringify(body || {}) } : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unexpected response. Check that it is running.",
    );
  }
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
export function useLoad(path, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [key, setKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(path, { signal: controller.signal })
      .then((v) => {
        setData(v);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path, key, ...deps]);
  return { data, error, loading, reload: () => setKey((x) => x + 1), setData };
}
export const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
export const formatDate = (date) =>
  new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
export const formatTime = (time) => {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const today = () =>
  new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const days = (count = 7) =>
  Array.from({ length: count }, (_, i) =>
    new Date(Date.now() + 330 * 60000 + i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
export const statusLabel = (status) =>
  ({
    confirmed: "Confirmed",
    checked_in: "Checked in",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  })[status] || status;
export const directions = (p) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat ?? p.provider_lat},${p.lng ?? p.provider_lng}&travelmode=driving`;
