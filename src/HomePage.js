import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Braces, GitCompare, Lock, TerminalSquare } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b0d10] font-mono text-slate-200 selection:bg-cyan-500/20">
      <header className="border-b border-slate-800 bg-[#0b0d10]/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate("/compare")} className="flex items-center gap-2 text-left">
            <TerminalSquare className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-semibold uppercase text-slate-100">JSONSync</span>
          </button>
          <button
            onClick={() => navigate("/compare")}
            className="inline-flex items-center gap-2 rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/15"
          >
            Open workspace
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            local-first JSON tooling
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
            JSON editing and comparison without the noise.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Work in a single JSON editor when you need to format, repair, add, or remove keys. Switch to comparison only when you need a side-by-side diff.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/compare")}
              className="inline-flex items-center gap-2 rounded border border-cyan-500/50 bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Braces className="h-4 w-4" />
              Start editing
            </button>
            <button
              onClick={() => navigate("/compare")}
              className="inline-flex items-center gap-2 rounded border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900"
            >
              <GitCompare className="h-4 w-4" />
              Compare JSON
            </button>
          </div>
        </section>

        <section className="border border-slate-800 bg-[#111418] p-4 shadow-2xl shadow-black/30">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3 text-xs text-slate-500">
            <span>workspace.json</span>
            <span>editor</span>
          </div>
          <pre className="overflow-auto text-sm leading-6 text-slate-300">
            <code>{`{
  "mode": "editor",
  "actions": ["format", "repair", "setKey", "removeKey"],
  "compare": {
    "enabled": "when needed",
    "views": ["tree", "list", "patch"]
  },
  "privacy": "browser-local"
}`}</code>
          </pre>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
