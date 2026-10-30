import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useDialogFocus } from "../hooks/useDialogFocus";

export function filterPaletteItems(items, query) {
  const group = { ">": "Commands", "@": "Documents", "#": "JSON" }[query.trim()[0]];
  const words = (group ? query.trim().slice(1) : query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (!group || item.group === group) && words.every(word =>
    `${item.label} ${item.description || ""} ${item.keywords || ""}`.toLowerCase().includes(word)
  )).slice(0, 80);
}

export function CommandPalette({ items, onClose, jsonNotice }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useDialogFocus(onClose);
  const listRef = useRef(null);
  const results = useMemo(() => filterPaletteItems(items, query), [items, query]);
  const current = Math.min(active, Math.max(0, results.length - 1));
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [current]);
  const execute = item => {
    if (!item || item.disabled) return;
    onClose();
    item.run();
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search everything" className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-600 bg-[#101419] shadow-2xl" onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setActive(current => results.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);
        } else if (event.key === "Enter" && event.target.tagName === "INPUT") {
          event.preventDefault(); execute(results[current]);
        }
      }}>
        <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-cyan-400" />
          <input role="combobox" aria-label="Search commands, documents, and JSON" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={results.length ? `palette-option-${current}` : undefined} aria-autocomplete="list" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search commands, documents, and JSON..." className="palette-search-input min-w-0 flex-1 rounded-sm bg-transparent py-2 text-sm text-white outline-none" />
          <button aria-label="Close search" onClick={onClose} className="rounded p-2 text-slate-400 focus:ring-2 focus:ring-cyan-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-4 border-b border-slate-800 px-4 py-2 text-xs text-slate-400"><span>&gt; Commands</span><span>@ Documents</span><span># JSON</span></div>
        <div ref={listRef} id="palette-results" role="listbox" aria-label="Search results" className="max-h-[48vh] overflow-y-auto p-2">
          {!results.length && <p className="p-8 text-center text-sm text-slate-400">No matches. Try a command, document, key, or value.</p>}
          {results.map((item, index) => <React.Fragment key={item.id}>
            {(index === 0 || results[index - 1].group !== item.group) && <div role="presentation" className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{item.group}</div>}
            <div role="option" id={`palette-option-${index}`} aria-selected={index === current} aria-disabled={Boolean(item.disabled)} data-index={index} onMouseMove={() => setActive(index)} onClick={() => execute(item)} className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 ${index === current ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-inset ring-cyan-700" : "text-slate-200"} ${item.disabled ? "opacity-40" : ""}`}>
              <div className="min-w-0 flex-1"><div className="truncate text-sm">{item.label}</div>{item.description && <div className="truncate text-xs text-slate-500">{item.description}</div>}</div>
              {item.shortcut && <kbd className="shrink-0 rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-400">{item.shortcut}</kbd>}
            </div>
          </React.Fragment>)}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500"><span>Up/Down navigate · Enter run · Esc close</span><span>{jsonNotice || `${results.length}${results.length === 80 ? "+" : ""} results`}</span></div>
      </section>
    </div>
  );
}
