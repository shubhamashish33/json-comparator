import React, { useState } from "react";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { X } from "lucide-react";
import { parseTypedValue } from "../workbenchOperations";
import { ErrorMessage, ToolbarButton } from "./WorkbenchControls";

export const NodeDialog = ({ mode, node, parentPath, onClose, onSave }) => {
  const dialogRef = useDialogFocus(onClose);
  const [key, setKey] = useState(node?.key || "");
  const [type, setType] = useState(node?.type || "string");
  const [raw, setRaw] = useState(node?.raw || "");
  const [error, setError] = useState(null);

  const save = () => {
    try {
      const value = parseTypedValue(raw, type);
      onSave({ key, value, parentPath });
    } catch (err) {
      setError({ message: err.message || "Invalid value" });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="node-dialog-title" className="max-h-[90vh] overflow-auto rounded-xl w-full max-w-xl border border-slate-700 bg-[#101419] p-5 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="node-dialog-title" className="text-sm font-semibold text-white">{mode === "add" ? "Add node" : "Edit node"}</h2>
          <button aria-label="Close dialog" onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <label htmlFor="node-key" className="text-xs uppercase text-slate-500">Key</label>
          <input id="node-key" value={key} onChange={(event) => setKey(event.target.value)} className="border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
          <label htmlFor="node-type" className="text-xs uppercase text-slate-500">Type</label>
          <select id="node-type" value={type} onChange={(event) => setType(event.target.value)} className="border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="null">Null</option>
            <option value="object">Object</option>
            <option value="array">Array</option>
          </select>
          <label htmlFor="node-value" className="text-xs uppercase text-slate-500">Value</label>
          <textarea
            id="node-value"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            disabled={type === "null"}
            rows={type === "object" || type === "array" ? 8 : 3}
            className="border border-slate-700 bg-[#0b0d10] p-3 text-sm text-white outline-none focus:border-cyan-500 disabled:text-slate-600"
          />
          {error && <ErrorMessage error={error} />}
          <div className="flex justify-end gap-2">
            <ToolbarButton onClick={onClose}>Cancel</ToolbarButton>
            <ToolbarButton onClick={save} active>Save</ToolbarButton>
          </div>
        </div>
      </div>
    </div>
  );
};

