import React from "react";
import { Link } from "react-router-dom";
import { WorkflowDemo } from "./components/WorkflowDemo";
import { ArrowRight, Braces, Github, GitCompare, HelpCircle, Lock, TerminalSquare } from "lucide-react";

const HomePage = () => {


  return (
    <div className="min-h-screen bg-[#0b0d10] font-sans text-slate-200 selection:bg-cyan-500/20">
      <header className="border-b border-slate-800 bg-[#0b0d10]/95">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/compare" className="flex items-center gap-2 text-left">
            <TerminalSquare className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-semibold uppercase text-slate-100">JSONEditor</span>
          </Link>
          <div className="flex gap-2">
            <a
              href="https://github.com/shubhamashish33/json-comparator"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
              aria-label="View JSONEditor source on GitHub"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link
              to="/help"
              className="inline-flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
            >
              <HelpCircle className="h-4 w-4" />
              Help
            </Link>
            <Link
              to="/compare"
              className="inline-flex items-center gap-2 rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/15"
            >
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            local-first JSON tooling
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
            Compare API responses. Share sanitized JSON.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Match records by ID, ignore noisy fields, and spot the changes that matter. Remove credentials before sharing examples—all with document processing in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/compare"
              className="inline-flex items-center gap-2 rounded border border-cyan-500/50 bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Braces className="h-4 w-4" />
              Start editing
            </Link>
            <Link
              to="/compare?tab=compare"
              className="inline-flex items-center gap-2 rounded border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900"
            >
              <GitCompare className="h-4 w-4" />
              Compare JSON
            </Link>
          </div>
        <div className="mt-10 grid grid-cols-3 gap-4 border-t border-slate-800 pt-6 text-xs leading-5 text-slate-400">
            <div><span className="block font-semibold text-slate-200">Explore</span>Code, tree & table views</div>
            <div><span className="block font-semibold text-slate-200">Compare</span>Structural & text diffs</div>
            <div><span className="block font-semibold text-slate-200">Sanitize</span>Redact sensitive values</div>
          </div>
        </section>

        <WorkflowDemo />
      </main>
    </div>
  );
};

export default HomePage;
