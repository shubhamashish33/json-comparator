import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TREE_PAGE_SIZE } from "../workbenchConfig";
import { collectTreeEntries, parsePath, formatPath, stringify, valueType } from "../workbenchOperations";

const TreeNode = ({
  nodeKey,
  value,
  path,
  level,
  selectedPath,
  selectedPaths,
  matches,
  onSelect,
  onContextMenu,
  activePath,
  onFocusPath,
}) => {
  const [open, setOpen] = useState(level < 2);
  const [visibleCount, setVisibleCount] = useState(TREE_PAGE_SIZE);
  const isContainer = value && typeof value === "object";
  const isArray = Array.isArray(value);
  const selected = selectedPath === path || selectedPaths.has(path);
  const matched = matches.has(path);
  const pathParts = parsePath(path);
  const selectedParts = parsePath(selectedPath);
  const isSelectedAncestor = selectedPath && selectedParts.length > pathParts.length && pathParts.every((part, index) => part === selectedParts[index]);
  const forcedKey = isSelectedAncestor ? selectedParts[pathParts.length] : null;
  // Selection changes should not rescan every key in each visible container.
  const { entries, childCount } = useMemo(
    () => collectTreeEntries(value, open ? visibleCount : 0, forcedKey),
    [value, open, visibleCount, forcedKey]
  );
  const preview = isContainer
    ? isArray ? `[${open ? "" : `${value.length} items`}]` : `{${open ? "" : `${childCount} keys`}}`
    : stringify(value, 0);

  useEffect(() => {
    if (isContainer && isSelectedAncestor) setOpen(true);
  }, [isContainer, isSelectedAncestor]);

  return (
    <div
        data-path={path}
        role="treeitem"
        tabIndex={activePath === path ? 0 : -1}
        aria-level={level + 1}
        aria-selected={selected}
        onFocus={event => { event.stopPropagation(); onFocusPath(path); }}
        aria-expanded={isContainer ? Boolean(open) : undefined}
        aria-label={`${path || "root"}: ${valueType(value)}`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const row = event.currentTarget;
          const rows = Array.from(row.closest('[role="tree"]').querySelectorAll('[role="treeitem"]'));
          const index = rows.indexOf(row);
          const focus = (target) => { target?.focus(); target?.scrollIntoView?.({ block: "nearest" }); };
          if (event.key === "ArrowDown") focus(rows[Math.min(index + 1, rows.length - 1)]);
          else if (event.key === "ArrowUp") focus(rows[Math.max(index - 1, 0)]);
          else if (event.key === "Home") focus(rows[0]);
          else if (event.key === "End") focus(rows[rows.length - 1]);
          else if (event.key === "ArrowRight") {
            if (isContainer && !open) setOpen(true);
            else if (rows[index + 1]?.getAttribute("aria-level") > level + 1) focus(rows[index + 1]);
          } else if (event.key === "ArrowLeft") {
            if (isContainer && open) setOpen(false);
            else focus(rows.slice(0, index).reverse().find(node => Number(node.getAttribute("aria-level")) === level));
          } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            const rect = row.firstElementChild.getBoundingClientRect();
            onSelect(path);
            onContextMenu(path, { preventDefault: () => event.preventDefault(), clientX: rect.left + 20, clientY: rect.bottom });
          } else if (event.key === "Enter" || event.key === " ") {
            onSelect(path, event);
            if (isContainer) setOpen(current => !current);
          } else return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onFocusPath(path);
          if (document.activeElement !== event.currentTarget) event.currentTarget.focus();
          onSelect(path, event);
          if (isContainer) setOpen((current) => !current);
        }}
        onContextMenu={(event) => { event.stopPropagation(); onContextMenu(path, event); }}
        className="text-sm">
      <div
        className={`group flex min-h-8 cursor-default items-center gap-2 px-2 py-1 hover:bg-slate-800 ${
          selected ? "bg-cyan-500/15 ring-1 ring-cyan-500" : matched ? "bg-yellow-500/10" : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <span className="w-4 text-slate-500">{isContainer ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : null}</span>
        <span className="text-blue-300">{String(nodeKey)}</span>
        <span className="text-slate-600">:</span>
        <span className={isContainer ? "text-cyan-300" : "break-all text-emerald-300"}>{preview}</span>
        <span className="ml-auto text-[10px] uppercase text-slate-600">{valueType(value)}</span>
      </div>
      <div role="group">{isContainer && open && entries.map(([key, child]) => (
        <TreeNode
          key={`${path}.${key}`}
          nodeKey={key}
          value={child}
          path={formatPath(path, key, isArray)}
          level={level + 1}
          selectedPath={selectedPath}
          selectedPaths={selectedPaths}
          matches={matches}
          onSelect={onSelect}
          activePath={activePath}
          onFocusPath={onFocusPath}
          onContextMenu={onContextMenu}
        />
      ))}
      {isContainer && open && childCount > visibleCount && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            setVisibleCount((current) => current + TREE_PAGE_SIZE);
          }}
          className="ml-8 mt-1 border border-slate-800 bg-[#101419] px-3 py-1.5 text-xs text-cyan-300 hover:bg-slate-900"
          style={{ marginLeft: `${(level + 1) * 16 + 8}px` }}
        >
          Show next {Math.min(TREE_PAGE_SIZE, childCount - visibleCount)} of {childCount}
        </button>
      )}
      </div>
    </div>
  );
};

export const TreeView = ({ value, selectedPath, selectedPaths, matches, onSelect, onContextMenu }) => {
  const treeRef = useRef(null);
  const [activePath, setActivePath] = useState("");
  useEffect(() => {
    if (!Array.from(treeRef.current?.querySelectorAll("[data-path]") || []).some(node => node.dataset.path === activePath)) setActivePath("");
  }, [value, activePath]);
  useEffect(() => {
    if (!selectedPath) return;
    const timer = window.setTimeout(() => {
      const nodes = treeRef.current?.querySelectorAll("[data-path]");
      const target = nodes ? Array.from(nodes).find((node) => node.dataset.path === selectedPath) : null;
      target?.scrollIntoView?.({ block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedPath]);

  if (value === null || value === undefined) return <div className="p-8 text-center text-sm text-slate-500">Paste or load JSON to start.</div>;
  return (
    <div ref={treeRef} role="tree" aria-label="JSON tree" className="h-full overflow-auto bg-[#0c0f13] p-2 font-mono">
      <TreeNode
        nodeKey="root"
        value={value}
        path=""
        level={0}
        selectedPath={selectedPath}
        selectedPaths={selectedPaths}
        matches={matches}
        onSelect={onSelect}
        activePath={activePath}
        onFocusPath={setActivePath}
        onContextMenu={onContextMenu}
      />
    </div>
  );
};

