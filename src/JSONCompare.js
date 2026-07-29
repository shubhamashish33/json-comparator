import { Analytics } from "@vercel/analytics/react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import Ajv from "ajv";
import jmespath from "jmespath";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Code2,
  Copy,
  Download,
  Eraser,
  FilePlus2,
  FileJson,
  Github,
  GitCompare,
  HelpCircle,
  Link2,
  ListTree,
  MoreHorizontal,
  Plus,
  Redo2,
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
import {
  createDocument,
  formatBytes,
  jsonPointerToPath,
  replaceJsonMatches,
} from "./workbenchUtils";

const STORAGE_KEYS = {
  left: "json-comparator-json1",
  right: "json-comparator-json2",
  settings: "json-comparator-settings",
  documents: "json-comparator-documents",
  activeDocument: "json-comparator-active-document",
  schema: "json-comparator-schema",
  schemaEnabled: "json-comparator-schema-enabled",
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

const ErrorMessage = ({ error, onJump }) => {
  if (!error) return null;
  return (
    <button
      type="button"
      onClick={onJump}
      className={`flex w-full items-start gap-2 rounded-md border border-red-900/70 bg-red-950/30 p-2 text-left text-xs text-red-200 ${onJump ? "hover:border-red-700 hover:bg-red-950/50" : "cursor-default"}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{error.message}{error.line ? ` at ${error.line}:${error.column}` : ""}</span>
      {onJump && <span className="shrink-0 text-red-300">Jump to error</span>}
    </button>
  );
};

const ToolbarButton = ({ children, onClick, disabled, active, title }) => (
  <button
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-700 bg-[#101419] text-slate-200 hover:border-slate-600 hover:bg-slate-900"
    }`}
  >
    {children}
  </button>
);

const EmptyEditorState = ({ onPaste, onOpen, onSample }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0c0f13] p-6">
    <div className="max-w-lg text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
        <Braces className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-white">Paste JSON to begin</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Paste from your clipboard, open a file, or drop a .json or .jsonc file here.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <ToolbarButton onClick={onPaste} active title="Paste JSON from the clipboard">
          <ClipboardPaste className="h-4 w-4" />Paste JSON
        </ToolbarButton>
        <ToolbarButton onClick={onOpen} title="Open a JSON file">
          <Upload className="h-4 w-4" />Open file
        </ToolbarButton>
        <ToolbarButton onClick={onSample} title="Load example JSON">Load example</ToolbarButton>
      </div>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-900/70 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" />Processed locally in this browser
      </div>
    </div>
  </div>
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
    <div ref={treeRef} className="h-full overflow-auto bg-[#0c0f13] p-2 font-mono">
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
  const editorRef = useRef(null);
  const searchInputRef = useRef(null);
  const workerRef = useRef(null);
  const taskIdRef = useRef(0);
  const activeTasksRef = useRef(new Map());
  const directEditActiveRef = useRef(false);
  const directEditTimerRef = useRef(null);
  const [workspaceTab, setWorkspaceTab] = useState("editor");
  const [editorMode, setEditorMode] = useState("code");
  const [compareMode, setCompareMode] = useState("text");
  const [documents, setDocuments] = useState([{ id: "document-1", name: "Document 1.json", text: "" }]);
  const [activeDocumentId, setActiveDocumentId] = useState("document-1");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [rightDocumentId, setRightDocumentId] = useState("");
  const [leftParsed, setLeftParsed] = useState(EMPTY_WORKER_PARSE);
  const [rightParsed, setRightParsed] = useState(EMPTY_WORKER_PARSE);
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [searchScope, setSearchScope] = useState("all");
  const [replaceText, setReplaceText] = useState("");
  const [replaceNotice, setReplaceNotice] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [searchResult, setSearchResult] = useState({ matches: [], visited: 0, truncated: false, status: "idle" });
  const [workerStatus, setWorkerStatus] = useState({ busy: false, label: "Idle", progress: 0 });
  const [compareStatus, setCompareStatus] = useState({ busy: false, label: "Idle", progress: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [query, setQuery] = useState("");
  const [queryLanguage, setQueryLanguage] = useState("jmespath");
  const [transformCode, setTransformCode] = useState("return value;");
  const [queryResult, setQueryResult] = useState("");
  const [fetchUrl, setFetchUrl] = useState("");
  const [redactionOptions, setRedactionOptions] = useState({
    replacement: "[REDACTED]",
    customKeys: "",
    detectValuePatterns: true,
  });
  const [redactionPreview, setRedactionPreview] = useState(null);
  const [redactionNotice, setRedactionNotice] = useState("");
  const [comparison, setComparison] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [activeDiffIndex, setActiveDiffIndex] = useState(0);
  const [copied, setCopied] = useState("");
  const [storageNotice, setStorageNotice] = useState("");
  const [schemaText, setSchemaText] = useState("");
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const [schemaPanelOpen, setSchemaPanelOpen] = useState(false);
  const [schemaErrors, setSchemaErrors] = useState([]);
  const [schemaInputError, setSchemaInputError] = useState("");
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [dropActive, setDropActive] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const ajv = useMemo(() => new Ajv({ allErrors: true, strict: false }), []);

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
  const activeDocument = documents.find((document) => document.id === activeDocumentId) || documents[0];
  const documentBytes = useMemo(() => new Blob([leftText]).size, [leftText]);
  const documentType = leftParsed.value === null
    ? "empty"
    : Array.isArray(leftParsed.value)
      ? "array"
      : typeof leftParsed.value;

  useEffect(() => {
    try {
      const storedDocuments = JSON.parse(localStorage.getItem(STORAGE_KEYS.documents) || "null");
      const storedActiveId = localStorage.getItem(STORAGE_KEYS.activeDocument);
      if (Array.isArray(storedDocuments) && storedDocuments.length) {
        const restoredActiveId = storedDocuments.some((document) => document.id === storedActiveId)
          ? storedActiveId
          : storedDocuments[0].id;
        setDocuments(storedDocuments);
        setActiveDocumentId(restoredActiveId);
        setLeftText(storedDocuments.find((document) => document.id === restoredActiveId)?.text || "");
      } else {
        const legacyText = localStorage.getItem(STORAGE_KEYS.left) || "";
        setLeftText(legacyText);
        setDocuments([{ id: "document-1", name: "Document 1.json", text: legacyText }]);
      }
      setRightText(localStorage.getItem(STORAGE_KEYS.right) || "");
      setSettings({ ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}") });
      setSchemaText(localStorage.getItem(STORAGE_KEYS.schema) || "");
      setSchemaEnabled(localStorage.getItem(STORAGE_KEYS.schemaEnabled) === "true");
    } catch {
      // Ignore corrupted local storage.
    } finally {
      setStorageReady(true);
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
    runWorkerTask("search", { value: leftParsed.value, term: debouncedSearchTerm, scope: searchScope }, () => {
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
  }, [debouncedSearchTerm, leftParsed.error, leftParsed.value, runWorkerTask, searchScope]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [debouncedSearchTerm, searchMatches.length]);

  useEffect(() => {
    setRedactionPreview((current) => current && current.sourceText !== leftText ? null : current);
  }, [leftText]);

  useEffect(() => {
    if (!storageReady) return;
    setDocuments((current) => current.map((document) => (
      document.id === activeDocumentId ? { ...document, text: leftText } : document
    )));
  }, [activeDocumentId, leftText, storageReady]);

  useEffect(() => {
    if (!rightDocumentId) return;
    if (rightDocumentId === activeDocumentId) {
      setRightDocumentId("");
      return;
    }
    const selectedDocument = documents.find((document) => document.id === rightDocumentId);
    if (!selectedDocument) {
      setRightDocumentId("");
      return;
    }
    setRightText(selectedDocument.text);
  }, [activeDocumentId, documents, rightDocumentId]);

  useEffect(() => {
    if (!storageReady) return;
    const leftStored = safeSetStorage(STORAGE_KEYS.left, leftText);
    const rightStored = safeSetStorage(STORAGE_KEYS.right, rightText);
    safeSetStorageJSON(STORAGE_KEYS.settings, settings);
    const documentsSize = documents.reduce((total, document) => total + document.text.length, 0);
    if (documentsSize <= STORAGE_TEXT_LIMIT) safeSetStorageJSON(STORAGE_KEYS.documents, documents);
    safeSetStorage(STORAGE_KEYS.activeDocument, activeDocumentId);
    safeSetStorage(STORAGE_KEYS.schema, schemaText);
    safeSetStorage(STORAGE_KEYS.schemaEnabled, String(schemaEnabled));
    if ((leftText && !leftStored) || (rightText && !rightStored)) {
      setStorageNotice(`Large JSON is kept in memory only and will not be restored after refresh. ${Date.now()}`);
    } else {
      setStorageNotice("");
    }
  }, [activeDocumentId, documents, leftText, rightText, schemaEnabled, schemaText, settings, storageReady]);

  useEffect(() => {
    if (!schemaEnabled || !schemaText.trim() || leftParsed.error || leftParsed.value === null) {
      setSchemaErrors([]);
      setSchemaInputError("");
      return;
    }
    try {
      const schema = JSON.parse(schemaText);
      const validate = ajv.compile(schema);
      validate(leftParsed.value);
      setSchemaErrors(validate.errors || []);
      setSchemaInputError("");
    } catch (error) {
      setSchemaErrors([]);
      setSchemaInputError(error.message || "Invalid JSON Schema");
    }
  }, [ajv, leftParsed.error, leftParsed.value, schemaEnabled, schemaText]);

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

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
    setCursorPosition(editor.getPosition() || { lineNumber: 1, column: 1 });
    editor.onDidChangeCursorPosition((event) => setCursorPosition(event.position));
  }, []);

  const jumpToParseError = useCallback(() => {
    if (!leftParsed.error?.line) return;
    setWorkspaceTab("editor");
    setEditorMode("code");
    window.setTimeout(() => {
      const position = {
        lineNumber: leftParsed.error.line,
        column: leftParsed.error.column || 1,
      };
      editorRef.current?.setPosition(position);
      editorRef.current?.revealPositionInCenter(position);
      editorRef.current?.focus();
    }, 0);
  }, [leftParsed.error]);

  const pasteJSON = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) commitText(text);
    } catch {
      editorRef.current?.focus();
    }
  }, [commitText]);

  const handleEditorDrop = useCallback((event) => {
    event.preventDefault();
    setDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      commitText(String(readerEvent.target.result || ""));
      setDocuments((current) => current.map((document) => (
        document.id === activeDocumentId ? { ...document, name: file.name } : document
      )));
    };
    reader.readAsText(file);
  }, [activeDocumentId, commitText]);

  const switchDocument = useCallback((documentId) => {
    const nextDocument = documents.find((document) => document.id === documentId);
    if (!nextDocument || documentId === activeDocumentId) return;
    setDocuments((current) => current.map((document) => (
      document.id === activeDocumentId ? { ...document, text: leftText } : document
    )));
    setActiveDocumentId(documentId);
    setLeftText(nextDocument.text);
    setHistory([]);
    setFuture([]);
    setSelectedPath("");
    setSelectedPaths(new Set());
  }, [activeDocumentId, documents, leftText]);

  const selectCompareLeftDocument = useCallback((documentId) => {
    if (documentId === activeDocumentId) return;
    if (documentId === rightDocumentId) {
      setRightDocumentId(activeDocumentId);
      setRightText(leftText);
    }
    switchDocument(documentId);
  }, [activeDocumentId, leftText, rightDocumentId, switchDocument]);

  const selectCompareRightDocument = useCallback((documentId) => {
    setRightDocumentId(documentId);
    if (!documentId) return;
    const selectedDocument = documents.find((document) => document.id === documentId);
    if (selectedDocument) setRightText(selectedDocument.text);
  }, [documents]);

  const swapCompareSides = useCallback(() => {
    const previousLeftId = activeDocumentId;
    const previousLeftText = leftText;
    if (rightDocumentId) {
      switchDocument(rightDocumentId);
      setRightDocumentId(previousLeftId);
      setRightText(previousLeftText);
      return;
    }
    commitText(rightText);
    setRightText(previousLeftText);
    setRightDocumentId("");
  }, [activeDocumentId, commitText, leftText, rightDocumentId, rightText, switchDocument]);

  const addDocument = useCallback(() => {
    const nextDocument = createDocument(documents.length + 1);
    setDocuments((current) => [
      ...current.map((document) => (
        document.id === activeDocumentId ? { ...document, text: leftText } : document
      )),
      nextDocument,
    ]);
    setActiveDocumentId(nextDocument.id);
    setLeftText("");
    setHistory([]);
    setFuture([]);
    setWorkspaceTab("editor");
    setEditorMode("code");
  }, [activeDocumentId, documents.length, leftText]);

  const closeDocument = useCallback((documentId) => {
    const index = documents.findIndex((document) => document.id === documentId);
    if (index < 0) return;
    if (documents.length === 1) {
      const freshDocument = createDocument(1);
      setDocuments([freshDocument]);
      setActiveDocumentId(freshDocument.id);
      setLeftText("");
      return;
    }
    const nextDocuments = documents.filter((document) => document.id !== documentId);
    setDocuments(nextDocuments);
    if (documentId === activeDocumentId) {
      const nextDocument = nextDocuments[Math.min(index, nextDocuments.length - 1)];
      setActiveDocumentId(nextDocument.id);
      setLeftText(nextDocument.text);
      setHistory([]);
      setFuture([]);
    }
  }, [activeDocumentId, documents]);

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
        setDocuments((current) => current.map((document) => (
          document.id === activeDocumentId ? { ...document, name: file.name } : document
        )));
      } else {
        setRightDocumentId("");
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

  const replaceAllMatches = () => {
    if (leftParsed.error || leftParsed.value === null || !searchTerm.trim()) return;
    const result = replaceJsonMatches(leftParsed.value, searchTerm, replaceText, searchScope);
    if (!result.count) {
      setReplaceNotice("No replaceable string or key matches.");
      return;
    }
    commitValue(result.value);
    setReplaceNotice(`${result.count} replacement${result.count === 1 ? "" : "s"} applied. Undo is available.`);
  };

  const jumpToSchemaError = (error) => {
    const path = jsonPointerToPath(error.instancePath);
    setWorkspaceTab("editor");
    setEditorMode("tree");
    selectPath(path);
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
      setCompareMode("diff");
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
      const value = query.trim()
        ? queryLanguage === "jmespath"
          ? jmespath.search(leftParsed.value, query.trim())
          : getValueAtPath(leftParsed.value, query.trim())
        : leftParsed.value;
      setQueryResult(stringify(value, 2));
    } catch (error) {
      setQueryResult(`Query failed: ${error.message}`);
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

  useEffect(() => {
    if (workspaceTab !== "query" || leftParsed.error || leftParsed.value === null) return;
    const timer = window.setTimeout(runQuery, 120);
    return () => window.clearTimeout(timer);
    // runQuery is intentionally driven by the query inputs and parsed value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftParsed.error, leftParsed.value, query, queryLanguage, workspaceTab]);

  const runRedaction = () => {
    if (leftParsed.error || leftParsed.value === null) return;
    const result = redactSecrets(leftParsed.value, redactionOptions);
    setRedactionPreview({
      ...result,
      sourceText: leftText,
    });
    setRedactionNotice(result.matches.length ? "" : "No secrets matched the current rules.");
  };

  const updateRedactionOptions = (nextOptions) => {
    setRedactionOptions((current) => ({ ...current, ...nextOptions }));
    setRedactionPreview(null);
    setRedactionNotice("");
  };

  const applyRedaction = () => {
    if (!redactionPreview || redactionPreview.sourceText !== leftText) return;
    commitValue(redactionPreview.value);
    setRedactionPreview(null);
    setRedactionNotice("The source JSON was replaced with the redacted result. Use Undo to restore it.");
  };

  const pasteRedactionJSON = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setRedactionNotice("Clipboard does not contain JSON text.");
        return;
      }
      commitText(text);
      setRedactionPreview(null);
      setRedactionNotice("");
    } catch {
      setRedactionNotice("Clipboard access was blocked. Paste directly into the source editor.");
    }
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

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        addDocument();
      } else if (key === "k") {
        event.preventDefault();
        setWorkspaceTab("editor");
        setEditorMode("tree");
        setSearchExpanded(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (event.shiftKey && key === "f" && !leftParsed.error && leftParsed.value !== null) {
        event.preventDefault();
        commitText(stringify(leftParsed.value, 2));
      } else if (event.shiftKey && key === "m" && !leftParsed.error && leftParsed.value !== null) {
        event.preventDefault();
        commitText(stringify(leftParsed.value, 0));
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [addDocument, commitText, leftParsed.error, leftParsed.value]);

  const resetWorkspace = () => {
    setWorkspaceTab("editor");
    setEditorMode("code");
    setCompareMode("text");
    const freshDocument = createDocument(1);
    setDocuments([freshDocument]);
    setActiveDocumentId(freshDocument.id);
    setLeftText("");
    setRightText("");
    setRightDocumentId("");
    setSettings(defaultSettings);
    setSelectedPath("");
    setSelectedPaths(new Set());
    setSearchTerm("");
    setSearchScope("all");
    setReplaceText("");
    setReplaceNotice("");
    setSearchExpanded(false);
    setActiveSearchIndex(0);
    setContextMenu(null);
    setDialog(null);
    setHistory([]);
    setFuture([]);
    setQuery("");
    setQueryLanguage("jmespath");
    setTransformCode("return value;");
    setQueryResult("");
    setFetchUrl("");
    setRedactionOptions({
      replacement: "[REDACTED]",
      customKeys: "",
      detectValuePatterns: true,
    });
    setRedactionPreview(null);
    setRedactionNotice("");
    setComparison([]);
    setFilterType("all");
    setActiveDiffIndex(0);
    setCopied("");
    setStorageNotice("");
    setSchemaText("");
    setSchemaEnabled(false);
    setSchemaPanelOpen(false);
    setSchemaErrors([]);
    setSchemaInputError("");
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
    ["code", "Code", Code2],
    ["tree", "Tree", ListTree],
    ["text", "Paths", FileJson],
    ["table", "Table", Table2],
  ];

  return (
    <div className="min-h-screen bg-[#0b0d10] font-sans text-slate-200 selection:bg-cyan-500/20">
      <Analytics />
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-[#0b0d10]/95">
        <div className="mx-auto flex min-h-14 max-w-[120rem] items-center gap-4 px-4">
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-white">
            <GitCompare className="h-5 w-5 text-cyan-400" />
            JSONEditor
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {[
              ["editor", "Edit"],
              ["compare", "Compare"],
              ["query", "Query"],
              ["redact", "Sanitize"],
            ].map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setWorkspaceTab(tab)}
                className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  workspaceTab === tab ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 gap-1">
            <a
              href="https://github.com/shubhamashish33/json-comparator"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-900 hover:text-white"
              aria-label="View JSONEditor source on GitHub"
              title="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <button
              onClick={() => navigate("/help")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-900 hover:text-white"
              title="Help and keyboard shortcuts"
              aria-label="Help and keyboard shortcuts"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[120rem] px-3 py-3 sm:px-4">
        {workspaceTab !== "compare" && (
        <div className="mb-2 flex min-w-0 items-center gap-1 overflow-x-auto border-b border-slate-800">
          {documents.map((document) => (
            <div
              key={document.id}
              className={`group flex max-w-56 shrink-0 items-center border-b-2 ${
                document.id === activeDocumentId ? "border-cyan-400 bg-slate-900/70 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <button onClick={() => switchDocument(document.id)} className="min-w-0 truncate px-3 py-2 text-xs">
                {document.name}
              </button>
              <button
                onClick={() => closeDocument(document.id)}
                className="mr-1 rounded p-1 opacity-50 hover:bg-slate-800 hover:opacity-100"
                aria-label={`Close ${document.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button onClick={addDocument} className="shrink-0 rounded p-2 text-slate-500 hover:bg-slate-900 hover:text-cyan-300" title="New document (Ctrl/Cmd+N)">
            <FilePlus2 className="h-4 w-4" />
          </button>
        </div>
        )}

        {workspaceTab === "editor" && (
          <div className="mb-3 flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#101419] p-2">
            <div className="flex items-center gap-1 rounded-md bg-[#0b0d10] p-1">
              {modeButtons.map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setEditorMode(mode)}
                  className={`inline-flex min-h-8 items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium ${
                    editorMode === mode ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
            <span className="hidden h-6 border-l border-slate-800 sm:block" />
            <ToolbarButton onClick={() => leftFileRef.current?.click()} title="Open JSON file"><Upload className="h-4 w-4" />Open</ToolbarButton>
            <ToolbarButton
              onClick={() => !leftParsed.error && leftParsed.value !== null && commitText(stringify(leftParsed.value, 2))}
              disabled={leftParsed.error || leftParsed.value === null}
              active
              title="Format JSON (Ctrl/Cmd+Shift+F)"
            >
              Format
            </ToolbarButton>
            <ToolbarButton onClick={() => copyText(leftText, "left")} disabled={!leftText} title="Copy current JSON">
              <Copy className="h-4 w-4" />{copied === "left" ? "Copied" : "Copy"}
            </ToolbarButton>
            <ToolbarButton onClick={undo} disabled={!history.length} title="Undo"><Undo2 className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={redo} disabled={!future.length} title="Redo"><Redo2 className="h-4 w-4" /></ToolbarButton>
            {leftParsed.error && (
              <ToolbarButton onClick={() => commitText(repairJSONish(leftText))} active title="Attempt to repair common JSON errors">
                <Wand2 className="h-4 w-4" />Repair
              </ToolbarButton>
            )}
            <div className="relative ml-auto">
              <details>
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-700 bg-[#101419] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900">
                  <MoreHorizontal className="h-4 w-4" />More
                </summary>
                <div className="absolute right-0 top-11 z-50 grid w-52 gap-1 rounded-lg border border-slate-700 bg-[#101419] p-1.5 shadow-2xl shadow-black/50">
                  <button onClick={() => { commitText(stringify(sampleLeft, 2)); setRightDocumentId(""); setRightText(stringify(sampleRight, 2)); }} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-800">Load sample</button>
                  <button onClick={() => downloadText(activeDocument?.name || "data.json", leftText || "null")} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-800">Download JSON</button>
                  <button onClick={() => leftParsed.value !== null && commitValue(sortKeysDeep(leftParsed.value))} disabled={leftParsed.error} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-800 disabled:opacity-40">Sort keys</button>
                  <button onClick={() => !leftParsed.error && commitText(stringify(leftParsed.value, 0))} disabled={leftParsed.error || leftParsed.value === null} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-800 disabled:opacity-40">Minify</button>
                  <button onClick={() => setSchemaPanelOpen((current) => !current)} className="rounded px-3 py-2 text-left text-xs hover:bg-slate-800">JSON Schema</button>
                  <div className="my-1 border-t border-slate-800" />
                  <button onClick={resetWorkspace} className="rounded px-3 py-2 text-left text-xs text-red-200 hover:bg-red-950/40">Reset workspace</button>
                </div>
              </details>
            </div>
            {workerStatus.busy && <ToolbarButton onClick={cancelWorkerWork}><X className="h-4 w-4" />Cancel work</ToolbarButton>}
          </div>
        )}
        <input ref={leftFileRef} type="file" accept=".json,.jsonc,.txt" className="hidden" onChange={(event) => readFile(event, "left")} />
        <input ref={rightFileRef} type="file" accept=".json,.jsonc,.txt" className="hidden" onChange={(event) => readFile(event, "right")} />

        {workspaceTab === "editor" && editorMode !== "code" && leftParsed.value !== null && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-[#101419] px-3 py-2 text-xs">
            <span className="text-slate-500">Path</span>
            <code className="mr-auto truncate text-cyan-300">{selectedPath || "root"}</code>
            <ToolbarButton onClick={() => addNode(selectedPath)}><Plus className="h-4 w-4" />Add</ToolbarButton>
            {(selectedPath || selectedPaths.size) && (
              <>
                <ToolbarButton onClick={() => editNode(selectedPath)}>Edit</ToolbarButton>
                <ToolbarButton onClick={() => clearSelectedValues(selectedPaths.size ? selectedPaths : new Set([selectedPath]))}><Eraser className="h-4 w-4" />Clear</ToolbarButton>
                <ToolbarButton onClick={() => removePaths(selectedPaths.size ? selectedPaths : new Set([selectedPath]))}><Trash2 className="h-4 w-4" />Remove</ToolbarButton>
              </>
            )}
          </div>
        )}
        {storageNotice && (
          <div className="mb-3 rounded-md border border-yellow-900 bg-yellow-950/20 px-3 py-2 text-xs text-yellow-200">
            {storageNotice.replace(/\s\d+$/, "")}
          </div>
        )}

        {workspaceTab === "editor" && schemaPanelOpen && (
          <section className="mb-3 grid gap-3 rounded-lg border border-slate-800 bg-[#101419] p-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">JSON Schema validation</h2>
                  <p className="mt-1 text-xs text-slate-500">Paste a JSON Schema to validate the active document locally.</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={schemaEnabled} onChange={(event) => setSchemaEnabled(event.target.checked)} className="accent-cyan-400" />
                  Enabled
                </label>
              </div>
              <textarea
                value={schemaText}
                onChange={(event) => setSchemaText(event.target.value)}
                placeholder={'{\n  "type": "object",\n  "required": ["id"]\n}'}
                rows={8}
                className="w-full rounded-md border border-slate-700 bg-[#0b0d10] p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>
            <div className="max-h-64 overflow-auto rounded-md border border-slate-800 bg-[#0b0d10] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Problems</div>
              {schemaInputError ? (
                <div className="text-xs leading-5 text-red-300">{schemaInputError}</div>
              ) : !schemaEnabled ? (
                <div className="text-xs leading-5 text-slate-500">Enable validation after adding a schema.</div>
              ) : schemaErrors.length ? schemaErrors.map((error, index) => (
                <button key={`${error.instancePath}-${index}`} onClick={() => jumpToSchemaError(error)} className="mb-2 block w-full rounded border border-red-900/60 bg-red-950/20 p-2 text-left text-xs hover:border-red-700">
                  <code className="text-red-200">{jsonPointerToPath(error.instancePath) || "root"}</code>
                  <span className="mt-1 block text-red-300/80">{error.message}</span>
                </button>
              )) : (
                <div className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" />Document matches the schema.</div>
              )}
            </div>
          </section>
        )}

        {workspaceTab === "editor" && (
          <section className={`grid min-h-[calc(100vh-12rem)] gap-3 ${editorMode === "code" ? "" : "xl:grid-cols-[280px_minmax(0,1fr)]"}`}>
            {editorMode !== "code" && (
            <aside className="rounded-lg border border-slate-800 bg-[#101419] p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => setSearchExpanded(true)}
                  placeholder="Search JSON"
                  className="w-full rounded-md border border-slate-700 bg-[#0b0d10] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
              {searchExpanded && (
                <div className="mb-3 grid gap-2 rounded-md border border-slate-800 bg-[#0b0d10] p-2">
                  <select value={searchScope} onChange={(event) => setSearchScope(event.target.value)} className="rounded border border-slate-700 bg-[#101419] px-2 py-2 text-xs text-white">
                    <option value="all">Keys and values</option>
                    <option value="key">Keys only</option>
                    <option value="value">Values only</option>
                    <option value="path">Paths only</option>
                  </select>
                  <div className="flex gap-2">
                    <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Replace with" className="min-w-0 flex-1 rounded border border-slate-700 bg-[#101419] px-2 py-2 text-xs text-white outline-none focus:border-cyan-500" />
                    <button onClick={replaceAllMatches} disabled={!searchTerm.trim()} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40">Replace all</button>
                  </div>
                  {replaceNotice && <div className="text-[11px] leading-4 text-slate-500">{replaceNotice}</div>}
                </div>
              )}
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
            )}

            <div className="relative min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-[#101419]">
              {leftParsed.error && <div className="p-3"><ErrorMessage error={leftParsed.error} onJump={jumpToParseError} /></div>}
              {editorMode === "tree" && !leftParsed.error && (
                <TreeView value={leftParsed.value} selectedPath={selectedPath} selectedPaths={selectedPaths} matches={matches} onSelect={selectPath} onContextMenu={openContext} />
              )}
              {editorMode === "code" && (
                <div
                  className={`relative ${dropActive ? "ring-2 ring-inset ring-cyan-400" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); setDropActive(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={handleEditorDrop}
                >
                  {!leftText && <EmptyEditorState onPaste={pasteJSON} onOpen={() => leftFileRef.current?.click()} onSample={() => commitText(stringify(sampleLeft, 2))} />}
                  <Editor
                    height="calc(100vh - 15rem)"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={leftText}
                    onMount={handleEditorMount}
                    onChange={(value) => updateLeftTextFromEditor(value || "")}
                    options={{ minimap: { enabled: false }, fontSize: 14, tabSize: 2, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 12 } }}
                  />
                </div>
              )}
              {editorMode === "text" && (
                <div className="h-[calc(100vh-14rem)] overflow-auto p-3 font-mono">
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
                <div className="h-[calc(100vh-14rem)] overflow-auto p-3 font-mono">
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
              <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 bg-[#0b0d10] px-3 py-1.5 font-mono text-[11px] text-slate-500">
                <button onClick={leftParsed.error ? jumpToParseError : undefined} className={leftParsed.error ? "text-red-300 hover:text-red-200" : leftText ? "text-emerald-300" : ""}>
                  {leftParsed.error ? `Invalid JSON · ${leftParsed.error.line}:${leftParsed.error.column}` : leftText ? "Valid JSON" : "No document content"}
                </button>
                <span>{documentType}</span>
                <span>{leftParsed.index?.visited || 0} nodes</span>
                <span>{formatBytes(documentBytes)}</span>
                {schemaEnabled && <button onClick={() => setSchemaPanelOpen(true)} className={schemaErrors.length || schemaInputError ? "text-red-300" : "text-emerald-300"}>{schemaErrors.length || schemaInputError ? `${schemaErrors.length || 1} schema problem${schemaErrors.length === 1 ? "" : "s"}` : "Schema valid"}</button>}
                {editorMode === "code" && <span className="ml-auto">Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span>}
                <span className={editorMode === "code" ? "" : "ml-auto"}>Local only</span>
              </div>
            </div>
          </section>
        )}

        {workspaceTab === "query" && (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4 rounded-lg border border-slate-800 bg-[#101419] p-4">
              <div>
                <h1 className="text-base font-semibold text-white">Query JSON with live results</h1>
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
                  <ToolbarButton onClick={() => { const parsed = parseJSONDetailed(queryResult); if (!parsed.error) commitValue(parsed.value); }} disabled={Boolean(parseJSONDetailed(queryResult).error)}>Apply to document</ToolbarButton>
                </div>
              </div>
              <pre className="h-[38rem] overflow-auto p-4 font-mono text-sm text-slate-200">{queryResult}</pre>
            </div>
          </section>
        )}

        {workspaceTab === "redact" && (
          <section className="space-y-3">
            <div className="border border-slate-800 bg-[#101419] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-cyan-400" />
                    <h1 className="text-base font-semibold text-white">Remove secrets before sharing JSON</h1>
                  </div>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
                    Paste or import JSON, redact detected credentials, then copy or download the safe result. Everything stays in this browser.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ToolbarButton onClick={pasteRedactionJSON}>Paste JSON</ToolbarButton>
                  <ToolbarButton onClick={() => leftFileRef.current?.click()}><Upload className="h-4 w-4" />Import file</ToolbarButton>
                  <ToolbarButton onClick={() => {
                    commitValue(redactionSample);
                    setRedactionPreview(null);
                    setRedactionNotice("");
                  }}>Use example</ToolbarButton>
                  <ToolbarButton onClick={() => {
                    commitText("");
                    setRedactionPreview(null);
                    setRedactionNotice("");
                  }}>Clear</ToolbarButton>
                </div>
              </div>
            </div>

            <details className="border border-slate-800 bg-[#101419]">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white">
                Redaction rules
                <span className="ml-2 font-normal text-slate-500">Common credential keys and token formats are enabled</span>
              </summary>
              <div className="grid gap-4 border-t border-slate-800 p-4 lg:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
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
                  <input
                    value={redactionOptions.customKeys}
                    onChange={(event) => updateRedactionOptions({ customKeys: event.target.value })}
                    placeholder="pin, signingKey, connectionPassword"
                    className="w-full border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                  <span className="block leading-5 text-slate-500">Comma-separated. Matching ignores case, dashes, and underscores.</span>
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
                    <span className="mt-1 block leading-5 text-slate-500">Authorization values, JWTs, cloud tokens, private keys, and credential URLs.</span>
                  </span>
                </label>
              </div>
            </details>

            {redactionNotice && (
              <div className="border border-yellow-900 bg-yellow-950/20 px-3 py-2 text-xs text-yellow-200">{redactionNotice}</div>
            )}

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="min-w-0 border border-slate-800 bg-[#101419]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">1. Source JSON</h2>
                    <p className="mt-1 text-xs text-slate-500">Paste directly below or use Import file.</p>
                  </div>
                  <ToolbarButton onClick={runRedaction} active disabled={leftParsed.error || leftParsed.value === null}>
                    <ShieldCheck className="h-4 w-4" />Redact secrets
                  </ToolbarButton>
                </div>
                {leftParsed.error && <div className="p-3"><ErrorMessage error={leftParsed.error} /></div>}
                <div className="h-[34rem]">
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={leftText}
                    onChange={(value) => {
                      updateLeftTextFromEditor(value || "");
                      setRedactionPreview(null);
                      setRedactionNotice("");
                    }}
                    options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false }}
                  />
                </div>
              </div>

              <div className="min-w-0 border border-slate-800 bg-[#0c0f13]">
                <div className="flex min-h-[4.15rem] flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">2. Safe JSON</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {redactionPreview ? `${redactionPreview.matches.length} secret${redactionPreview.matches.length === 1 ? "" : "s"} replaced` : "Your redacted result will appear here."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ToolbarButton onClick={() => copyText(stringify(redactionPreview?.value, 2), "redacted")} disabled={!redactionPreview}>
                      <Copy className="h-4 w-4" />{copied === "redacted" ? "Copied" : "Copy"}
                    </ToolbarButton>
                    <ToolbarButton onClick={() => downloadText("redacted.json", stringify(redactionPreview?.value, 2))} disabled={!redactionPreview}>
                      <Download className="h-4 w-4" />Download
                    </ToolbarButton>
                    <ToolbarButton onClick={applyRedaction} disabled={!redactionPreview || redactionPreview.sourceText !== leftText}>
                      Replace source
                    </ToolbarButton>
                  </div>
                </div>
                {redactionPreview ? (
                  <div className="grid h-[34rem] min-h-0 lg:grid-cols-[minmax(0,1fr)_15rem]">
                    <pre className="overflow-auto p-4 text-sm text-slate-200">{stringify(redactionPreview.value, 2)}</pre>
                    <div className="overflow-auto border-t border-slate-800 p-3 lg:border-l lg:border-t-0">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">What changed</div>
                      {redactionPreview.matches.length ? redactionPreview.matches.map((match, index) => (
                        <div key={`${match.path}-${index}`} className="mb-2 border border-slate-800 bg-[#101419] p-2 text-xs">
                          <code className="break-all text-cyan-300">{match.path}</code>
                          <div className="mt-1 text-slate-500">{match.reason}</div>
                        </div>
                      )) : <div className="text-xs leading-5 text-slate-500">No secrets matched.</div>}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[34rem] items-center justify-center p-8 text-center">
                    <div>
                      <ShieldCheck className="mx-auto h-8 w-8 text-slate-700" />
                      <p className="mt-3 text-sm text-slate-400">Add valid JSON, then click Redact secrets.</p>
                      <p className="mt-2 text-xs text-slate-600">Detected paths are listed without exposing original values.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {workspaceTab === "compare" && (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="sticky top-14 z-40 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#101419] p-2 shadow-lg shadow-black/20 xl:col-span-2">
              <button onClick={() => setCompareMode("text")} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${compareMode === "text" ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-900"}`}><Code2 className="h-4 w-4" />Edit inputs</button>
              <button onClick={() => setCompareMode("diff")} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${compareMode === "diff" ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-900"}`}><GitCompare className="h-4 w-4" />Text diff</button>
              <button onClick={() => setCompareMode("tree")} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${compareMode === "tree" ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-900"}`}><ListTree className="h-4 w-4" />Semantic tree</button>
              <span className="hidden text-xs text-slate-500 lg:inline">Edit both sides, compare, then review as text or by JSON path.</span>
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
            <div className="grid items-end gap-2 rounded-lg border border-slate-800 bg-[#101419] p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:col-span-2">
              <label className="grid min-w-0 gap-1.5 text-xs text-slate-500">
                Left document
                <select
                  value={activeDocumentId}
                  onChange={(event) => selectCompareLeftDocument(event.target.value)}
                  className="min-w-0 rounded-md border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
                </select>
              </label>
              <button
                onClick={swapCompareSides}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-xs text-slate-300 hover:border-cyan-700 hover:bg-slate-900 hover:text-cyan-200"
                title="Swap comparison sides"
              >
                <ArrowLeftRight className="h-4 w-4" /><span className="sm:hidden">Swap sides</span>
              </button>
              <label className="grid min-w-0 gap-1.5 text-xs text-slate-500">
                Right document
                <select
                  value={rightDocumentId}
                  onChange={(event) => selectCompareRightDocument(event.target.value)}
                  className="min-w-0 rounded-md border border-slate-700 bg-[#0b0d10] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value="">Temporary input</option>
                  {documents.filter((document) => document.id !== activeDocumentId).map((document) => (
                    <option key={document.id} value={document.id}>{document.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {compareMode === "diff" && (
              <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#101419] xl:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Side-by-side text diff</h2>
                    <p className="mt-1 text-xs text-slate-500">Left is the original; right is the modified document.</p>
                  </div>
                  <ToolbarButton onClick={() => setCompareMode("text")}>Edit inputs</ToolbarButton>
                </div>
                <DiffEditor
                  height="38rem"
                  language="json"
                  theme="vs-dark"
                  original={leftText}
                  modified={rightText}
                  options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true, scrollBeyondLastLine: false }}
                />
              </div>
            )}
            {compareMode !== "diff" && (
            <>
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#101419]">
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
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#101419]">
              <div className="flex items-center justify-between border-b border-slate-800 p-3">
                <h2 className="text-sm font-semibold text-white">Right JSON</h2>
                <ToolbarButton onClick={() => rightFileRef.current?.click()} title="Open a temporary right-side file"><Upload className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="h-[34rem]">
                {compareMode === "text" ? (
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={rightText}
                    onChange={(value) => {
                      setRightDocumentId("");
                      setRightText(value || "");
                    }}
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
            </>
            )}
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
