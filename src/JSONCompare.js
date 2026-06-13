import { Analytics } from "@vercel/analytics/react";
import Editor from "@monaco-editor/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Eraser,
  FileJson,
  GitCompare,
  HelpCircle,
  Home,
  Link2,
  ListTree,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  applyDiffToLeft,
  getValueAtPath,
  parseJSONDetailed,
  redactSecrets,
  repairJSONish,
  toJsonPatch,
} from "./jsonUtils";

const STORAGE_KEYS = {
  left: "json-comparator-json1",
  right: "json-comparator-json2",
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

const redactionSample = {
  user: {
    email: "john@example.com",
    password: "correct-horse-battery-staple",
  },
  apiKey: "service-key-value",
  headers: {
    authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
  },
  databaseUrl: "postgres://app:database-password@db.example.com/app",
  metadata: {
    requestId: "req_123",
  },
};

const TREE_PAGE_SIZE = 200;
const TABLE_ROW_LIMIT = 1000;
const TABLE_COLUMN_SAMPLE = 250;
const SEARCH_RESULT_LIMIT = 500;
const PARSE_DEBOUNCE_MS = 350;
const STORAGE_TEXT_LIMIT = 750_000;
const HISTORY_TEXT_LIMIT = 1_000_000;
const WORKER_TIMEOUT_MS = 15000;
const EMPTY_WORKER_PARSE = {
  value: null,
  error: null,
  index: { rows: [], visited: 0, truncated: false },
  status: "idle",
  label: "Idle",
  progress: 0,
};

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

const emptyValueFor = (value) => {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return {};
  if (typeof value === "string") return "";
  return null;
};

const clearValuesAtPaths = (source, paths) => {
  const next = clone(source);
  [...paths].filter(Boolean).forEach((path) => {
    const parts = parsePath(path);
    const last = parts.pop();
    const parent = parts.reduce((cursor, part) => cursor?.[part], next);
    if (!parent || last === undefined || !(last in parent)) return;
    parent[last] = emptyValueFor(parent[last]);
  });
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

const collectTreeEntries = (value, visibleCount, forcedKey) => {
  if (!value || typeof value !== "object") return { entries: [], childCount: 0 };
  if (Array.isArray(value)) {
    const entries = Array.from({ length: Math.min(value.length, visibleCount) }, (_, index) => [index, value[index]]);
    const forcedIndex = forcedKey !== null && forcedKey !== undefined ? Number(forcedKey) : -1;
    if (Number.isInteger(forcedIndex) && forcedIndex >= visibleCount && forcedIndex < value.length) entries.push([forcedIndex, value[forcedIndex]]);
    return {
      entries,
      childCount: value.length,
    };
  }

  const entries = [];
  let childCount = 0;
  let forcedEntry = null;
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      if (entries.length < visibleCount) entries.push([key, value[key]]);
      else if (key === forcedKey) forcedEntry = [key, value[key]];
      childCount += 1;
    }
  }
  if (forcedEntry && !entries.some(([key]) => key === forcedKey)) entries.push(forcedEntry);
  return { entries, childCount };
};

const buildFallbackIndex = (value, limit = 5000) => {
  if (value === null || value === undefined) return { rows: [], visited: 0, truncated: false };
  const rows = [];
  const stack = [{ node: value, path: "" }];
  let visited = 0;

  while (stack.length) {
    const { node, path } = stack.pop();
    visited += 1;
    if (rows.length < limit) {
      rows.push({
        path: path || "root",
        type: valueType(node),
        value: node && typeof node === "object" ? stringify(node, 0) : node,
      });
    }

    if (node && typeof node === "object") {
      const entries = Array.isArray(node)
        ? Array.from({ length: node.length }, (_, index) => [index, node[index]])
        : Object.keys(node).map((key) => [key, node[key]]);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, child] = entries[index];
        stack.push({ node: child, path: formatPath(path, key, Array.isArray(node)) });
      }
    }
  }

  return { rows, visited, truncated: rows.length >= limit && visited > rows.length };
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

const downloadText = (name, text, type = "application/json") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const safeSetStorage = (key, value) => {
  try {
    if (!value || value.length > STORAGE_TEXT_LIMIT) {
      localStorage.removeItem(key);
      return false;
    }
    localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
    return false;
  }
};

const safeSetStorageJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Settings are non-critical.
  }
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
    className={`inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
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
  const pathParts = parsePath(path);
  const selectedParts = parsePath(selectedPath);
  const isSelectedAncestor = selectedPath && selectedParts.length > pathParts.length && pathParts.every((part, index) => part === selectedParts[index]);
  const forcedKey = isSelectedAncestor ? selectedParts[pathParts.length] : null;
  const { entries, childCount } = collectTreeEntries(value, visibleCount, forcedKey);
  const preview = isContainer
    ? isArray ? `[${open ? "" : `${value.length} items`}]` : `{${open ? "" : `${childCount} keys`}}`
    : stringify(value, 0);

  useEffect(() => {
    if (isContainer && isSelectedAncestor) setOpen(true);
  }, [isContainer, isSelectedAncestor]);

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
  const treeRef = useRef(null);
  useEffect(() => {
    if (!selectedPath) return;
    const timer = window.setTimeout(() => {
      const nodes = treeRef.current?.querySelectorAll("[data-path]");
      const target = nodes ? Array.from(nodes).find((node) => node.dataset.path === selectedPath) : null;
      target?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedPath]);

  if (value === null || value === undefined) return <div className="p-8 text-center text-sm text-slate-500">Paste or load JSON to start.</div>;
  return (
    <div ref={treeRef} className="h-full overflow-auto bg-[#0c0f13] p-2">
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
  const workerRef = useRef(null);
  const taskIdRef = useRef(0);
  const activeTasksRef = useRef(new Map());
  const directEditActiveRef = useRef(false);
  const directEditTimerRef = useRef(null);
  const [workspaceTab, setWorkspaceTab] = useState("editor");
  const [editorMode, setEditorMode] = useState("code");
  const [compareMode, setCompareMode] = useState("text");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [leftParsed, setLeftParsed] = useState(EMPTY_WORKER_PARSE);
  const [rightParsed, setRightParsed] = useState(EMPTY_WORKER_PARSE);
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [searchResult, setSearchResult] = useState({ matches: [], visited: 0, truncated: false, status: "idle" });
  const [workerStatus, setWorkerStatus] = useState({ busy: false, label: "Idle", progress: 0 });
  const [compareStatus, setCompareStatus] = useState({ busy: false, label: "Idle", progress: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [query, setQuery] = useState("");
  const [transformCode, setTransformCode] = useState("return value;");
  const [queryResult, setQueryResult] = useState("");
  const [fetchUrl, setFetchUrl] = useState("");
  const [redactionOptions, setRedactionOptions] = useState({
    replacement: "[REDACTED]",
    customKeys: "",
    detectValuePatterns: true,
  });
  const [redactionPreview, setRedactionPreview] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [activeDiffIndex, setActiveDiffIndex] = useState(0);
  const [copied, setCopied] = useState("");
  const [storageNotice, setStorageNotice] = useState("");

  const debouncedLeftText = useDebounce(leftText, PARSE_DEBOUNCE_MS);
  const debouncedRightText = useDebounce(rightText, PARSE_DEBOUNCE_MS);
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const createWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./jsonWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      const { id, type, result, error, label, progress } = event.data;
      const task = activeTasksRef.current.get(id);
      if (!task) return;

      if (type === "progress") {
        task.onProgress?.({ label, progress });
        setWorkerStatus({ busy: true, label, progress });
        return;
      }

      activeTasksRef.current.delete(id);
      setWorkerStatus(activeTasksRef.current.size ? { busy: true, label: "Finishing work", progress: 90 } : { busy: false, label: "Idle", progress: 0 });
      if (type === "result") task.resolve(result);
      else task.reject(new Error(error?.message || "Worker task failed"));
    };
    worker.onerror = (error) => {
      activeTasksRef.current.forEach((task) => task.reject(new Error(error.message || "Worker failed")));
      activeTasksRef.current.clear();
      setWorkerStatus({ busy: false, label: "Worker failed", progress: 0 });
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const runWorkerTask = useCallback((task, payload, onProgress) => {
    const worker = createWorker();
    const id = `${task}-${Date.now()}-${taskIdRef.current += 1}`;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        activeTasksRef.current.delete(id);
        reject(new Error("Worker timed out"));
        setWorkerStatus(activeTasksRef.current.size ? { busy: true, label: "Finishing work", progress: 90 } : { busy: false, label: "Idle", progress: 0 });
      }, WORKER_TIMEOUT_MS);
      activeTasksRef.current.set(id, {
        resolve: (result) => {
          window.clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
        onProgress,
      });
      setWorkerStatus({ busy: true, label: "Queued work", progress: 5 });
      worker.postMessage({ id, task, payload });
    });
  }, [createWorker]);

  const cancelWorkerWork = useCallback(() => {
    activeTasksRef.current.forEach((task) => task.reject(new Error("Canceled")));
    activeTasksRef.current.clear();
    workerRef.current?.terminate();
    workerRef.current = null;
    setWorkerStatus({ busy: false, label: "Canceled", progress: 0 });
    setCompareStatus({ busy: false, label: "Canceled", progress: 0 });
    setLeftParsed((current) => ({ ...current, status: "idle", label: "Canceled", progress: 0 }));
    setRightParsed((current) => ({ ...current, status: "idle", label: "Canceled", progress: 0 }));
    setSearchResult((current) => ({ ...current, status: "idle" }));
  }, []);

  const parseInWorker = useCallback((text, setParsed) => {
    let stale = false;
    if (!text.trim()) {
      setParsed({ ...EMPTY_WORKER_PARSE, status: "done", label: "Ready", progress: 100 });
      return () => {
        stale = true;
      };
    }
    setParsed((current) => ({ ...current, status: "queued", label: "Queued parse", progress: 5 }));
    runWorkerTask("parse", { text }, (progress) => {
      if (!stale) setParsed((current) => ({ ...current, status: "working", ...progress }));
    })
      .then((result) => {
        if (!stale) setParsed({ ...result, status: "done", label: "Ready", progress: 100 });
      })
      .catch((error) => {
        if (stale || error.message === "Canceled") return;
        const parsed = parseJSONDetailed(text);
        if (parsed.error) {
          setParsed({ ...parsed, index: { rows: [], visited: 0, truncated: false }, status: "error", label: "Invalid JSON", progress: 0 });
        } else {
          setParsed({ ...parsed, index: buildFallbackIndex(parsed.value), status: "done", label: "Ready", progress: 100 });
        }
      });
    return () => {
      stale = true;
    };
  }, [runWorkerTask]);

  const isParsingPending =
    leftText !== debouncedLeftText ||
    rightText !== debouncedRightText ||
    [leftParsed, rightParsed].some((parsed) => parsed.status === "queued" || parsed.status === "working");
  const matches = useMemo(() => new Set(searchResult.matches), [searchResult.matches]);
  const searchMatches = searchResult.matches || [];
  const flattened = leftParsed.index?.rows || [];
  const selectedValue = useMemo(() => selectedPath ? getValueAtPath(leftParsed.value, selectedPath) : leftParsed.value, [leftParsed.value, selectedPath]);
  const selectedTable = useMemo(() => collectTable(selectedValue), [selectedValue]);
  const rootTable = useMemo(() => collectTable(leftParsed.value), [leftParsed.value]);
  const table = selectedTable.rows.length ? { ...selectedTable, path: selectedPath } : { ...rootTable, path: "" };
  const filteredComparison = useMemo(() => comparison.filter((diff) => filterType === "all" || diff.type === filterType), [comparison, filterType]);
  const patch = useMemo(() => toJsonPatch(comparison), [comparison]);
  const diffPathSet = useMemo(() => new Set(filteredComparison.map((diff) => diff.path)), [filteredComparison]);
  const activeDiff = filteredComparison[activeDiffIndex] || null;

  useEffect(() => {
    try {
      setLeftText(localStorage.getItem(STORAGE_KEYS.left) || "");
      setRightText(localStorage.getItem(STORAGE_KEYS.right) || "");
      setSettings({ ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}") });
    } catch {
      // Ignore corrupted local storage.
    }
  }, []);

  useEffect(() => parseInWorker(debouncedLeftText, setLeftParsed), [debouncedLeftText, parseInWorker]);
  useEffect(() => parseInWorker(debouncedRightText, setRightParsed), [debouncedRightText, parseInWorker]);

  useEffect(() => {
    let stale = false;
    if (leftParsed.error || leftParsed.value === null || debouncedSearchTerm.length < 2) {
      setSearchResult({ matches: [], visited: 0, truncated: false, status: "idle" });
      return () => {
        stale = true;
      };
    }

    setSearchResult((current) => ({ ...current, status: "working" }));
    runWorkerTask("search", { value: leftParsed.value, term: debouncedSearchTerm }, () => {
      if (!stale) setSearchResult((current) => ({ ...current, status: "working" }));
    })
      .then((result) => {
        if (!stale) setSearchResult({ ...result, status: "done" });
      })
      .catch((error) => {
        if (!stale && error.message !== "Canceled") setSearchResult({ matches: [], visited: 0, truncated: false, status: "error" });
      });

    return () => {
      stale = true;
    };
  }, [debouncedSearchTerm, leftParsed.error, leftParsed.value, runWorkerTask]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [debouncedSearchTerm, searchMatches.length]);

  useEffect(() => {
    const leftStored = safeSetStorage(STORAGE_KEYS.left, leftText);
    const rightStored = safeSetStorage(STORAGE_KEYS.right, rightText);
    safeSetStorageJSON(STORAGE_KEYS.settings, settings);
    if ((leftText && !leftStored) || (rightText && !rightStored)) {
      setStorageNotice(`Large JSON is kept in memory only and will not be restored after refresh. ${Date.now()}`);
    } else {
      setStorageNotice("");
    }
  }, [leftText, rightText, settings]);

  useEffect(() => {
    if (!storageNotice) return undefined;
    const timer = window.setTimeout(() => setStorageNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [storageNotice]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, []);

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (directEditTimerRef.current) window.clearTimeout(directEditTimerRef.current);
  }, []);

  const commitText = useCallback((nextText, { recordHistory = true } = {}) => {
    if (nextText === leftText) return;
    if (recordHistory && leftText.length <= HISTORY_TEXT_LIMIT) setHistory((current) => [leftText, ...current].slice(0, 20));
    else if (recordHistory) setHistory([]);
    setFuture([]);
    setLeftText(nextText);
    directEditActiveRef.current = false;
    if (directEditTimerRef.current) window.clearTimeout(directEditTimerRef.current);
  }, [leftText]);

  const commitValue = useCallback((nextValue) => {
    commitText(stringify(nextValue, 2));
  }, [commitText]);

  const updateLeftTextFromEditor = useCallback((nextText) => {
    if (!directEditActiveRef.current) {
      if (leftText.length <= HISTORY_TEXT_LIMIT) setHistory((current) => [leftText, ...current].slice(0, 20));
      else setHistory([]);
      setFuture([]);
      directEditActiveRef.current = true;
    }
    setLeftText(nextText);
    if (directEditTimerRef.current) window.clearTimeout(directEditTimerRef.current);
    directEditTimerRef.current = window.setTimeout(() => {
      directEditActiveRef.current = false;
    }, 1000);
  }, [leftText]);

  const undo = () => {
    const [previous, ...rest] = history;
    if (previous === undefined) return;
    if (leftText.length <= HISTORY_TEXT_LIMIT) setFuture((current) => [leftText, ...current].slice(0, 20));
    else setFuture([]);
    setLeftText(previous);
    setHistory(rest);
    directEditActiveRef.current = false;
  };

  const redo = () => {
    const [next, ...rest] = future;
    if (next === undefined) return;
    if (leftText.length <= HISTORY_TEXT_LIMIT) setHistory((current) => [leftText, ...current].slice(0, 20));
    else setHistory([]);
    setLeftText(next);
    setFuture(rest);
    directEditActiveRef.current = false;
  };

  const readFile = (event, target) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      if (target === "left") {
        commitText(String(readerEvent.target.result || ""));
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

  const jumpToSearchMatch = (index) => {
    if (!searchMatches.length) return;
    const nextIndex = (index + searchMatches.length) % searchMatches.length;
    const path = searchMatches[nextIndex] === "root" ? "" : searchMatches[nextIndex];
    setActiveSearchIndex(nextIndex);
    setEditorMode("tree");
    selectPath(path);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const currentMatch = searchMatches[activeSearchIndex] === "root" ? "" : searchMatches[activeSearchIndex];
    const offset = selectedPath === currentMatch ? 1 : 0;
    jumpToSearchMatch(event.shiftKey ? activeSearchIndex - 1 : activeSearchIndex + offset);
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

  const clearSelectedValues = (paths) => {
    const targetPaths = new Set([...paths].filter(Boolean));
    if (leftParsed.error || !targetPaths.size) return;
    commitValue(clearValuesAtPaths(leftParsed.value, targetPaths));
    setSelectedPaths(targetPaths);
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

  const runCompare = async () => {
    if (leftParsed.error || rightParsed.error || leftParsed.value === null || rightParsed.value === null) return;
    setCompareStatus({ busy: true, label: "Queued compare", progress: 5 });
    setWorkspaceTab("compare");
    try {
      const diffs = await runWorkerTask("diff", { left: leftParsed.value, right: rightParsed.value, settings }, (progress) => {
        setCompareStatus({ busy: true, ...progress });
      });
      setComparison(diffs);
      setActiveDiffIndex(0);
      if (diffs[0]?.path) setSelectedPath(diffs[0].path);
      setCompareMode("tree");
      setCompareStatus({ busy: false, label: "Ready", progress: 100 });
    } catch (error) {
      if (error.message !== "Canceled") setCompareStatus({ busy: false, label: error.message || "Compare failed", progress: 0 });
    }
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

  const runRedaction = () => {
    if (leftParsed.error || leftParsed.value === null) return;
    const result = redactSecrets(leftParsed.value, redactionOptions);
    setRedactionPreview({
      ...result,
      sourceText: leftText,
    });
  };

  const updateRedactionOptions = (nextOptions) => {
    setRedactionOptions((current) => ({ ...current, ...nextOptions }));
    setRedactionPreview(null);
  };

  const applyRedaction = () => {
    if (!redactionPreview || redactionPreview.sourceText !== leftText) return;
    commitValue(redactionPreview.value);
    setRedactionPreview(null);
    setWorkspaceTab("editor");
  };

  const copyText = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 1200);
  };

  const moveDiff = (direction) => {
    if (!filteredComparison.length) return;
    const nextIndex = (activeDiffIndex + direction + filteredComparison.length) % filteredComparison.length;
    setActiveDiffIndex(nextIndex);
    if (filteredComparison[nextIndex]?.path) setSelectedPath(filteredComparison[nextIndex].path);
  };

  useEffect(() => {
    setActiveDiffIndex(0);
  }, [filterType]);

  const resetWorkspace = () => {
    setWorkspaceTab("editor");
    setEditorMode("code");
    setCompareMode("text");
    setLeftText("");
    setRightText("");
    setSettings(defaultSettings);
    setSelectedPath("");
    setSelectedPaths(new Set());
    setSearchTerm("");
    setActiveSearchIndex(0);
    setContextMenu(null);
    setDialog(null);
    setHistory([]);
    setFuture([]);
    setQuery("");
    setTransformCode("return value;");
    setQueryResult("");
    setFetchUrl("");
    setRedactionOptions({
      replacement: "[REDACTED]",
      customKeys: "",
      detectValuePatterns: true,
    });
    setRedactionPreview(null);
    setComparison([]);
    setFilterType("all");
    setActiveDiffIndex(0);
    setCopied("");
    setStorageNotice("");
    directEditActiveRef.current = false;
    if (directEditTimerRef.current) window.clearTimeout(directEditTimerRef.current);
    Object.values(STORAGE_KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore unavailable storage.
      }
    });
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
            JSONEditor
          </button>
          <div className="flex gap-2">
            <button onClick={() => navigate("/help")} className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900">
              <HelpCircle className="h-4 w-4" /> Help
            </button>
            <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900">
              <Home className="h-4 w-4" /> Home
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[120rem] px-4 py-4">
        <div className="mb-3 flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-800 pb-3">
          {["editor", "compare", "query", "redact"].map((tab) => (
            <ToolbarButton key={tab} active={workspaceTab === tab} onClick={() => setWorkspaceTab(tab)}>
              {tab}
            </ToolbarButton>
          ))}
          <span className="mx-2 h-6 shrink-0 border-l border-slate-800" />
          <ToolbarButton onClick={() => { commitText(stringify(sampleLeft, 2)); setRightText(stringify(sampleRight, 2)); }}>Sample</ToolbarButton>
          <ToolbarButton onClick={() => leftFileRef.current?.click()}><Upload className="h-4 w-4" />Import</ToolbarButton>
          <ToolbarButton onClick={() => downloadText("data.json", leftText || "null")}><Download className="h-4 w-4" />Export</ToolbarButton>
          <ToolbarButton onClick={() => copyText(leftText, "left")}><Copy className="h-4 w-4" />{copied === "left" ? "Copied" : "Copy"}</ToolbarButton>
          <ToolbarButton onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton onClick={() => leftParsed.value !== null && commitValue(sortKeysDeep(leftParsed.value))}>Sort keys</ToolbarButton>
          <ToolbarButton onClick={() => commitText(repairJSONish(leftText))}><Wand2 className="h-4 w-4" />Repair</ToolbarButton>
          <ToolbarButton onClick={() => !leftParsed.error && commitText(stringify(leftParsed.value, 0))}>Compact</ToolbarButton>
          <ToolbarButton onClick={() => !leftParsed.error && commitText(stringify(leftParsed.value, 2))}>Format</ToolbarButton>
          {workerStatus.busy && <ToolbarButton onClick={cancelWorkerWork}><X className="h-4 w-4" />Cancel work</ToolbarButton>}
          <ToolbarButton onClick={resetWorkspace}><RotateCcw className="h-4 w-4" />Reset</ToolbarButton>
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
            <ToolbarButton onClick={() => clearSelectedValues(selectedPaths.size ? selectedPaths : new Set([selectedPath]))} disabled={!selectedPath && !selectedPaths.size}><Eraser className="h-4 w-4" />Clear values</ToolbarButton>
            <ToolbarButton onClick={() => removePaths(selectedPaths.size ? selectedPaths : new Set([selectedPath]))} disabled={!selectedPath && !selectedPaths.size}><Trash2 className="h-4 w-4" />Remove</ToolbarButton>
          </div>
        </div>
        {storageNotice && (
          <div className="mb-3 border border-yellow-900 bg-yellow-950/20 px-3 py-2 text-xs text-yellow-200">
            {storageNotice.replace(/\s\d+$/, "")}
          </div>
        )}

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
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search tree"
                  className="w-full border border-slate-700 bg-[#0b0d10] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
              {searchMatches.length > 0 && (
                <div className="mb-3 max-h-52 overflow-auto border border-slate-800 bg-[#0b0d10] text-xs">
                  <div className="sticky top-0 border-b border-slate-800 bg-[#0b0d10] px-2 py-1.5 text-slate-400">
                    {searchMatches.length}{searchResult.truncated ? "+" : ""} matches. Enter jumps.
                  </div>
                  {searchMatches.slice(0, 100).map((path, index) => (
                    <button
                      key={`${path}-${index}`}
                      title={path}
                      onClick={() => jumpToSearchMatch(index)}
                      className={`block w-full truncate px-2 py-1.5 text-left hover:bg-slate-800 ${index === activeSearchIndex ? "bg-cyan-500/15 text-cyan-200" : "text-slate-300"}`}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2 text-xs text-slate-400">
                {isParsingPending && <div className="border border-cyan-900 p-2 text-cyan-200">{workerStatus.label} {workerStatus.progress ? `${workerStatus.progress}%` : ""}</div>}
                <div className="border border-slate-800 p-2">Click selects and shows path. Ctrl/Cmd/Shift click toggles multi-select.</div>
                <div className="border border-slate-800 p-2">Right-click any node for add, edit, duplicate, copy, and remove actions.</div>
                <div className={`border p-2 ${leftParsed.error ? "border-red-900 text-red-200" : "border-emerald-900 text-emerald-200"}`}>{leftParsed.error ? "Invalid JSON" : `${leftParsed.index?.visited || 0}${leftParsed.index?.truncated ? "+" : ""} indexed nodes`}</div>
                {debouncedSearchTerm.length === 1 && <div className="border border-yellow-900 p-2 text-yellow-200">Search starts after 2 characters.</div>}
                {searchResult.status === "working" && <div className="border border-cyan-900 p-2 text-cyan-200">Searching in worker...</div>}
                {searchResult.truncated && <div className="border border-yellow-900 p-2 text-yellow-200">Showing first {SEARCH_RESULT_LIMIT} search matches.</div>}
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
                  onChange={(value) => updateLeftTextFromEditor(value || "")}
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

        {workspaceTab === "redact" && (
          <section className="grid gap-3 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
            <div className="space-y-4 border border-slate-800 bg-[#101419] p-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Secret redaction</h2>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Detect sensitive keys and recognizable token formats locally. Preview paths before replacing anything in the editor.
                </p>
              </div>

              <label className="block space-y-2 text-xs text-slate-300">
                <span>Replacement value</span>
                <input
                  value={redactionOptions.replacement}
                  onChange={(event) => updateRedactionOptions({ replacement: event.target.value })}
                  className="w-full border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </label>

              <label className="block space-y-2 text-xs text-slate-300">
                <span>Additional sensitive keys</span>
                <textarea
                  value={redactionOptions.customKeys}
                  onChange={(event) => updateRedactionOptions({ customKeys: event.target.value })}
                  rows={5}
                  placeholder={"pin\nsigningKey\nconnectionPassword"}
                  className="w-full border border-slate-700 bg-[#0b0d10] p-3 text-sm text-white outline-none focus:border-cyan-500"
                />
                <span className="block leading-5 text-slate-500">One key per line or comma-separated. Matching ignores case, dashes, and underscores.</span>
              </label>

              <label className="flex items-start gap-3 border border-slate-800 bg-[#0c0f13] p-3 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={redactionOptions.detectValuePatterns}
                  onChange={(event) => updateRedactionOptions({ detectValuePatterns: event.target.checked })}
                  className="mt-0.5 accent-cyan-500"
                />
                <span>
                  Detect token values
                  <span className="mt-1 block leading-5 text-slate-500">Bearer/Basic auth, JWTs, AWS and GitHub tokens, private keys, and URLs containing credentials.</span>
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <ToolbarButton onClick={runRedaction} active disabled={leftParsed.error || leftParsed.value === null}>
                  <ShieldCheck className="h-4 w-4" />Preview redaction
                </ToolbarButton>
                <ToolbarButton
                  onClick={applyRedaction}
                  disabled={!redactionPreview || redactionPreview.sourceText !== leftText}
                >
                  Apply to editor
                </ToolbarButton>
                <ToolbarButton onClick={() => {
                  commitValue(redactionSample);
                  setRedactionPreview(null);
                }}>
                  Load example
                </ToolbarButton>
              </div>

              <div className="border border-slate-800 bg-[#0c0f13] p-3 text-xs leading-5 text-slate-500">
                Values under common keys such as <code className="text-slate-300">password</code>, <code className="text-slate-300">apiKey</code>, <code className="text-slate-300">clientSecret</code>, and <code className="text-slate-300">accessToken</code> are replaced regardless of their type.
              </div>
            </div>

            <div className="min-w-0 border border-slate-800 bg-[#0c0f13]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Redacted preview</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {redactionPreview ? `${redactionPreview.matches.length} secret${redactionPreview.matches.length === 1 ? "" : "s"} detected` : "Run a preview to inspect the redacted output."}
                  </p>
                </div>
                {redactionPreview?.sourceText !== leftText && redactionPreview && (
                  <span className="border border-yellow-900 bg-yellow-950/30 px-2 py-1 text-xs text-yellow-200">Source changed; preview again</span>
                )}
              </div>

              {redactionPreview ? (
                <div className="grid min-h-[34rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
                  <pre className="max-h-[48rem] overflow-auto p-4 text-sm text-slate-200">{stringify(redactionPreview.value, 2)}</pre>
                  <div className="max-h-[48rem] overflow-auto border-t border-slate-800 p-3 xl:border-l xl:border-t-0">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Detected paths</div>
                    {redactionPreview.matches.length ? (
                      <div className="space-y-2">
                        {redactionPreview.matches.map((match, index) => (
                          <div key={`${match.path}-${index}`} className="border border-slate-800 bg-[#101419] p-2 text-xs">
                            <code className="break-all text-cyan-300">{match.path}</code>
                            <div className="mt-1 text-slate-500">{match.reason}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs leading-5 text-slate-500">No secrets matched the current rules.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[34rem] items-center justify-center p-8 text-center text-sm text-slate-500">
                  The original values are never shown in the detection list.
                </div>
              )}
            </div>
          </section>
        )}

        {workspaceTab === "compare" && (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="sticky top-14 z-40 xl:col-span-2 flex flex-wrap items-center gap-2 border border-slate-800 bg-[#101419] p-2 shadow-lg shadow-black/20">
              <button onClick={() => setCompareMode("text")} className={`inline-flex items-center gap-2 border px-3 py-2 text-xs ${compareMode === "text" ? "border-cyan-500 bg-cyan-500 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-900"}`}><Code2 className="h-4 w-4" />Text</button>
              <button onClick={() => setCompareMode("tree")} className={`inline-flex items-center gap-2 border px-3 py-2 text-xs ${compareMode === "tree" ? "border-cyan-500 bg-cyan-500 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-900"}`}><ListTree className="h-4 w-4" />Tree</button>
              <span className="hidden text-xs text-slate-500 md:inline">Use Text to paste/edit both sides. Compare switches to Tree for review.</span>
              <span className="mx-1 h-6 border-l border-slate-800" />
              <ToolbarButton onClick={runCompare} active disabled={compareStatus.busy}><GitCompare className="h-4 w-4" />{compareStatus.busy ? "Comparing" : "Compare"}</ToolbarButton>
              {compareStatus.busy && <ToolbarButton onClick={cancelWorkerWork}><X className="h-4 w-4" />Cancel</ToolbarButton>}
              <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="shrink-0 border border-slate-700 bg-[#0b0d10] px-3 py-2 text-xs text-white">
                <option value="all">All</option>
                <option value="added">Added</option>
                <option value="removed">Removed</option>
                <option value="modified">Modified</option>
              </select>
              <ToolbarButton onClick={() => moveDiff(-1)} disabled={!filteredComparison.length}><ArrowUp className="h-4 w-4" />Prev</ToolbarButton>
              <ToolbarButton onClick={() => moveDiff(1)} disabled={!filteredComparison.length}><ArrowDown className="h-4 w-4" />Next</ToolbarButton>
              <ToolbarButton onClick={() => downloadText("json-patch.json", stringify(patch, 2))}>Patch</ToolbarButton>
              <ToolbarButton onClick={() => leftParsed.value && downloadText("merged-output.json", stringify(applyDiffToLeft(leftParsed.value, comparison), 2))}>Merged</ToolbarButton>
              {compareStatus.busy && <span className="text-xs text-cyan-300">{compareStatus.label} {compareStatus.progress ? `${compareStatus.progress}%` : ""}</span>}
            </div>
            <div className="border border-slate-800 bg-[#101419]">
              <div className="flex items-center justify-between border-b border-slate-800 p-3">
                <h2 className="text-sm font-semibold text-white">Left JSON</h2>
                <ToolbarButton onClick={() => leftFileRef.current?.click()}><Upload className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="h-[34rem]">
                {compareMode === "text" ? (
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={leftText}
                    onChange={(value) => updateLeftTextFromEditor(value || "")}
                    options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false }}
                  />
                ) : leftParsed.error ? <div className="p-3"><ErrorMessage error={leftParsed.error} /></div> : (
                  <TreeView
                    value={leftParsed.value}
                    selectedPath={activeDiff?.path || selectedPath}
                    selectedPaths={new Set()}
                    matches={diffPathSet}
                    onSelect={selectPath}
                    onContextMenu={openContext}
                  />
                )}
              </div>
            </div>
            <div className="border border-slate-800 bg-[#101419]">
              <div className="flex items-center justify-between border-b border-slate-800 p-3">
                <h2 className="text-sm font-semibold text-white">Right JSON</h2>
                <div className="flex gap-2">
                  <ToolbarButton onClick={() => rightFileRef.current?.click()}><Upload className="h-4 w-4" /></ToolbarButton>
                  <ToolbarButton onClick={() => { commitText(rightText); setRightText(leftText); }}><ArrowLeftRight className="h-4 w-4" /></ToolbarButton>
                </div>
              </div>
              <div className="h-[34rem]">
                {compareMode === "text" ? (
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={rightText}
                    onChange={(value) => setRightText(value || "")}
                    options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false }}
                  />
                ) : rightParsed.error ? <div className="p-3"><ErrorMessage error={rightParsed.error} /></div> : (
                  <TreeView
                    value={rightParsed.value}
                    selectedPath={activeDiff?.path || selectedPath}
                    selectedPaths={new Set()}
                    matches={diffPathSet}
                    onSelect={selectPath}
                    onContextMenu={openContext}
                  />
                )}
              </div>
            </div>
            <div className="xl:col-span-2 border border-slate-800 bg-[#101419] p-3">
              {!comparison.length ? <div className="p-6 text-center text-sm text-slate-500">No differences yet, or the documents match.</div> : (
                <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="border border-slate-800 bg-[#0c0f13] p-3 text-xs">
                    <div className="mb-2 text-slate-500">Difference</div>
                    <div className="mb-3 text-lg text-white">{Math.min(activeDiffIndex + 1, filteredComparison.length)} / {filteredComparison.length}</div>
                    <div className="space-y-2 text-slate-300">
                      <div>Total: <span className="text-white">{comparison.length}</span></div>
                      <div>Added: <span className="text-emerald-300">{comparison.filter((diff) => diff.type === "added").length}</span></div>
                      <div>Removed: <span className="text-red-300">{comparison.filter((diff) => diff.type === "removed").length}</span></div>
                      <div>Modified: <span className="text-yellow-300">{comparison.filter((diff) => diff.type === "modified").length}</span></div>
                    </div>
                  </div>
                  {activeDiff && (
                    <div className="border border-slate-800 bg-[#0c0f13] p-3 text-xs">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-1 uppercase ${activeDiff.type === "added" ? "bg-emerald-950 text-emerald-200" : activeDiff.type === "removed" ? "bg-red-950 text-red-200" : "bg-yellow-950 text-yellow-200"}`}>{activeDiff.type}</span>
                        <code className="break-all text-cyan-300">{activeDiff.path}</code>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div>
                          <div className="mb-2 text-slate-500">Left</div>
                          <pre className="max-h-64 overflow-auto border border-slate-800 bg-[#080a0d] p-3 text-slate-300">{stringify(activeDiff.type === "added" ? undefined : activeDiff.oldValue ?? activeDiff.value, 2)}</pre>
                        </div>
                        <div>
                          <div className="mb-2 text-slate-500">Right</div>
                          <pre className="max-h-64 overflow-auto border border-slate-800 bg-[#080a0d] p-3 text-slate-300">{stringify(activeDiff.type === "removed" ? undefined : activeDiff.newValue ?? activeDiff.value, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
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
          <button onClick={() => clearSelectedValues(selectedPaths.size ? selectedPaths : new Set([contextMenu.path]))} className="block w-full px-3 py-2 text-left text-yellow-100 hover:bg-yellow-950/40">Clear selected values</button>
          <button onClick={() => removePaths(selectedPaths.size ? selectedPaths : new Set([contextMenu.path]))} className="block w-full px-3 py-2 text-left text-red-200 hover:bg-red-950/50">Remove selected</button>
        </div>
      )}

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        title="Scroll to top"
        className="fixed bottom-4 right-4 z-50 inline-flex h-10 w-10 items-center justify-center border border-slate-700 bg-[#101419] text-slate-200 shadow-xl shadow-black/30 hover:border-cyan-500 hover:text-cyan-300"
      >
        <ArrowUp className="h-4 w-4" />
      </button>

      {dialog && <NodeDialog mode={dialog.mode} node={dialog.node} parentPath={dialog.parentPath} onClose={() => setDialog(null)} onSave={saveDialog} />}
    </div>
  );
};

export default JSONCompare;
