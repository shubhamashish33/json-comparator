import React, { useMemo } from "react";
import { Copy, Link2, Wand2 } from "lucide-react";
import { parseJSONDetailed } from "../jsonUtils";
import { ToolbarButton } from "./WorkbenchControls";

export const QueryPanel = ({ queryLanguage, setQueryLanguage, query, setQuery, transformCode, setTransformCode, runTransform, fetchUrl, setFetchUrl, fetchRemote, queryResult, copyText, copied, commitValue }) => {
  const parsedResult = useMemo(() => parseJSONDetailed(queryResult), [queryResult]);
  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4 rounded-lg border border-slate-800 bg-[#101419] p-4">
              <div>
                <h2 className="text-base font-semibold text-white">Query JSON with live results</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Use JMESPath for filtering and projection, or a simple dot path for quick lookup.</p>
              </div>
              <label className="grid gap-2 text-xs text-slate-400">
                Query language
                <select value={queryLanguage} onChange={(event) => setQueryLanguage(event.target.value)} className="rounded-md border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white">
                  <option value="jmespath">JMESPath</option>
                  <option value="path">Simple path</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs text-slate-400">
                Expression
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={queryLanguage === "jmespath" ? "users[?active].{name: name, email: email}" : "users[0].email"}
                  rows={4}
                  className="w-full rounded-md border border-slate-700 bg-[#0b0d10] p-3 font-mono text-sm text-white outline-none focus:border-cyan-500"
                />
              </label>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Examples</div>
                <div className="flex flex-wrap gap-2">
                  {(queryLanguage === "jmespath"
                    ? [["First item", "[0]"], ["All IDs", "[*].id"], ["Object keys", "keys(@)"], ["Active items", "[?active]"]]
                    : [["Profile email", "profile.email"], ["First role", "roles[0]"]]
                  ).map(([label, expression]) => (
                    <button key={expression} onClick={() => setQuery(expression)} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:border-cyan-700 hover:text-cyan-200">{label}</button>
                  ))}
                </div>
              </div>
              <details className="rounded-md border border-slate-800 bg-[#0b0d10]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-300">Advanced JavaScript transform</summary>
                <div className="grid gap-2 border-t border-slate-800 p-3">
                  <p className="text-[11px] leading-4 text-yellow-200/70">Runs user-authored code locally. Use JMESPath for routine queries.</p>
                  <textarea value={transformCode} onChange={(event) => setTransformCode(event.target.value)} rows={8} className="w-full rounded border border-slate-700 bg-[#080a0d] p-3 font-mono text-xs text-white outline-none focus:border-cyan-500" />
                  <ToolbarButton onClick={runTransform}><Wand2 className="h-4 w-4" />Preview transform</ToolbarButton>
                </div>
              </details>
              <details className="rounded-md border border-slate-800 bg-[#0b0d10]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-300">Load JSON from a URL</summary>
                <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-slate-800 p-3">
                  <input value={fetchUrl} onChange={(event) => setFetchUrl(event.target.value)} placeholder="https://api.example.com/data" className="min-w-0 rounded border border-slate-700 bg-[#080a0d] px-3 py-2 text-xs text-white outline-none focus:border-cyan-500" />
                  <ToolbarButton onClick={fetchRemote}><Link2 className="h-4 w-4" />Fetch</ToolbarButton>
                </div>
              </details>
            </div>
            <div className="min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-[#0c0f13]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Live result</h2>
                  <p className="mt-1 text-xs text-slate-500">Updates as you type.</p>
                </div>
                <div className="flex gap-2">
                  <ToolbarButton onClick={() => copyText(queryResult, "query")} disabled={!queryResult}><Copy className="h-4 w-4" />{copied === "query" ? "Copied" : "Copy"}</ToolbarButton>
                  <ToolbarButton onClick={() => { if (!parsedResult.error) commitValue(parsedResult.value); }} disabled={Boolean(parsedResult.error)}>Apply to document</ToolbarButton>
                </div>
              </div>
              <pre className="h-[38rem] overflow-auto p-4 font-mono text-sm text-slate-200">{queryResult}</pre>
            </div>
          </section>
  );
};
