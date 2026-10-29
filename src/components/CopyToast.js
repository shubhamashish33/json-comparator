import React from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export const CopyToast = ({ notification, onDismiss }) => {
  if (!notification) return null;
  const failed = notification.tone === "error";
  const Icon = failed ? AlertCircle : CheckCircle2;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
      <div key={notification.id} role={failed ? "alert" : "status"} aria-atomic="true"
        className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border bg-[#151c24] px-4 py-3 text-sm shadow-2xl shadow-black/40 ${failed ? "border-red-700/60 text-red-200" : "border-emerald-700/60 text-slate-100"}`}>
        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${failed ? "text-red-400" : "text-emerald-400"}`} />
        <span>{notification.message}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss copy notification" className="-mr-1 rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
