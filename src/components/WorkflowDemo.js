import React, { useMemo, useState } from "react";
import { compareJSONValues, redactSecrets } from "../jsonUtils";
import { defaultSettings } from "../workbenchConfig";

const before = { orders: [{ id: "A", status: "pending" }, { id: "B", status: "paid" }], updatedAt: "10:00" };
const after = { orders: [{ id: "B", status: "paid" }, { id: "A", status: "shipped" }], updatedAt: "10:05" };
const sensitive = { service: "orders", apiKey: "example-key-not-a-real-secret", user: { name: "Ada", password: "example-password" } };

export function WorkflowDemo({ initialMode = "compare" }) {
  const [mode, setMode] = useState(initialMode);
  const [ignoreTimestamp, setIgnoreTimestamp] = useState(true);
  const differences = useMemo(() => compareJSONValues(before, after, { ...defaultSettings, arrayMode: "match-key", arrayMatchKey: "id", ignorePaths: ignoreTimestamp ? "updatedAt" : "" }), [ignoreTimestamp]);
  const redacted = useMemo(() => redactSecrets(sensitive), []);
  return <section aria-label="Interactive JSON examples" className="min-w-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-[#101419] shadow-2xl shadow-cyan-950/20">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-4">
      <span className="mr-auto text-xs text-slate-500">Try an example · your workspace stays untouched</span>
      {[['compare', 'Compare responses'], ['redact', 'Sanitize secrets']].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-cyan-500 ${mode === value ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{label}</button>)}
    </div>
    <div className="p-4">
      <h2 className="text-lg font-semibold text-white">{mode === 'compare' ? 'Reordered records. One meaningful change.' : 'Keep the example. Remove the credentials.'}</h2>
      <p className="mb-4 mt-2 text-xs leading-5 text-slate-400">{mode === 'compare' ? 'Match orders by id so a different array order does not hide a changed status.' : 'Sensitive keys are replaced locally. Always review the result for anything detection missed.'}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {[[mode === 'compare' ? 'Before' : 'Source', mode === 'compare' ? before : sensitive], [mode === 'compare' ? 'After' : 'Sanitized', mode === 'compare' ? after : redacted.value]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-slate-800 bg-[#0b0d10] p-3"><h3 className="mb-2 text-xs text-slate-500">{label}</h3><pre className="overflow-x-auto text-xs leading-6 text-slate-200">{JSON.stringify(value, null, 2)}</pre></div>)}
      </div>
      {mode === 'compare' && <label className="mt-4 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={ignoreTimestamp} onChange={event => setIgnoreTimestamp(event.target.checked)} />Ignore updatedAt</label>}
      <div role="status" className="mt-4 rounded-lg border border-slate-800 bg-[#0b0d10] p-3 text-xs">
        {mode === 'compare' ? <><p className="text-cyan-200">{differences.length} meaningful {differences.length === 1 ? 'change' : 'changes'}</p><ul className="mt-2 space-y-1 text-slate-400">{differences.map(diff => <li key={diff.path}>{diff.path}: {String(diff.oldValue ?? diff.value)} → {String(diff.newValue ?? diff.value)}</li>)}</ul></> : <p className="text-emerald-200">{redacted.matches.length} sensitive values replaced. Useful context preserved.</p>}
      </div>
    </div>
  </section>;
}
