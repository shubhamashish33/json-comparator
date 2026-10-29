import React from "react";
import { AlertCircle, Braces, ClipboardPaste, Upload, ShieldCheck } from "lucide-react";

export const ErrorMessage = ({ error, onJump }) => {
  if (!error) return null;
  return (
    <button
      type="button"
      onClick={onJump}
      className={`flex w-full items-start gap-2 rounded-md border border-red-900/70 bg-red-950/30 p-2 text-left text-xs text-red-200 ${onJump ? "hover:border-red-700 hover:bg-red-950/50" : "cursor-default"}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{error.message}{error.line ? ` at ${error.line}:${error.column}` : ""}</span>
      {onJump && <span className="shrink-0 text-red-300">Jump to error</span>}
    </button>
  );
};

export const ToolbarButton = ({ children, onClick, disabled, active, title }) => (
  <button
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-700 bg-[#101419] text-slate-200 hover:border-slate-600 hover:bg-slate-900"
    }`}
  >
    {children}
  </button>
);

export const EmptyEditorState = ({ onPaste, onOpen, onSample }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0c0f13] p-6">
    <div className="max-w-lg text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
        <Braces className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-white">Paste JSON to begin</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Paste from your clipboard, open a file, or drop a .json or .jsonc file here.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <ToolbarButton onClick={onPaste} active title="Paste JSON from the clipboard">
          <ClipboardPaste className="h-4 w-4" />Paste JSON
        </ToolbarButton>
        <ToolbarButton onClick={onOpen} title="Open a JSON file">
          <Upload className="h-4 w-4" />Open file
        </ToolbarButton>
        <ToolbarButton onClick={onSample} title="Load example JSON">Load example</ToolbarButton>
      </div>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-900/70 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" />Processed locally in this browser
      </div>
    </div>
  </div>
);

