import { Analytics } from "@vercel/analytics/react";
import Editor from "@monaco-editor/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileJson,
  GitCompare,
  Home,
  Link2,
  ListTree,
  Plus,
  Redo2,
  Search,
  Table2,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  applyDiffToLeft,
  compareJSONValues,
  getValueAtPath,
  parseJSONDetailed,
  repairJSONish,
  toJsonPatch,
  validateAgainstSchema,
} from "./jsonUtils";

const STORAGE_KEYS = {
  left: "json-comparator-json1",
  right: "json-comparator-json2",
  schema: "json-comparator-schema",
  settings: "json-comparator-settings",
};

const defaultSettings = {
  ignoreCase: false,
  ignoreKeyCase: false,
  stringNumberEquivalence: false,
  numberTolerance: 0,
  arrayMode: "index",
  arrayMatchKey: "id",
  ignorePaths: "",
  includePaths: "",
};

const sampleLeft = {
  id: "usr_001",
  profile: {
    name: "John Doe",
    email: "john@example.com",
    active: true,
  },
  roles: ["admin", "editor"],
  limits: {
    requestsPerMinute: 120,
    beta: false,
  },
  metadata: {
    requestId: "abc-1",
    updatedAt: "2026-01-01T10:00:00Z",
  },
};

const sampleRight = {
  id: "usr_001",
  profile: {
    name: "John Doe",
    email: "john.doe@example.com",
    active: true,
  },
  roles: ["admin", "editor", "reviewer"],
  limits: {
    requestsPerMinute: 240,
    beta: true,
  },
  metadata: {
    requestId: "abc-2",
    updatedAt: "2026-01-01T10:00:01Z",
  },
};

const TREE_PAGE_SIZE = 200;
const TEXT_ROW_LIMIT = 5000;
const TABLE_ROW_LIMIT = 1000;
const TABLE_COLUMN_SAMPLE = 250;
const SEARCH_RESULT_LIMIT = 500;
const PARSE_DEBOUNCE_MS = 350;

const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
};

const stringify = (value, spacing = 2) => {
  try {
    return JSON.stringify(value, null, spacing);
  } catch {
    return String(value);
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const parsePath = (path) => {
  if (!path) return [];
  return path.match(/[^.[\]]+/g) || [];
};

const formatPath = (base, key, parentIsArray = false) => {
  if (!base) return parentIsArray ? `[${key}]` : String(key);
  return parentIsArray ? `${base}[${key}]` : `${base}.${key}`;
};

const parentPathOf = (path) => {
  const parts = parsePath(path);
  parts.pop();
  return parts.reduce((current, part, index) => {
    const isIndex = /^\d+$/.test(part);
    if (index === 0) return isIndex ? `[${part}]` : part;
    return isIndex ? `${current}[${part}]` : `${current}.${part}`;
  }, "");
};

const keyOfPath = (path) => parsePath(path).at(-1) || "";

const setAtPath = (source, path, nextValue, nextKey) => {
  if (!path) return nextValue;
  const next = clone(source);
  const parts = parsePath(path);
  const last = parts.pop();
  const parent = parts.reduce((cursor, part) => cursor?.[part], next);
  if (!parent || last === undefined) return next;
  if (nextKey && !Array.isArray(parent) && nextKey !== last) {
    delete parent[last];
    parent[nextKey] = nextValue;
  } else {
    parent[last] = nextValue;
  }
  return next;
};

const addAtPath = (source, parentPath, key, value) => {
  const next = clone(source);
  const target = parentPath ? getValueAtPath(next, parentPath) : next;
  if (Array.isArray(target)) target.push(value);
  else if (target && typeof target === "object") target[key || `key_${Object.keys(target).length + 1}`] = value;
  return next;
};

const removeAtPath = (source, path) => {
  if (!path) return source;
  const next = clone(source);
  const parts = parsePath(path);
  const last = parts.pop();
  const parent = parts.reduce((cursor, part) => cursor?.[part], next);
  if (!parent || last === undefined) return next;
  if (Array.isArray(parent)) parent.splice(Number(last), 1);
  else delete parent[last];
  return next;
};

const duplicateAtPath = (source, path) => {
  const value = getValueAtPath(source, path);
  const parentPath = parentPathOf(path);
  const key = keyOfPath(path);
  const parent = parentPath ? getValueAtPath(source, parentPath) : source;
  if (Array.isArray(parent)) return addAtPath(source, parentPath, "", clone(value));
  return addAtPath(source, parentPath, `${key}_copy`, clone(value));
};

const sortKeysDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
};

const parseTypedValue = (raw, type) => {
  if (type === "string") return raw;
  if (type === "number") return Number(raw);
  if (type === "boolean") return raw === "true";
  if (type === "null") return null;
  if (type === "object" && !raw.trim()) return {};
  if (type === "array" && !raw.trim()) return [];
  const parsed = parseJSONDetailed(raw || "null");
  if (parsed.error) throw parsed.error;
  return parsed.value;
};

const valueType = (value) => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
};

const flattenRows = (value, path = "", limit = TEXT_ROW_LIMIT) => {
  const rows = [];
  const visit = (node, currentPath) => {
    if (rows.length >= limit) return;
    rows.push({ path: currentPath || "root", type: valueType(node), value: node });
    if (node && typeof node === "object") {
      const entries = Array.isArray(node)
        ? Array.from({ length: Math.min(node.length, limit - rows.length) }, (_, index) => [index, node[index]])
        : Object.keys(node).slice(0, Math.max(0, limit - rows.length)).map((key) => [key, node[key]]);
      entries.forEach(([key, child]) => {
        visit(child, formatPath(currentPath, key, Array.isArray(node)));
      });
    }
  };
  visit(value, path);
  return rows;
};

const collectTable = (value) => {
  if (!Array.isArray(value)) return { rows: [], columns: [] };
  const rows = [];
  const columns = new Set();
  for (let index = 0; index < value.length && rows.length < TABLE_ROW_LIMIT; index += 1) {
    const row = value[index];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    rows.push({ row, sourceIndex: index });
    if (rows.length <= TABLE_COLUMN_SAMPLE) Object.keys(row).forEach((key) => columns.add(key));
  }
  return { rows, columns: Array.from(columns), total: value.length, truncated: value.length > rows.length };
};

const limitedSearch = (value, term, limit = SEARCH_RESULT_LIMIT) => {
  if (!term || term.length < 2) return [];
  const lower = term.toLowerCase();
  const matches = [];
  const visit = (node, path) => {
    if (matches.length >= limit || node === null || node === undefined) return;
    if (typeof node !== "object") {
      if (String(node).toLowerCase().includes(lower)) matches.push(path || "root");
      return;
    }
    const keys = Array.isArray(node) ? Array.from({ length: node.length }, (_, index) => index) : Object.keys(node);
    for (const key of keys) {
      if (matches.length >= limit) break;
      const nextPath = formatPath(path, key, Array.isArray(node));
      if (String(key).toLowerCase().includes(lower)) matches.push(nextPath);
      visit(node[key], nextPath);
    }
  };
  visit(value, "");
  return matches;
};

const downloadText = (name, text, type = "application/json") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ErrorMessage = ({ error }) => {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 border border-red-900/70 bg-red-950/30 p-2 text-xs text-red-200">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{error.message}{error.line ? ` at ${error.line}:${error.column}` : ""}</span>
    </div>
  );
};

const ToolbarButton = ({ children, onClick, disabled, active, title }) => (
  <button
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex items-center gap-2 border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "border-cyan-500 bg-cyan-500 text-slate-950" : "border-slate-700 bg-[#101419] text-slate-200 hover:bg-slate-900"
    }`}
  >
    {children}
  </button>
);

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
}) => {
  const [open, setOpen] = useState(level < 2);
  const [visibleCount, setVisibleCount] = useState(TREE_PAGE_SIZE);
  const isContainer = value && typeof value === "object";
  const isArray = Array.isArray(value);
  const selected = selectedPath === path || selectedPaths.has(path);
  const matched = matches.has(path);
  const childCount = isContainer ? isArray ? value.length : Object.keys(value).length : 0;
  const entries = isContainer
    ? isArray
      ? Array.from({ length: Math.min(value.length, visibleCount) }, (_, index) => [index, value[index]])
      : Object.keys(value).slice(0, visibleCount).map((key) => [key, value[key]])
    : [];
  const preview = isContainer
    ? isArray ? `[${open ? "" : `${value.length} items`}]` : `{${open ? "" : `${childCount} keys`}}`
    : stringify(value, 0);

  return (
    <div className="text-sm">
      <div
        data-path={path}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(path, event);
          if (isContainer) setOpen((current) => !current);
        }}
        onContextMenu={(event) => onContextMenu(path, event)}
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
      {isContainer && open && entries.map(([key, child]) => (
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
  );
};

const TreeView = ({ value, selectedPath, selectedPaths, matches, onSelect, onContextMenu }) => {
  if (value === null || value === undefined) return <div className="p-8 text-center text-sm text-slate-500">Paste or load JSON to start.</div>;
  return (
    <div className="h-full overflow-auto bg-[#0c0f13] p-2">
      <TreeNode
        nodeKey="root"
        value={value}
        path=""
        level={0}
        selectedPath={selectedPath}
        selectedPaths={selectedPaths}
        matches={matches}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />
    </div>
  );
};

const NodeDialog = ({ mode, node, parentPath, onClose, onSave }) => {
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
      <div className="w-full max-w-xl border border-slate-700 bg-[#101419] p-5 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{mode === "add" ? "Add node" : "Edit node"}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <label className="text-xs uppercase text-slate-500">Key</label>
          <input value={key} onChange={(event) => setKey(event.target.value)} className="border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
          <label className="text-xs uppercase text-slate-500">Type</label>
          <select value={type} onChange={(event) => setType(event.target.value)} className="border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="null">Null</option>
            <option value="object">Object</option>
            <option value="array">Array</option>
          </select>
          <label className="text-xs uppercase text-slate-500">Value</label>
          <textarea
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

const JSONCompare = () => {
  const navigate = useNavigate();
  const leftFileRef = useRef(null);
  const rightFileRef = useRef(null);
  const [workspaceTab, setWorkspaceTab] = useState("editor");
  const [editorMode, setEditorMode] = useState("tree");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [schemaText, setSchemaText] = useState("");
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [query, setQuery] = useState("");
  const [transformCode, setTransformCode] = useState("return value;");
  const [queryResult, setQueryResult] = useState("");
  const [fetchUrl, setFetchUrl] = useState("");
  const [comparison, setComparison] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [copied, setCopied] = useState("");

  const debouncedLeftText = useDebounce(leftText, PARSE_DEBOUNCE_MS);
  const debouncedRightText = useDebounce(rightText, PARSE_DEBOUNCE_MS);
  const debouncedSchemaText = useDebounce(schemaText, PARSE_DEBOUNCE_MS);
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const leftParsed = useMemo(() => parseJSONDetailed(debouncedLeftText), [debouncedLeftText]);
  const rightParsed = useMemo(() => parseJSONDetailed(debouncedRightText), [debouncedRightText]);
  const schemaParsed = useMemo(() => parseJSONDetailed(debouncedSchemaText), [debouncedSchemaText]);
  const isParsingPending = leftText !== debouncedLeftText || rightText !== debouncedRightText || schemaText !== debouncedSchemaText;
  const matches = useMemo(() => new Set(leftParsed.value ? limitedSearch(leftParsed.value, debouncedSearchTerm) : []), [debouncedSearchTerm, leftParsed.value]);
  const flattened = useMemo(() => leftParsed.value === null ? [] : flattenRows(leftParsed.value), [leftParsed.value]);
  const selectedValue = useMemo(() => selectedPath ? getValueAtPath(leftParsed.value, selectedPath) : leftParsed.value, [leftParsed.value, selectedPath]);
  const selectedTable = useMemo(() => collectTable(selectedValue), [selectedValue]);
  const rootTable = useMemo(() => collectTable(leftParsed.value), [leftParsed.value]);
  const table = selectedTable.rows.length ? { ...selectedTable, path: selectedPath } : { ...rootTable, path: "" };
  const schemaErrors = useMemo(() => {
    if (!leftParsed.value || !schemaText.trim() || schemaParsed.error) return [];
    return validateAgainstSchema(leftParsed.value, schemaParsed.value);
  }, [leftParsed.value, schemaParsed.error, schemaParsed.value, schemaText]);
  const filteredComparison = useMemo(() => comparison.filter((diff) => filterType === "all" || diff.type === filterType), [comparison, filterType]);
  const patch = useMemo(() => toJsonPatch(comparison), [comparison]);

  useEffect(() => {
    try {
      setLeftText(localStorage.getItem(STORAGE_KEYS.left) || "");
      setRightText(localStorage.getItem(STORAGE_KEYS.right) || "");
      setSchemaText(localStorage.getItem(STORAGE_KEYS.schema) || "");
      setSettings({ ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}") });
    } catch {
      // Ignore corrupted local storage.
    }
  }, []);

  useEffect(() => {
    if (leftText) localStorage.setItem(STORAGE_KEYS.left, leftText);
    else localStorage.removeItem(STORAGE_KEYS.left);
    if (rightText) localStorage.setItem(STORAGE_KEYS.right, rightText);
    else localStorage.removeItem(STORAGE_KEYS.right);
    localStorage.setItem(STORAGE_KEYS.schema, schemaText);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [leftText, rightText, schemaText, settings]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, []);

  const commitValue = useCallback((nextValue) => {
    setHistory((current) => [leftText, ...current].slice(0, 80));
    setFuture([]);
    setLeftText(stringify(nextValue, 2));
  }, [leftText]);

  const undo = () => {
    const [previous, ...rest] = history;
    if (!previous) return;
    setFuture((current) => [leftText, ...current]);
    setLeftText(previous);
    setHistory(rest);
  };

  const redo = () => {
    const [next, ...rest] = future;
    if (!next) return;
    setHistory((current) => [leftText, ...current]);
    setLeftText(next);
    setFuture(rest);
  };

  const readFile = (event, target) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      if (target === "left") {
        setHistory((current) => [leftText, ...current].slice(0, 80));
        setLeftText(String(readerEvent.target.result || ""));
      } else {
        setRightText(String(readerEvent.target.result || ""));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const selectPath = (path, event) => {
    setSelectedPath(path);
    setContextMenu(null);
    setSelectedPaths((current) => {
      if (event?.ctrlKey || event?.metaKey || event?.shiftKey) {
        const next = new Set(current);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      }
      return new Set(path ? [path] : []);
    });
  };

  const openContext = (path, event) => {
    event.preventDefault();
    setSelectedPath(path);
    setSelectedPaths((current) => current.has(path) ? current : new Set(path ? [path] : []));
    setContextMenu({ path, x: event.clientX, y: event.clientY });
  };

  const editNode = (path = selectedPath) => {
    if (!leftParsed.value && leftParsed.value !== null) return;
    const value = path ? getValueAtPath(leftParsed.value, path) : leftParsed.value;
    setDialog({
      mode: "edit",
      path,
      parentPath: parentPathOf(path),
      node: {
        key: keyOfPath(path) || "root",
        type: valueType(value),
        raw: valueType(value) === "string" ? value : stringify(value, 2),
      },
    });
    setContextMenu(null);
  };

  const addNode = (parentPath = selectedPath) => {
    setDialog({
      mode: "add",
      parentPath,
      node: { key: "", type: "string", raw: "" },
    });
    setContextMenu(null);
  };

  const removePaths = (paths) => {
    if (!leftParsed.value) return;
    const next = [...paths].sort((a, b) => b.length - a.length).reduce((current, path) => removeAtPath(current, path), leftParsed.value);
    commitValue(next);
    setSelectedPath("");
    setSelectedPaths(new Set());
    setContextMenu(null);
  };

  const saveDialog = ({ key, value, parentPath }) => {
    if (dialog.mode === "add") {
      commitValue(addAtPath(leftParsed.value || {}, parentPath, key, value));
    } else {
      commitValue(setAtPath(leftParsed.value, dialog.path, value, key));
      setSelectedPath(parentPath ? formatPath(parentPath, key, Array.isArray(getValueAtPath(leftParsed.value, parentPath))) : key);
    }
    setDialog(null);
  };

  const runCompare = () => {
    if (leftParsed.error || rightParsed.error || leftParsed.value === null || rightParsed.value === null) return;
    setComparison(compareJSONValues(leftParsed.value, rightParsed.value, settings));
    setWorkspaceTab("compare");
  };

  const fetchRemote = async () => {
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      commitValue(json);
      setFetchUrl("");
    } catch (error) {
      setQueryResult(`Fetch failed: ${error.message}`);
    }
  };

  const runQuery = () => {
    if (leftParsed.error) return;
    try {
      const value = query.trim() ? getValueAtPath(leftParsed.value, query.trim()) : leftParsed.value;
      setQueryResult(stringify(value, 2));
    } catch (error) {
      setQueryResult(error.message);
    }
  };

  const runTransform = () => {
    if (leftParsed.error) return;
    try {
      // eslint-disable-next-line no-new-func
      const transform = new Function("value", "clone", transformCode);
      const result = transform(clone(leftParsed.value), clone);
      setQueryResult(stringify(result, 2));
    } catch (error) {
      setQueryResult(`Transform failed: ${error.message}`);
    }
  };

  const copyText = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 1200);
  };

  const modeButtons = [
    ["tree", "Tree", ListTree],
    ["code", "Code", Code2],
    ["text", "Text", FileJson],
    ["table", "Table", Table2],
  ];

  return (
    <div className="min-h-screen bg-[#0b0d10] font-mono text-slate-200 selection:bg-cyan-500/20">
      <Analytics />
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-[#0b0d10]/95">
        <div className="mx-auto flex h-14 max-w-[120rem] items-center justify-between px-4">
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-white">
            <GitCompare className="h-5 w-5 text-cyan-400" />
            JSONSync
          </button>
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900">
            <Home className="h-4 w-4" /> Home
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[120rem] px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {["editor", "compare", "query", "schema"].map((tab) => (
            <ToolbarButton key={tab} active={workspaceTab === tab} onClick={() => setWorkspaceTab(tab)}>
              {tab}
            </ToolbarButton>
          ))}
          <span className="mx-2 h-6 border-l border-slate-800" />
          <ToolbarButton onClick={() => { setLeftText(stringify(sampleLeft, 2)); setRightText(stringify(sampleRight, 2)); }}>Sample</ToolbarButton>
          <ToolbarButton onClick={() => leftFileRef.current?.click()}><Upload className="h-4 w-4" />Import</ToolbarButton>
          <ToolbarButton onClick={() => downloadText("data.json", leftText || "null")}><Download className="h-4 w-4" />Export</ToolbarButton>
          <ToolbarButton onClick={() => copyText(leftText, "left")}><Copy className="h-4 w-4" />{copied === "left" ? "Copied" : "Copy"}</ToolbarButton>
          <ToolbarButton onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton onClick={() => leftParsed.value !== null && commitValue(sortKeysDeep(leftParsed.value))}>Sort keys</ToolbarButton>
          <ToolbarButton onClick={() => setLeftText(repairJSONish(leftText))}><Wand2 className="h-4 w-4" />Repair</ToolbarButton>
          <ToolbarButton onClick={() => !leftParsed.error && setLeftText(stringify(leftParsed.value, 0))}>Compact</ToolbarButton>
          <ToolbarButton onClick={() => !leftParsed.error && setLeftText(stringify(leftParsed.value, 2))}>Format</ToolbarButton>
          <ToolbarButton onClick={runCompare} active><GitCompare className="h-4 w-4" />Compare</ToolbarButton>
          <input ref={leftFileRef} type="file" accept=".json,.jsonc,.txt" className="hidden" onChange={(event) => readFile(event, "left")} />
          <input ref={rightFileRef} type="file" accept=".json,.jsonc,.txt" className="hidden" onChange={(event) => readFile(event, "right")} />
        </div>

        <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 items-center border border-slate-800 bg-[#101419] px-3 py-2 text-xs">
            <span className="text-slate-500">path</span>
            <code className="ml-3 truncate text-cyan-300">{selectedPath || "root"}</code>
            <span className="ml-3 text-slate-500">{selectedPaths.size ? `${selectedPaths.size} selected` : ""}</span>
          </div>
          <div className="flex gap-2">
            <ToolbarButton onClick={() => addNode(selectedPath)}><Plus className="h-4 w-4" />Add</ToolbarButton>
            <ToolbarButton onClick={() => editNode(selectedPath)} disabled={leftParsed.error || leftParsed.value === null}>Edit</ToolbarButton>
            <ToolbarButton onClick={() => removePaths(selectedPaths.size ? selectedPaths : new Set([selectedPath]))} disabled={!selectedPath && !selectedPaths.size}><Trash2 className="h-4 w-4" />Remove</ToolbarButton>
          </div>
        </div>

        {workspaceTab === "editor" && (
          <section className="grid min-h-[calc(100vh-13rem)] gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border border-slate-800 bg-[#101419] p-3">
              <div className="mb-3 flex border border-slate-800 bg-[#0b0d10] p-1">
                {modeButtons.map(([mode, label, Icon]) => (
                  <button key={mode} onClick={() => setEditorMode(mode)} className={`flex-1 px-2 py-1.5 text-xs ${editorMode === mode ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-slate-900"}`}>
                    <Icon className="mx-auto h-4 w-4" />
                    <span className="mt-1 block">{label}</span>
                  </button>
                ))}
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search tree" className="w-full border border-slate-700 bg-[#0b0d10] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-500" />
              </div>
              <div className="space-y-2 text-xs text-slate-400">
                {isParsingPending && <div className="border border-cyan-900 p-2 text-cyan-200">Parsing after input settles...</div>}
                <div className="border border-slate-800 p-2">Click selects and shows path. Ctrl/Cmd/Shift click toggles multi-select.</div>
                <div className="border border-slate-800 p-2">Right-click any node for add, edit, duplicate, copy, and remove actions.</div>
                <div className={`border p-2 ${leftParsed.error ? "border-red-900 text-red-200" : "border-emerald-900 text-emerald-200"}`}>{leftParsed.error ? "Invalid JSON" : `${flattened.length}${flattened.length >= TEXT_ROW_LIMIT ? "+" : ""} projected nodes`}</div>
                {debouncedSearchTerm.length === 1 && <div className="border border-yellow-900 p-2 text-yellow-200">Search starts after 2 characters.</div>}
                {matches.size >= SEARCH_RESULT_LIMIT && <div className="border border-yellow-900 p-2 text-yellow-200">Showing first {SEARCH_RESULT_LIMIT} search matches.</div>}
              </div>
            </aside>

            <div className="min-w-0 border border-slate-800 bg-[#101419]">
              {leftParsed.error && <div className="p-3"><ErrorMessage error={leftParsed.error} /></div>}
              {editorMode === "tree" && !leftParsed.error && (
                <TreeView value={leftParsed.value} selectedPath={selectedPath} selectedPaths={selectedPaths} matches={matches} onSelect={selectPath} onContextMenu={openContext} />
              )}
              {editorMode === "code" && (
                <Editor
                  height="calc(100vh - 14rem)"
                  defaultLanguage="json"
                  theme="vs-dark"
                  value={leftText}
                  onChange={(value) => setLeftText(value || "")}
                  options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false }}
                />
              )}
              {editorMode === "text" && (
                <div className="h-[calc(100vh-14rem)] overflow-auto p-3">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#101419] text-slate-500">
                      <tr><th className="border-b border-slate-800 py-2">Path</th><th className="border-b border-slate-800 py-2">Type</th><th className="border-b border-slate-800 py-2">Value</th></tr>
                    </thead>
                    <tbody>
                      {flattened.map((row) => (
                        <tr
                          key={row.path}
                          onClick={(event) => selectPath(row.path === "root" ? "" : row.path, event)}
                          onDoubleClick={() => editNode(row.path === "root" ? "" : row.path)}
                          onContextMenu={(event) => openContext(row.path === "root" ? "" : row.path, event)}
                          className="cursor-default hover:bg-slate-900"
                        >
                          <td className="border-b border-slate-900 py-2 pr-3 text-cyan-300">{row.path}</td>
                          <td className="border-b border-slate-900 py-2 pr-3 text-slate-500">{row.type}</td>
                          <td className="max-w-xl truncate border-b border-slate-900 py-2 text-slate-300">{typeof row.value === "object" ? stringify(row.value, 0) : String(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editorMode === "table" && (
                <div className="h-[calc(100vh-14rem)] overflow-auto p-3">
                  {table.rows.length ? (
                    <>
                      <div className="mb-3 border border-slate-800 bg-[#0b0d10] px-3 py-2 text-xs text-slate-400">
                        Table source: <code className="text-cyan-300">{table.path || "root"}</code>
                        {table.truncated && <span className="ml-3 text-yellow-300">Showing first {table.rows.length} object rows from {table.total} items.</span>}
                      </div>
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-[#101419] text-slate-500">
                          <tr><th className="border-b border-slate-800 py-2">#</th>{table.columns.map((column) => <th key={column} className="border-b border-slate-800 px-2 py-2">{column}</th>)}</tr>
                        </thead>
                        <tbody>
                          {table.rows.map(({ row, sourceIndex }) => (
                            <tr key={sourceIndex} className="hover:bg-slate-900">
                              <td className="border-b border-slate-900 py-2 text-slate-500">{sourceIndex}</td>
                              {table.columns.map((column) => {
                                const rowPath = table.path ? `${table.path}[${sourceIndex}]` : `[${sourceIndex}]`;
                                const cellPath = `${rowPath}.${column}`;
                                return (
                                  <td
                                    key={column}
                                    onClick={(event) => selectPath(cellPath, event)}
                                    onDoubleClick={() => editNode(cellPath)}
                                    onContextMenu={(event) => openContext(cellPath, event)}
                                    className="cursor-default border-b border-slate-900 px-2 py-2 text-slate-300"
                                  >
                                    {stringify(row[column], 0)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-500">
                      Select an array of objects in Tree mode, then open Table mode. Top-level arrays of objects also render automatically.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {workspaceTab === "query" && (
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3 border border-slate-800 bg-[#101419] p-4">
              <h2 className="text-sm font-semibold text-white">Query and transform</h2>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Path query, e.g. profile.email or roles[0]" className="w-full border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
              <ToolbarButton onClick={runQuery}><Search className="h-4 w-4" />Run query</ToolbarButton>
              <textarea value={transformCode} onChange={(event) => setTransformCode(event.target.value)} rows={10} className="w-full border border-slate-700 bg-[#0b0d10] p-3 text-sm text-white outline-none focus:border-cyan-500" />
              <div className="flex gap-2">
                <ToolbarButton onClick={runTransform}><Wand2 className="h-4 w-4" />Preview transform</ToolbarButton>
                <ToolbarButton onClick={() => { const parsed = parseJSONDetailed(queryResult); if (!parsed.error) commitValue(parsed.value); }}>Apply result</ToolbarButton>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input value={fetchUrl} onChange={(event) => setFetchUrl(event.target.value)} placeholder="https://api.example.com/data" className="border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                <ToolbarButton onClick={fetchRemote}><Link2 className="h-4 w-4" />Fetch</ToolbarButton>
              </div>
            </div>
            <pre className="min-h-[32rem] overflow-auto border border-slate-800 bg-[#0c0f13] p-4 text-sm text-slate-200">{queryResult}</pre>
          </section>
        )}

        {workspaceTab === "schema" && (
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="border border-slate-800 bg-[#101419] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">JSON Schema</h2>
              <Editor height="32rem" defaultLanguage="json" theme="vs-dark" value={schemaText} onChange={(value) => setSchemaText(value || "")} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }} />
              {schemaParsed.error && <div className="mt-3"><ErrorMessage error={schemaParsed.error} /></div>}
            </div>
            <div className="border border-slate-800 bg-[#101419] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Validation</h2>
              {!schemaErrors.length ? <div className="text-sm text-emerald-300">No schema issues found.</div> : schemaErrors.map((error, index) => (
                <div key={`${error.path}-${index}`} className="mb-2 border border-red-900/70 bg-red-950/20 p-2 text-xs text-red-200"><code>{error.path}</code> {error.message}</div>
              ))}
            </div>
          </section>
        )}

        {workspaceTab === "compare" && (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="border border-slate-800 bg-[#101419]">
              <div className="flex items-center justify-between border-b border-slate-800 p-3">
                <h2 className="text-sm font-semibold text-white">Left JSON</h2>
                <ToolbarButton onClick={() => leftFileRef.current?.click()}><Upload className="h-4 w-4" /></ToolbarButton>
              </div>
              <Editor height="34rem" defaultLanguage="json" theme="vs-dark" value={leftText} onChange={(value) => setLeftText(value || "")} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }} />
            </div>
            <div className="border border-slate-800 bg-[#101419]">
              <div className="flex items-center justify-between border-b border-slate-800 p-3">
                <h2 className="text-sm font-semibold text-white">Right JSON</h2>
                <div className="flex gap-2">
                  <ToolbarButton onClick={() => rightFileRef.current?.click()}><Upload className="h-4 w-4" /></ToolbarButton>
                  <ToolbarButton onClick={() => { setLeftText(rightText); setRightText(leftText); }}><ArrowLeftRight className="h-4 w-4" /></ToolbarButton>
                </div>
              </div>
              <Editor height="34rem" defaultLanguage="json" theme="vs-dark" value={rightText} onChange={(value) => setRightText(value || "")} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }} />
            </div>
            <div className="xl:col-span-2 border border-slate-800 bg-[#101419] p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ToolbarButton onClick={runCompare} active><GitCompare className="h-4 w-4" />Compare</ToolbarButton>
                <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="border border-slate-700 bg-[#0b0d10] px-3 py-2 text-xs text-white">
                  <option value="all">All</option>
                  <option value="added">Added</option>
                  <option value="removed">Removed</option>
                  <option value="modified">Modified</option>
                </select>
                <ToolbarButton onClick={() => downloadText("json-patch.json", stringify(patch, 2))}>Patch</ToolbarButton>
                <ToolbarButton onClick={() => leftParsed.value && downloadText("merged-output.json", stringify(applyDiffToLeft(leftParsed.value, comparison), 2))}>Merged</ToolbarButton>
              </div>
              {!comparison.length ? <div className="p-6 text-center text-sm text-slate-500">No differences yet, or the documents match.</div> : (
                <div className="max-h-[28rem] overflow-auto">
                  {filteredComparison.map((diff, index) => (
                    <div key={`${diff.path}-${index}`} className="mb-2 border border-slate-800 bg-[#0c0f13] p-3 text-xs">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`px-2 py-1 uppercase ${diff.type === "added" ? "bg-emerald-950 text-emerald-200" : diff.type === "removed" ? "bg-red-950 text-red-200" : "bg-yellow-950 text-yellow-200"}`}>{diff.type}</span>
                        <code className="text-cyan-300">{diff.path}</code>
                      </div>
                      <pre className="overflow-auto text-slate-300">{stringify(diff.type === "modified" ? { old: diff.oldValue, next: diff.newValue } : diff.value, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {contextMenu && (
        <div className="fixed z-[60] w-56 border border-slate-700 bg-[#101419] p-1 text-xs shadow-2xl shadow-black/40" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => addNode(contextMenu.path)} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800">Add child</button>
          <button onClick={() => editNode(contextMenu.path)} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800">Edit node</button>
          <button onClick={() => { commitValue(duplicateAtPath(leftParsed.value, contextMenu.path)); setContextMenu(null); }} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800">Duplicate node</button>
          <button onClick={() => copyText(contextMenu.path || "root", "path")} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800">{copied === "path" ? "Copied path" : "Copy path"}</button>
          <button onClick={() => copyText(stringify(getValueAtPath(leftParsed.value, contextMenu.path), 2), "value")} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800">{copied === "value" ? "Copied value" : "Copy value"}</button>
          <button onClick={() => removePaths(selectedPaths.size ? selectedPaths : new Set([contextMenu.path]))} className="block w-full px-3 py-2 text-left text-red-200 hover:bg-red-950/50">Remove selected</button>
        </div>
      )}

      {dialog && <NodeDialog mode={dialog.mode} node={dialog.node} parentPath={dialog.parentPath} onClose={() => setDialog(null)} onSave={saveDialog} />}
    </div>
  );
};

export default JSONCompare;
