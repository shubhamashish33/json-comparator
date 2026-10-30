import React, { useState } from "react";
import { Link } from "react-router-dom";
import { WorkflowDemo } from "./WorkflowDemo";
import { parseJSONDetailed } from "../jsonUtils";
import { toolPages } from "../pageMetadata";

export function FormatExample() {
  const [text, setText] = useState('{"service":"orders","active":true}');
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  return <section aria-label="Try JSON formatting" className="rounded-xl border border-slate-700 bg-[#101419] p-4">
    <label className="grid gap-2 text-sm text-slate-300">JSON to format<textarea rows={7} spellCheck={false} value={text} onChange={event => { setText(event.target.value); setResult(""); setError(""); }} className="w-full rounded border border-slate-700 bg-[#0b0d10] p-3 font-mono text-xs text-slate-200" /></label>
    <button type="button" onClick={() => { const parsed = parseJSONDetailed(text); if (!text.trim()) { setError("Paste JSON first."); setResult(""); } else if (parsed.error) { setError(parsed.error.message); setResult(""); } else { setError(""); setResult(JSON.stringify(parsed.value, null, 2)); } }} className="mt-3 rounded bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950">Format example</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {result && <pre aria-label="Formatted JSON" className="mt-3 overflow-auto rounded border border-slate-800 p-3 text-xs leading-6 text-cyan-100">{result}</pre>}
  </section>;
}

export function ToolPage({ page }) {
  return <div className="min-h-screen bg-[#0b0d10] text-slate-200">
    <header className="border-b border-slate-800"><nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-5 text-sm"><Link to="/" className="mr-auto font-semibold text-white">JSONEditor</Link><Link to="/help">Help</Link><Link to={page.target} className="rounded border border-cyan-700 px-3 py-2 text-cyan-200">Open workspace</Link></nav></header>
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12">
      <section className="max-w-3xl"><p className="text-xs uppercase tracking-widest text-cyan-400">Local JSON tools</p><h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">{page.heading}</h1><p className="mt-4 leading-7 text-slate-400">{page.description}</p></section>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[0.8fr_1.2fr]"><section><h2 className="text-xl font-medium text-white">How to use it</h2><ol className="mt-4 list-decimal space-y-4 pl-5 text-sm leading-6 text-slate-300">{page.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="mt-6 text-sm leading-7 text-slate-400">{page.detail}</p><Link to={page.target} className="mt-6 inline-block rounded bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950">Open full {page.mode === "redact" ? "sanitizer" : page.mode === "format" ? "editor" : "comparison"}</Link></section>{page.mode === "format" ? <FormatExample /> : <WorkflowDemo initialMode={page.mode} />}</div>
      <nav aria-label="Related JSON tools" className="flex flex-wrap gap-4 border-t border-slate-800 pt-6 text-sm text-cyan-300">{toolPages.filter(item => item.path !== page.path).map(item => <Link key={item.path} to={item.path}>{item.title.split(" — ")[0]}</Link>)}</nav>
    </main>
  </div>;
}
