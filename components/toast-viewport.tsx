"use client";

import { useEffect, useMemo, useState } from "react";

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastEventDetail = {
  type: ToastType;
  message: string;
};

const TOAST_DURATION_MS = 3600;

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 1;

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;

      if (!detail?.message) {
        return;
      }

      const id = nextId++;
      setToasts((current) => [...current, { id, ...detail }]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, TOAST_DURATION_MS);
    };

    window.addEventListener("app-toast", onToast as EventListener);
    return () => window.removeEventListener("app-toast", onToast as EventListener);
  }, []);

  const visibleToasts = useMemo(() => toasts.slice(-4), [toasts]);

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <p className="toast__eyebrow">{toast.type === "success" ? "Listo" : "Revisión"}</p>
          <p className="toast__message">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
