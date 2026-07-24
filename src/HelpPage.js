import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Braces, FileSearch, Github, GitCompare, ListTree, ShieldCheck, Table2, Wand2 } from "lucide-react";

const HelpSection = ({ icon: Icon, title, children }) => (
  <section className="border border-slate-800 bg-[#101419] p-5">
    <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-3">
      <Icon className="h-5 w-5 text-cyan-400" />
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
    <div className="space-y-4 text-sm leading-6 text-slate-300">{children}</div>
  </section>
);

const CodeBlock = ({ children }) => (
  <pre className="overflow-auto border border-slate-800 bg-[#080a0d] p-3 text-xs leading-5 text-slate-200">
    <code>{children}</code>
  </pre>
);

const HelpPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b0d10] font-mono text-slate-200 selection:bg-cyan-500/20">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0b0d10]/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate("/compare")} className="flex items-center gap-2 text-left">
            <Braces className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-semibold uppercase text-slate-100">JSONEditor Help</span>
          </button>
          <div className="flex gap-2">
            <a
              href="https://github.com/shubhamashish33/json-comparator"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900"
              aria-label="View JSONEditor source on GitHub"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Home
            </button>
            <button onClick={() => navigate("/compare")} className="inline-flex items-center gap-2 border border-cyan-500 bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400">
              Open workspace
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="mb-6 border border-slate-800 bg-[#101419] p-5">
          <div className="mb-2 text-xs uppercase text-cyan-300">Quick guide</div>
          <h1 className="text-3xl font-semibold text-white">Use JSONEditor without guessing.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Editor and Compare are direct workflows. This page focuses on Table and Query because those features are more powerful once the expected input shape is clear.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <HelpSection icon={Table2} title="Table Mode">
            <p>Table mode is for arrays of objects. It can render a root array, or a nested array selected from the Tree view.</p>
            <CodeBlock>{`{
  "users": [
    { "id": 1, "name": "Ada", "active": true },
    { "id": 2, "name": "Linus", "active": false }
  ]
}`}</CodeBlock>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Open Editor and keep Tree mode selected.</li>
              <li>Click the `users` node.</li>
              <li>Switch to Table mode.</li>
              <li>Click or right-click cells to select, edit, or act on nested values.</li>
            </ol>
            <p className="text-slate-500">Large tables are capped for responsiveness: rows are limited and columns are sampled from early object rows.</p>
          </HelpSection>

          <HelpSection icon={FileSearch} title="Query">
            <p>Query reads a value from the current left JSON by path. It is useful when the document is large and you already know the field path.</p>
            <CodeBlock>{`profile.email
users[0].name
data.items[10].id`}</CodeBlock>
            <p>Transforms run local JavaScript against a cloned JSON value. Use this for quick cleanup or filtering before applying the result back to the editor.</p>
            <CodeBlock>{`value.users = value.users.filter((user) => user.active);
return value;`}</CodeBlock>
            <p className="text-slate-500">Transforms are local to your browser, but they are still code you author and run intentionally.</p>
          </HelpSection>

          <HelpSection icon={GitCompare} title="Compare">
            <p>Compare mode has two views: Text and Tree.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Use Text mode to paste or edit left and right JSON with Monaco editors.</li>
              <li>Click Compare.</li>
              <li>The workspace switches to Tree mode automatically.</li>
              <li>Use Prev and Next from the sticky compare bar to move through changes.</li>
            </ol>
            <p>Diff paths are highlighted in both trees, and the active diff panel shows the focused left/right value preview.</p>
          </HelpSection>

          <HelpSection icon={ShieldCheck} title="Secret Redaction">
            <p>Redact is a self-contained workflow for producing JSON that is safe to share. Detection and replacement happen locally in the browser.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Paste JSON into the Source JSON editor, import a file, or load the example.</li>
              <li>Click `Redact secrets`.</li>
              <li>Review the Safe JSON output and the paths that changed.</li>
              <li>Copy or download the result. Use `Replace source` only when you want to keep editing the sanitized document.</li>
            </ol>
            <ul className="list-disc space-y-2 pl-5">
              <li>Common keys such as `password`, `apiKey`, `clientSecret`, and `accessToken` are detected automatically.</li>
              <li>Key matching ignores case, underscores, and dashes.</li>
              <li>You can add project-specific key names such as `pin` or `signingKey`.</li>
              <li>Optional value detection recognizes authorization headers, JWTs, AWS and GitHub tokens, private keys, and credential URLs.</li>
            </ul>
            <p>The detection list shows paths and reasons only. It does not repeat the original secret values.</p>
            <p className="text-slate-500">Advanced rules are collapsed by default. Replacing the source uses the normal history flow, so the change can be undone.</p>
          </HelpSection>

          <HelpSection icon={ListTree} title="Large JSON Tips">
            <ul className="list-disc space-y-2 pl-5">
              <li>Use Tree mode for inspection because child nodes are paged.</li>
              <li>Use search results in the sidebar, then press Enter to jump between matches.</li>
              <li>Use the fixed scroll-to-top button after deep tree navigation.</li>
              <li>Large documents stay in memory only and are not restored from localStorage.</li>
            </ul>
          </HelpSection>

          <HelpSection icon={Wand2} title="Repair, Format, Compact">
            <p>Repair handles common JSON-ish input such as comments, trailing commas, unquoted keys, and single-quoted strings.</p>
            <p>Format expands valid JSON with indentation. Compact removes whitespace for smaller exports.</p>
            <p className="text-slate-500">For invalid JSON, check the parse error location before comparing or validating.</p>
          </HelpSection>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;
