import React from "react";

export const CompareDocumentSelector = ({ side, value, documents, onChange, onOpen, onClear, canClear, temporary = false }) => (
  <div className="grid min-w-0 gap-1.5 text-xs text-slate-500">
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={`compare-${side}`}>{side} JSON</label>
      <div className="flex gap-3">
        <button type="button" onClick={onOpen} aria-label={`Open ${side.toLowerCase()} JSON file`} className="text-slate-400 hover:text-white">Open file</button>
        <button type="button" onClick={onClear} disabled={!canClear} aria-label={`Clear ${side.toLowerCase()} JSON`} className="text-slate-400 hover:text-white disabled:opacity-40">Clear</button>
      </div>
    </div>
    <select id={`compare-${side}`} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 rounded-md border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
      {temporary && <option value="">Temporary input</option>}
      {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
    </select>
  </div>
);
