import React, { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../workbenchConfig";
import { builtInPresets, normalizeComparisonSettings, readComparisonPresets } from "../comparisonPresets";

export function ComparisonPresets({ settings, onChange, remember }) {
  const [presets, setPresets] = useState(() => remember ? readComparisonPresets(STORAGE_KEYS.presets) : []);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!remember) return;
    try { localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets)); }
    catch { setNotice("Presets are available for this session, but browser storage could not save them."); }
  }, [presets, remember]);
  const update = (key, value) => onChange(normalizeComparisonSettings({ ...settings, [key]: value }));
  const save = event => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (presets.length >= 20 && !presets.some(preset => preset.name === trimmed)) { setNotice("You can keep up to 20 presets. Remove one or reuse its name."); return; }
    setPresets(current => [...current.filter(preset => preset.name !== trimmed), { name: trimmed, settings: normalizeComparisonSettings(settings) }]);
    setName("");
    setNotice(remember ? "Preset saved. Reusing a name replaces that preset." : "Preset kept for this session only.");
  };
  return <section aria-label="Comparison settings and presets" className="rounded-lg border border-slate-800 bg-[#101419] p-3 text-xs xl:col-span-2">
    <div className="flex flex-wrap items-center gap-2"><span className="mr-1 font-medium text-slate-200">Comparison presets</span>{builtInPresets.map(preset => <button type="button" key={preset.name} onClick={() => onChange({ ...preset.settings })} className="rounded border border-slate-700 px-3 py-2 text-slate-300 hover:border-cyan-700">{preset.name}</button>)}</div>
    <details className="mt-3"><summary className="cursor-pointer text-cyan-300">Customize rules & save a preset</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-slate-400">Array comparison<select value={settings.arrayMode} onChange={event => update("arrayMode", event.target.value)} className="rounded border border-slate-700 bg-[#0b0d10] p-2 text-slate-200"><option value="index">By position</option><option value="ignore-order">Ignore order</option><option value="match-key">Match by key</option></select></label>
        <label className="grid gap-1 text-slate-400">Record match key<input value={settings.arrayMatchKey} disabled={settings.arrayMode !== "match-key"} onChange={event => update("arrayMatchKey", event.target.value)} className="rounded border border-slate-700 bg-[#0b0d10] p-2 text-slate-200 disabled:opacity-40" /></label>
        <label className="grid gap-1 text-slate-400">Numeric tolerance<input type="number" min="0" step="any" value={settings.numberTolerance} onChange={event => update("numberTolerance", Number(event.target.value))} className="rounded border border-slate-700 bg-[#0b0d10] p-2 text-slate-200" /></label>
        <label className="grid gap-1 text-slate-400">Ignore paths (comma separated)<input value={settings.ignorePaths} onChange={event => update("ignorePaths", event.target.value)} placeholder="metadata.updatedAt" className="rounded border border-slate-700 bg-[#0b0d10] p-2 text-slate-200" /></label>
        <label className="grid gap-1 text-slate-400">Include paths (comma separated)<input value={settings.includePaths} onChange={event => update("includePaths", event.target.value)} className="rounded border border-slate-700 bg-[#0b0d10] p-2 text-slate-200" /></label>
        <div className="grid gap-2">{[["ignoreCase", "Ignore string case"], ["ignoreKeyCase", "Ignore key case"], ["stringNumberEquivalence", "Treat numeric strings as numbers"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={settings[key]} onChange={event => update(key, event.target.checked)} />{label}</label>)}</div>
      </div>
      <form onSubmit={save} className="mt-4 flex flex-wrap gap-2"><input aria-label="Preset name" maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Name these rules" className="min-w-0 rounded border border-slate-700 bg-[#0b0d10] p-2 text-slate-200" /><button disabled={!name.trim()} className="rounded border border-slate-700 px-3 py-2 text-cyan-200 disabled:opacity-40">Save current rules</button></form>
      {presets.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{presets.map(preset => <li key={preset.name} className="flex rounded border border-slate-700"><button type="button" onClick={() => onChange({ ...preset.settings })} className="px-3 py-2 text-slate-200">Apply {preset.name}</button><button type="button" aria-label={`Delete preset ${preset.name}`} onClick={() => setPresets(current => current.filter(item => item.name !== preset.name))} className="border-l border-slate-700 px-2 text-slate-400">×</button></li>)}</ul>}
      <p className="mt-2 text-slate-500">{remember ? "Saved in this browser; cleared with workspace storage." : "Memory-only mode: presets disappear after refresh."} Changing rules clears previous comparison results.</p>
      {notice && <p role="status" className="mt-2 text-slate-300">{notice}</p>}
    </details>
  </section>;
}
