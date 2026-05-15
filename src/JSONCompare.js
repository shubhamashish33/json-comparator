import { Analytics } from "@vercel/analytics/react";
import Editor from "@monaco-editor/react";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clipboard,
  Copy,
  Download,
  FileJson,
  Filter,
  GitCompare,
  Home,
  Link2,
  Maximize2,
  Minimize2,
  Pin,
  RotateCcw,
  Search,
  Settings2,
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
  searchInObject,
  toJsonPatch,
  validateAgainstSchema,
} from "./jsonUtils";

const STORAGE_KEYS = {
  json1: "json-comparator-json1",
  json2: "json-comparator-json2",
  settings: "json-comparator-settings",
  editor: "json-comparator-editor-settings",
  schema: "json-comparator-schema",
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

const defaultEditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: "on",
  minimap: false,
  autoFormatOnPaste: true,
  theme: "vs-dark",
};

const sampleJSON1 = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  address: {
    city: "New York",
    country: "USA",
    zipCode: "10001",
  },
  hobbies: ["reading", "gaming"],
  metadata: {
    requestId: "abc-1",
    updatedAt: "2026-01-01T10:00:00Z",
  },
};

const sampleJSON2 = {
  name: "John Doe",
  age: 31,
  email: "john.doe@example.com",
  address: {
    city: "Los Angeles",
    country: "USA",
    zipCode: "90001",
  },
  hobbies: ["reading", "coding", "gaming"],
  metadata: {
    requestId: "abc-2",
    updatedAt: "2026-01-01T10:00:01Z",
  },
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const safeJsonStringify = (value, spacing = 2) => {
  try {
    return JSON.stringify(value, null, spacing);
  } catch {
    return String(value);
  }
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
    <div className="mt-2 flex items-start gap-2 text-red-400 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>
        {error.message}
        {error.line ? ` at line ${error.line}, column ${error.column}` : ""}
      </span>
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">{children}</label>
);

const TreeNode = memo(
  ({
    nodeKey,
    value,
    path,
    diffMap,
    isLeft,
    level = 0,
    pinnedPath,
    selectedPath,
    searchMatches,
    searchTerm,
    currentMatchIndex,
    expandedPaths,
    globalExpandToggle,
    globalExpandAction,
    onHover,
    onPin,
  }) => {
    const nodeRef = useRef(null);
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const isObject = value && typeof value === "object" && !Array.isArray(value);
    const isArray = Array.isArray(value);
    const hasChildren = isObject || isArray;
    const diff = diffMap.get(path);
    const diffStatus =
      diff?.type === "added" && !isLeft
        ? "added"
        : diff?.type === "removed" && isLeft
          ? "removed"
          : diff?.type === "modified"
            ? "modified"
            : null;
    const isPinned = pinnedPath === path;
    const isSelected = selectedPath === path;
    const isCurrentMatch = searchMatches[currentMatchIndex]?.path === path;
    const isMatch = searchMatches.some((match) => match.path === path);

    useEffect(() => {
      if (expandedPaths.has(path)) setIsExpanded(true);
    }, [expandedPaths, path]);

    useEffect(() => {
      if (globalExpandToggle > 0) setIsExpanded(globalExpandAction === "expand");
    }, [globalExpandAction, globalExpandToggle]);

    const highlightText = useCallback(
      (text) => {
        if (!searchTerm) return text;
        const source = String(text);
        const lower = source.toLowerCase();
        const target = searchTerm.toLowerCase();
        if (!lower.includes(target)) return source;
        const parts = [];
        let start = 0;
        let index = lower.indexOf(target);
        while (index !== -1) {
          if (index > start) parts.push(source.slice(start, index));
          parts.push(
            <mark key={`${source}-${index}`} className="bg-yellow-400 text-black rounded px-0.5">
              {source.slice(index, index + target.length)}
            </mark>
          );
          start = index + target.length;
          index = lower.indexOf(target, start);
        }
        if (start < source.length) parts.push(source.slice(start));
        return parts;
      },
      [searchTerm]
    );

    const valuePreview = useMemo(() => {
      if (isArray) return <span className="text-purple-400">[{isExpanded ? "" : `...${value.length} items`}]</span>;
      if (isObject) return <span className="text-purple-400">{"{"}{isExpanded ? "" : "..."}{"}"}</span>;
      return <span className="text-emerald-400">{highlightText(safeJsonStringify(value, 0))}</span>;
    }, [highlightText, isArray, isExpanded, isObject, value]);

    const rowTone = diffStatus === "added"
      ? "bg-green-500/10 text-green-200"
      : diffStatus === "removed"
        ? "bg-red-500/10 text-red-200"
        : diffStatus === "modified"
          ? "bg-yellow-500/10 text-yellow-200"
          : "";

    return (
      <div className="font-mono text-sm">
        <div
          ref={nodeRef}
          data-path={path}
          onMouseEnter={() => onHover(path)}
          onMouseLeave={() => !isPinned && onHover("")}
          onClick={() => hasChildren && setIsExpanded((current) => !current)}
          className={`group flex min-h-8 items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-slate-700/40 ${rowTone} ${
            isSelected ? "ring-2 ring-purple-500" : isCurrentMatch ? "ring-2 ring-yellow-400" : isPinned ? "ring-1 ring-purple-500/70" : isMatch ? "ring-1 ring-yellow-500/40" : ""
          }`}
          style={{ paddingLeft: `${level * 18 + 8}px` }}
        >
          <span className="w-4 flex-shrink-0 text-purple-400">
            {hasChildren ? isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" /> : null}
          </span>
          <span className="text-blue-300">{highlightText(String(nodeKey))}:</span>
          <span className="ml-1 min-w-0 break-all">{valuePreview}</span>
          {diffStatus && (
            <span className="ml-2 rounded bg-slate-950/40 px-1.5 py-0.5 text-xs font-bold uppercase">{diffStatus}</span>
          )}
          {isCurrentMatch && <span className="ml-2 rounded bg-yellow-500/70 px-1.5 py-0.5 text-xs font-bold text-black">current</span>}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPin(path);
            }}
            title={isPinned ? "Unpin path" : "Pin path"}
            className={`ml-auto rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-purple-300 ${isPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <Pin className="w-3 h-3" />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {Object.entries(value).map(([key, child]) => (
              <TreeNode
                key={`${path}.${key}`}
                nodeKey={key}
                value={child}
                path={Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key}
                diffMap={diffMap}
                isLeft={isLeft}
                level={level + 1}
                pinnedPath={pinnedPath}
                selectedPath={selectedPath}
                searchMatches={searchMatches}
                searchTerm={searchTerm}
                currentMatchIndex={currentMatchIndex}
                expandedPaths={expandedPaths}
                globalExpandToggle={globalExpandToggle}
                globalExpandAction={globalExpandAction}
                onHover={onHover}
                onPin={onPin}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

TreeNode.displayName = "TreeNode";

const JSONTree = memo(
  ({
    title,
    data,
    diffMap,
    isLeft,
    pinnedPath,
    hoveredPath,
    selectedPath,
    searchTerm,
    currentMatchIndex,
    searchMatches,
    expandedPaths,
    globalExpandToggle,
    globalExpandAction,
    onHover,
    onPin,
    onClearPin,
    onExpandAll,
    onCollapseAll,
    scrollRef,
    onSearchChange,
    onSearchKeyDown,
  }) => {
    if (data === null || data === undefined) {
      return <div className="rounded-lg bg-slate-900/70 p-6 text-center text-slate-500">No parsed JSON yet</div>;
    }

    const shownPath = pinnedPath || hoveredPath;
    const roots = Array.isArray(data)
      ? data.map((value, index) => [index, value, `[${index}]`])
      : data && typeof data === "object"
        ? Object.entries(data).map(([key, value]) => [key, value, key])
        : [["root", data, "root"]];

    return (
      <div className="h-full">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-700/70 pb-3">
          <div className="min-w-0">
            <h4 className="text-lg font-semibold text-white">{title}</h4>
            {shownPath ? (
              <div className="mt-1 flex items-center gap-2 rounded bg-slate-950/60 px-2 py-1">
                <Pin className="w-3 h-3 flex-shrink-0 text-purple-400" />
                <code className="truncate text-xs text-purple-300">{shownPath}</code>
                <button title="Copy path" onClick={() => navigator.clipboard.writeText(shownPath)} className="rounded p-1 text-slate-300 hover:bg-slate-700">
                  <Copy className="w-3 h-3" />
                </button>
                <button title="Clear path" onClick={onClearPin} className="rounded p-1 text-slate-300 hover:bg-slate-700">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Hover or pin a node to inspect its path.</p>
            )}
          </div>
          <div className="flex flex-shrink-0 gap-1">
            <button title="Expand all" onClick={onExpandAll} className="rounded bg-slate-700/60 p-1.5 text-slate-200 hover:bg-slate-600">
              <ChevronsDownUp className="w-4 h-4" />
            </button>
            <button title="Collapse all" onClick={onCollapseAll} className="rounded bg-slate-700/60 p-1.5 text-slate-200 hover:bg-slate-600">
              <ChevronsUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mb-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isLeft ? "text-purple-400" : "text-blue-400"}`} />
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search keys or values"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-500"
            />
          </div>
          {searchTerm && (
            <div className="mt-1 text-xs text-yellow-300">
              {searchMatches.length} match(es){searchMatches.length ? `, ${currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0}/${searchMatches.length}` : ""}
            </div>
          )}
        </div>
        <div ref={scrollRef} className="max-h-[620px] overflow-auto rounded-lg bg-slate-950/70 p-2">
          {roots.map(([key, value, rootPath]) => (
            <TreeNode
              key={key}
              nodeKey={key}
              value={value}
              path={rootPath}
              diffMap={diffMap}
              isLeft={isLeft}
              pinnedPath={pinnedPath}
              selectedPath={selectedPath}
              searchMatches={searchMatches}
              searchTerm={searchTerm}
              currentMatchIndex={currentMatchIndex}
              expandedPaths={expandedPaths}
              globalExpandToggle={globalExpandToggle}
              globalExpandAction={globalExpandAction}
              onHover={onHover}
              onPin={onPin}
            />
          ))}
        </div>
      </div>
    );
  }
);

JSONTree.displayName = "JSONTree";

const EditorPanel = ({
  side,
  title,
  value,
  setValue,
  error,
  setError,
  fileName,
  setFileName,
  dragOver,
  setDragOver,
  editorSettings,
  onEditorMount,
  onFormat,
  onMinify,
  onRepair,
  onPaste,
  onCopy,
  onUpload,
  inputRef,
  isMinified,
}) => {
  const tone = side === "left" ? "purple" : "blue";
  return (
    <div className={`rounded-xl border border-${tone}-500/30 bg-slate-800/50 p-4 backdrop-blur`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-${tone}-600 text-sm`}>{side === "left" ? "1" : "2"}</span>
            {title}
          </h3>
          {fileName && (
            <div className={`mt-2 flex items-center gap-2 text-sm text-${tone}-300`}>
              <FileJson className="w-4 h-4" />
              <span className="truncate">{fileName}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={onPaste} className="rounded bg-slate-700/70 px-3 py-1 text-sm text-white hover:bg-slate-600">
            <Clipboard className="inline h-3 w-3" /> Paste
          </button>
          <button onClick={() => inputRef.current?.click()} className={`rounded bg-${tone}-600/60 px-3 py-1 text-sm text-white hover:bg-${tone}-600`}>
            <Upload className="inline h-3 w-3" /> Upload
          </button>
          <button onClick={onFormat} className={`rounded bg-${tone}-600/60 px-3 py-1 text-sm text-white hover:bg-${tone}-600`}>Format</button>
          <button onClick={onMinify} title={isMinified ? "Expand" : "Minify"} className={`rounded bg-${tone}-600/60 px-3 py-1 text-sm text-white hover:bg-${tone}-600`}>
            {isMinified ? <Maximize2 className="inline h-3 w-3" /> : <Minimize2 className="inline h-3 w-3" />}
          </button>
          <button onClick={onRepair} title="Repair common JSON-ish input" className={`rounded bg-${tone}-600/60 px-3 py-1 text-sm text-white hover:bg-${tone}-600`}>
            <Wand2 className="inline h-3 w-3" />
          </button>
          <button onClick={onCopy} className={`rounded bg-${tone}-600/60 px-3 py-1 text-sm text-white hover:bg-${tone}-600`}>
            <Copy className="inline h-3 w-3" />
          </button>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".json,.jsonc,.txt" className="hidden" onChange={onUpload} />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const content = readerEvent.target.result;
            setValue(content);
            setFileName(file.name);
            setError(parseJSONDetailed(content).error);
          };
          reader.readAsText(file);
        }}
        className={`relative ${dragOver ? `ring-2 ring-${tone}-500` : ""}`}
      >
        <div className="h-80 overflow-hidden rounded-lg border border-slate-700 bg-[#1e1e1e]">
          <Editor
            height="100%"
            defaultLanguage="json"
            theme={editorSettings.theme}
            value={value}
            onMount={onEditorMount}
            onChange={(nextValue) => {
              const text = nextValue || "";
              setValue(text);
              setError(parseJSONDetailed(text).error);
            }}
            options={{
              minimap: { enabled: editorSettings.minimap },
              fontSize: editorSettings.fontSize,
              tabSize: editorSettings.tabSize,
              wordWrap: editorSettings.wordWrap,
              formatOnPaste: editorSettings.autoFormatOnPaste,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
        {dragOver && (
          <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-${tone}-600/20`}>
            <div className="rounded-xl bg-slate-950/90 p-5 text-white">Drop JSON file here</div>
          </div>
        )}
      </div>
      <ErrorMessage error={error} />
      {!error && value && (
        <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="w-4 h-4" />
          Valid JSON
        </div>
      )}
    </div>
  );
};

const JSONCompare = () => {
  const navigate = useNavigate();
  const [json1, setJson1] = useState("");
  const [json2, setJson2] = useState("");
  const [error1, setError1] = useState(null);
  const [error2, setError2] = useState(null);
  const [fileName1, setFileName1] = useState("");
  const [fileName2, setFileName2] = useState("");
  const [parsedJson1, setParsedJson1] = useState(null);
  const [parsedJson2, setParsedJson2] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [settings, setSettings] = useState(defaultSettings);
  const [editorSettings, setEditorSettings] = useState(defaultEditorSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [schemaText, setSchemaText] = useState("");
  const [schemaErrors1, setSchemaErrors1] = useState([]);
  const [schemaErrors2, setSchemaErrors2] = useState([]);
  const [showSchema, setShowSchema] = useState(false);
  const [showFetch, setShowFetch] = useState(false);
  const [fetchConfig, setFetchConfig] = useState({ target: "left", url: "", method: "GET", headers: "", body: "" });
  const [activeDiffIndex, setActiveDiffIndex] = useState(-1);
  const [selectedDiffPath, setSelectedDiffPath] = useState("");
  const [hoveredPath1, setHoveredPath1] = useState("");
  const [hoveredPath2, setHoveredPath2] = useState("");
  const [pinnedPath1, setPinnedPath1] = useState("");
  const [pinnedPath2, setPinnedPath2] = useState("");
  const [searchTerm1, setSearchTerm1] = useState("");
  const [searchTerm2, setSearchTerm2] = useState("");
  const [currentMatchIndex1, setCurrentMatchIndex1] = useState(-1);
  const [currentMatchIndex2, setCurrentMatchIndex2] = useState(-1);
  const [dragOver1, setDragOver1] = useState(false);
  const [dragOver2, setDragOver2] = useState(false);
  const [isMinified1, setIsMinified1] = useState(false);
  const [isMinified2, setIsMinified2] = useState(false);
  const [copied, setCopied] = useState("");
  const [globalExpandToggle, setGlobalExpandToggle] = useState(0);
  const [globalExpandAction, setGlobalExpandAction] = useState("auto");
  const [activeResultTab, setActiveResultTab] = useState("tree");

  const editor1Ref = useRef(null);
  const editor2Ref = useRef(null);
  const fileInput1Ref = useRef(null);
  const fileInput2Ref = useRef(null);
  const scrollRef1 = useRef(null);
  const scrollRef2 = useRef(null);

  const debouncedSearchTerm1 = useDebounce(searchTerm1, 300);
  const debouncedSearchTerm2 = useDebounce(searchTerm2, 300);
  const diffMap = useMemo(() => new Map(comparison.map((diff) => [diff.path, diff])), [comparison]);
  const patch = useMemo(() => toJsonPatch(comparison), [comparison]);
  const stats = useMemo(
    () => ({
      total: comparison.length,
      added: comparison.filter((diff) => diff.type === "added").length,
      removed: comparison.filter((diff) => diff.type === "removed").length,
      modified: comparison.filter((diff) => diff.type === "modified").length,
    }),
    [comparison]
  );

  const filteredComparison = useMemo(() => {
    return comparison.filter((diff) => {
      return filterType === "all" || diff.type === filterType;
    });
  }, [comparison, filterType]);

  const searchMatches1 = useMemo(() => (debouncedSearchTerm1 && parsedJson1 ? searchInObject(parsedJson1, debouncedSearchTerm1) : []), [debouncedSearchTerm1, parsedJson1]);
  const searchMatches2 = useMemo(() => (debouncedSearchTerm2 && parsedJson2 ? searchInObject(parsedJson2, debouncedSearchTerm2) : []), [debouncedSearchTerm2, parsedJson2]);

  const expandedPaths1 = useMemo(() => {
    const paths = new Set();
    searchMatches1.forEach((match) => {
      match.parents.forEach((parent) => paths.add(parent));
      paths.add(match.path);
    });
    if (selectedDiffPath) selectedDiffPath.match(/[^.[\]]+|\[[^\]]+\]/g)?.reduce((current, token) => {
      const clean = token.replace(/^\[|\]$/g, "");
      const next = current ? (/^\d+$/.test(clean) ? `${current}[${clean}]` : `${current}.${clean}`) : clean;
      paths.add(next);
      return next;
    }, "");
    return paths;
  }, [searchMatches1, selectedDiffPath]);

  const expandedPaths2 = useMemo(() => {
    const paths = new Set();
    searchMatches2.forEach((match) => {
      match.parents.forEach((parent) => paths.add(parent));
      paths.add(match.path);
    });
    if (selectedDiffPath) selectedDiffPath.match(/[^.[\]]+|\[[^\]]+\]/g)?.reduce((current, token) => {
      const clean = token.replace(/^\[|\]$/g, "");
      const next = current ? (/^\d+$/.test(clean) ? `${current}[${clean}]` : `${current}.${clean}`) : clean;
      paths.add(next);
      return next;
    }, "");
    return paths;
  }, [searchMatches2, selectedDiffPath]);

  useEffect(() => {
    try {
      setSettings({ ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}") });
      setEditorSettings({ ...defaultEditorSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.editor) || "{}") });
      setJson1(localStorage.getItem(STORAGE_KEYS.json1) || "");
      setJson2(localStorage.getItem(STORAGE_KEYS.json2) || "");
      setSchemaText(localStorage.getItem(STORAGE_KEYS.schema) || "");
    } catch {
      // Ignore corrupted local state and let the app continue with defaults.
    }
  }, []);

  useEffect(() => {
    if (json1) localStorage.setItem(STORAGE_KEYS.json1, json1);
    else localStorage.removeItem(STORAGE_KEYS.json1);
    if (json2) localStorage.setItem(STORAGE_KEYS.json2, json2);
    else localStorage.removeItem(STORAGE_KEYS.json2);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEYS.editor, JSON.stringify(editorSettings));
    localStorage.setItem(STORAGE_KEYS.schema, schemaText);
  }, [editorSettings, json1, json2, schemaText, settings]);

  const compare = useCallback(() => {
    const left = parseJSONDetailed(json1);
    const right = parseJSONDetailed(json2);
    setError1(left.error);
    setError2(right.error);
    if (left.error || right.error || left.value === null || right.value === null) return;

    const diffs = compareJSONValues(left.value, right.value, settings);
    let schema1 = [];
    let schema2 = [];
    if (schemaText.trim()) {
      const schemaResult = parseJSONDetailed(schemaText);
      if (!schemaResult.error) {
        schema1 = validateAgainstSchema(left.value, schemaResult.value);
        schema2 = validateAgainstSchema(right.value, schemaResult.value);
      }
    }

    setParsedJson1(left.value);
    setParsedJson2(right.value);
    setComparison(diffs);
    setSchemaErrors1(schema1);
    setSchemaErrors2(schema2);
    setShowComparison(true);
    setActiveDiffIndex(diffs.length ? 0 : -1);
    setSelectedDiffPath(diffs[0]?.path || "");
  }, [json1, json2, schemaText, settings]);

  const focusDiff = useCallback((index) => {
    const diff = comparison[index];
    if (!diff) return;
    setActiveDiffIndex(index);
    setSelectedDiffPath(diff.path);
    setPinnedPath1(diff.path);
    setPinnedPath2(diff.path);
    setTimeout(() => {
      [scrollRef1.current, scrollRef2.current].forEach((root) => {
        const selector = `[data-path="${diff.path.replace(/"/g, '\\"')}"]`;
        const target = root?.querySelector(selector);
        if (!root || !target) return;

        const rootRect = root.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextTop = root.scrollTop + targetRect.top - rootRect.top - root.clientHeight / 2 + targetRect.height / 2;
        root.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      });
    }, 150);
  }, [comparison]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "enter") {
        event.preventDefault();
        compare();
      }
      if (key === "arrowdown" && comparison.length) {
        event.preventDefault();
        focusDiff((activeDiffIndex + 1 + comparison.length) % comparison.length);
      }
      if (key === "arrowup" && comparison.length) {
        event.preventDefault();
        focusDiff((activeDiffIndex - 1 + comparison.length) % comparison.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDiffIndex, compare, comparison.length, focusDiff]);

  const copyToClipboard = useCallback((text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(""), 1500);
    });
  }, []);

  const readFile = useCallback((event, setValue, setError, setFileName) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const content = readerEvent.target.result;
      setValue(content);
      setFileName(file.name);
      setError(parseJSONDetailed(content).error);
    };
    reader.readAsText(file);
    event.target.value = "";
  }, []);

  const formatJSON = useCallback((value, setValue, setError) => {
    const result = parseJSONDetailed(value);
    setError(result.error);
    if (!result.error) setValue(safeJsonStringify(result.value, 2));
  }, []);

  const minifyJSON = useCallback((value, setValue, setError, isMinified, setIsMinified) => {
    const result = parseJSONDetailed(value);
    setError(result.error);
    if (!result.error) {
      setValue(safeJsonStringify(result.value, isMinified ? 2 : 0));
      setIsMinified(!isMinified);
    }
  }, []);

  const repairInput = useCallback((value, setValue, setError) => {
    const repaired = repairJSONish(value);
    setValue(repaired);
    setError(parseJSONDetailed(repaired).error);
  }, []);

  const pasteInto = useCallback(async (setValue, setError, setFileName, label) => {
    const text = await navigator.clipboard.readText();
    setValue(text);
    setFileName(label);
    setError(parseJSONDetailed(text).error);
  }, []);

  const reset = useCallback(() => {
    setJson1("");
    setJson2("");
    setError1(null);
    setError2(null);
    setParsedJson1(null);
    setParsedJson2(null);
    setComparison([]);
    setShowComparison(false);
    setFileName1("");
    setFileName2("");
    setPinnedPath1("");
    setPinnedPath2("");
    setSelectedDiffPath("");
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key !== STORAGE_KEYS.settings && key !== STORAGE_KEYS.editor) localStorage.removeItem(key);
    });
  }, []);

  const fetchRemote = useCallback(async () => {
    try {
      const headers = fetchConfig.headers.trim() ? JSON.parse(fetchConfig.headers) : {};
      const response = await fetch(fetchConfig.url, {
        method: fetchConfig.method,
        headers,
        body: fetchConfig.method === "GET" ? undefined : fetchConfig.body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const text = safeJsonStringify(data, 2);
      if (fetchConfig.target === "left") {
        setJson1(text);
        setFileName1(fetchConfig.url.split("/").pop() || "fetched-left.json");
        setError1(null);
      } else {
        setJson2(text);
        setFileName2(fetchConfig.url.split("/").pop() || "fetched-right.json");
        setError2(null);
      }
      setShowFetch(false);
    } catch (error) {
      if (fetchConfig.target === "left") setError1({ message: error.message });
      else setError2({ message: error.message });
    }
  }, [fetchConfig]);

  const resultValue = selectedDiffPath ? {
    left: getValueAtPath(parsedJson1, selectedDiffPath),
    right: getValueAtPath(parsedJson2, selectedDiffPath),
  } : null;

  return (
    <div className="min-h-screen bg-slate-950 pb-10 font-sans text-slate-200 selection:bg-purple-500/30">
      <Analytics />
      <nav className="fixed top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[120rem] items-center justify-between px-4 sm:px-6">
          <div className="flex cursor-pointer items-center gap-2 transition-transform hover:scale-105" onClick={() => navigate("/")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
              <GitCompare className="h-5 w-5 text-white" />
            </div>
            <span className="hidden text-xl font-bold tracking-tight text-white sm:block">JSON<span className="text-purple-400">Sync</span></span>
          </div>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[120rem] px-4 pt-24 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">JSON Workspace</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-400">Compare payloads, validate shape, export patches, and navigate nested drift quickly.</p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => { setJson1(safeJsonStringify(sampleJSON1, 2)); setJson2(safeJsonStringify(sampleJSON2, 2)); setFileName1("sample-left.json"); setFileName2("sample-right.json"); }} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-white hover:bg-slate-700">
            <Copy className="h-4 w-4 text-purple-400" /> Load Sample
          </button>
          <button onClick={() => { setJson1(json2); setJson2(json1); setFileName1(fileName2); setFileName2(fileName1); }} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-white hover:bg-slate-700">
            <ArrowLeftRight className="h-4 w-4 text-blue-400" /> Swap
          </button>
          <button onClick={compare} className="flex items-center gap-2 rounded-full bg-purple-600 px-8 py-2.5 font-bold tracking-wide text-white shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)] hover:bg-purple-500">
            <GitCompare className="h-4 w-4" /> Compare Now
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-white hover:bg-slate-700">
            <Settings2 className="h-4 w-4 text-purple-400" /> Settings
          </button>
          <button onClick={() => setShowSchema((current) => !current)} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-white hover:bg-slate-700">
            <FileJson className="h-4 w-4 text-green-400" /> Schema
          </button>
          <button onClick={() => setShowFetch((current) => !current)} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-white hover:bg-slate-700">
            <Link2 className="h-4 w-4 text-blue-400" /> Request
          </button>
          <button onClick={reset} className="flex items-center gap-2 rounded-full border border-red-900/50 bg-red-900/40 px-5 py-2.5 text-red-200 hover:bg-red-900/60">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-purple-500/30 bg-slate-800 p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-white"><Settings2 className="h-5 w-5 text-purple-400" /> Workspace Settings</h2>
                <button onClick={() => setShowSettings(false)} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">Comparison</h3>
                  {[
                    ["ignoreCase", "Ignore string case"],
                    ["ignoreKeyCase", "Ignore key case"],
                    ["stringNumberEquivalence", "Treat numeric strings as numbers"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 text-sm text-slate-200">
                      <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} />
                      {label}
                    </label>
                  ))}
                  <div>
                    <FieldLabel>Number Tolerance</FieldLabel>
                    <input type="number" min="0" step="0.0001" value={settings.numberTolerance} onChange={(event) => setSettings({ ...settings, numberTolerance: Number(event.target.value) || 0 })} className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-white outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <FieldLabel>Array Mode</FieldLabel>
                    <select value={settings.arrayMode} onChange={(event) => setSettings({ ...settings, arrayMode: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-white outline-none focus:border-purple-500">
                      <option value="index">Compare by index</option>
                      <option value="ignore-order">Ignore order</option>
                      <option value="match-key">Match objects by key</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Array Match Key</FieldLabel>
                    <input value={settings.arrayMatchKey} onChange={(event) => setSettings({ ...settings, arrayMatchKey: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-white outline-none focus:border-purple-500" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">Editor</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Font Size</FieldLabel>
                      <input type="number" min="10" max="24" value={editorSettings.fontSize} onChange={(event) => setEditorSettings({ ...editorSettings, fontSize: Number(event.target.value) || 13 })} className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
                    </div>
                    <div>
                      <FieldLabel>Tab Size</FieldLabel>
                      <input type="number" min="2" max="8" value={editorSettings.tabSize} onChange={(event) => setEditorSettings({ ...editorSettings, tabSize: Number(event.target.value) || 2 })} className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-sm text-slate-200">
                    <input type="checkbox" checked={editorSettings.minimap} onChange={(event) => setEditorSettings({ ...editorSettings, minimap: event.target.checked })} />
                    Show minimap
                  </label>
                  <label className="flex items-center gap-3 text-sm text-slate-200">
                    <input type="checkbox" checked={editorSettings.autoFormatOnPaste} onChange={(event) => setEditorSettings({ ...editorSettings, autoFormatOnPaste: event.target.checked })} />
                    Format on paste
                  </label>
                  <div>
                    <FieldLabel>Word Wrap</FieldLabel>
                    <select value={editorSettings.wordWrap} onChange={(event) => setEditorSettings({ ...editorSettings, wordWrap: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-white">
                      <option value="on">On</option>
                      <option value="off">Off</option>
                      <option value="wordWrapColumn">Column</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Ignore Paths</FieldLabel>
                    <textarea value={settings.ignorePaths} onChange={(event) => setSettings({ ...settings, ignorePaths: event.target.value })} rows={3} placeholder="metadata.updatedAt&#10;/^debug\\./" className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <FieldLabel>Include Paths</FieldLabel>
                    <textarea value={settings.includePaths} onChange={(event) => setSettings({ ...settings, includePaths: event.target.value })} rows={3} placeholder="users&#10;address.city" className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setSettings(defaultSettings)} className="rounded bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600">Reset Settings</button>
                <button onClick={() => { setShowSettings(false); if (showComparison) compare(); }} className="rounded bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">Apply</button>
              </div>
            </div>
          </div>
        )}

        {showSchema && (
          <section className="mb-6 rounded-xl border border-green-500/30 bg-slate-800/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">JSON Schema Validation</h3>
              <button onClick={() => setSchemaText("")} className="text-sm text-slate-400 hover:text-white">Clear</button>
            </div>
            <textarea value={schemaText} onChange={(event) => setSchemaText(event.target.value)} rows={6} placeholder='{"type":"object","required":["id"],"properties":{"id":{"type":"string"}}}' className="w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 font-mono text-sm text-white outline-none focus:border-green-500" />
            {(schemaErrors1.length > 0 || schemaErrors2.length > 0) && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[["First JSON", schemaErrors1], ["Second JSON", schemaErrors2]].map(([label, errors]) => (
                  <div key={label} className="rounded-lg bg-slate-950/60 p-3">
                    <div className="mb-2 text-sm font-semibold text-white">{label}: {errors.length} schema issue(s)</div>
                    {errors.slice(0, 8).map((error, index) => <div key={`${error.path}-${index}`} className="text-xs text-red-300"><code>{error.path}</code> - {error.message}</div>)}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {showFetch && (
          <section className="mb-6 rounded-xl border border-blue-500/30 bg-slate-800/50 p-4">
            <div className="grid gap-3 md:grid-cols-[120px_120px_1fr_auto]">
              <select value={fetchConfig.target} onChange={(event) => setFetchConfig({ ...fetchConfig, target: event.target.value })} className="rounded border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
                <option value="left">First</option>
                <option value="right">Second</option>
              </select>
              <select value={fetchConfig.method} onChange={(event) => setFetchConfig({ ...fetchConfig, method: event.target.value })} className="rounded border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
              </select>
              <input value={fetchConfig.url} onChange={(event) => setFetchConfig({ ...fetchConfig, url: event.target.value })} placeholder="https://api.example.com/data" className="rounded border border-slate-700 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-blue-500" />
              <button onClick={fetchRemote} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">Fetch</button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <textarea value={fetchConfig.headers} onChange={(event) => setFetchConfig({ ...fetchConfig, headers: event.target.value })} rows={3} placeholder='Headers JSON, e.g. {"Authorization":"Bearer token"}' className="rounded border border-slate-700 bg-slate-950/70 p-3 font-mono text-sm text-white" />
              <textarea value={fetchConfig.body} onChange={(event) => setFetchConfig({ ...fetchConfig, body: event.target.value })} rows={3} placeholder="Request body for POST/PUT" className="rounded border border-slate-700 bg-slate-950/70 p-3 font-mono text-sm text-white" />
            </div>
          </section>
        )}

        <section className={`grid gap-4 ${showComparison ? "xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : "md:grid-cols-2"}`}>
          <div className={`grid gap-4 ${showComparison ? "" : "md:col-span-2 md:grid-cols-2"}`}>
            <EditorPanel
              side="left"
              title="First JSON"
              value={json1}
              setValue={setJson1}
              error={error1}
              setError={setError1}
              fileName={fileName1}
              setFileName={setFileName1}
              dragOver={dragOver1}
              setDragOver={setDragOver1}
              editorSettings={editorSettings}
              onEditorMount={(editor) => { editor1Ref.current = editor; }}
              onFormat={() => formatJSON(json1, setJson1, setError1)}
              onMinify={() => minifyJSON(json1, setJson1, setError1, isMinified1, setIsMinified1)}
              onRepair={() => repairInput(json1, setJson1, setError1)}
              onPaste={() => pasteInto(setJson1, setError1, setFileName1, "Pasted JSON 1")}
              onCopy={() => copyToClipboard(json1, "json1")}
              onUpload={(event) => readFile(event, setJson1, setError1, setFileName1)}
              inputRef={fileInput1Ref}
              isMinified={isMinified1}
            />
            <EditorPanel
              side="right"
              title="Second JSON"
              value={json2}
              setValue={setJson2}
              error={error2}
              setError={setError2}
              fileName={fileName2}
              setFileName={setFileName2}
              dragOver={dragOver2}
              setDragOver={setDragOver2}
              editorSettings={editorSettings}
              onEditorMount={(editor) => { editor2Ref.current = editor; }}
              onFormat={() => formatJSON(json2, setJson2, setError2)}
              onMinify={() => minifyJSON(json2, setJson2, setError2, isMinified2, setIsMinified2)}
              onRepair={() => repairInput(json2, setJson2, setError2)}
              onPaste={() => pasteInto(setJson2, setError2, setFileName2, "Pasted JSON 2")}
              onCopy={() => copyToClipboard(json2, "json2")}
              onUpload={(event) => readFile(event, setJson2, setError2, setFileName2)}
              inputRef={fileInput2Ref}
              isMinified={isMinified2}
            />
          </div>

          {showComparison && (
            <div className="rounded-xl border border-purple-500/30 bg-slate-800/50 backdrop-blur">
              <div className="sticky top-16 z-30 border-b border-slate-700/70 bg-slate-800/95 p-4 backdrop-blur">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-white"><GitCompare className="h-5 w-5 text-purple-400" /> Comparison Results</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-slate-950/60 px-3 py-1">Total <strong>{stats.total}</strong></span>
                      <span className="rounded-full bg-green-900/50 px-3 py-1 text-green-300">Added <strong>{stats.added}</strong></span>
                      <span className="rounded-full bg-red-900/50 px-3 py-1 text-red-300">Removed <strong>{stats.removed}</strong></span>
                      <span className="rounded-full bg-yellow-900/50 px-3 py-1 text-yellow-300">Modified <strong>{stats.modified}</strong></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={!comparison.length} onClick={() => focusDiff((activeDiffIndex - 1 + comparison.length) % comparison.length)} className="rounded bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-40"><ArrowLeft className="inline h-4 w-4" /> Prev</button>
                    <button disabled={!comparison.length} onClick={() => focusDiff((activeDiffIndex + 1) % comparison.length)} className="rounded bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-40">Next <ArrowRight className="inline h-4 w-4" /></button>
                    <button onClick={() => downloadText("json-diff.json", safeJsonStringify(comparison, 2))} className="rounded bg-purple-700 px-3 py-2 text-sm text-white"><Download className="inline h-4 w-4" /> Diff</button>
                    <button onClick={() => downloadText("json-patch.json", safeJsonStringify(patch, 2))} className="rounded bg-purple-700 px-3 py-2 text-sm text-white"><Download className="inline h-4 w-4" /> Patch</button>
                    <button onClick={() => copyToClipboard(safeJsonStringify(patch, 2), "patch")} className="rounded bg-slate-700 px-3 py-2 text-sm text-white">{copied === "patch" ? <Check className="inline h-4 w-4" /> : <Copy className="inline h-4 w-4" />} Patch</button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
                    <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950/60 py-2 pl-10 pr-3 text-sm text-white">
                      <option value="all">All</option>
                      <option value="added">Added</option>
                      <option value="removed">Removed</option>
                      <option value="modified">Modified</option>
                    </select>
                  </div>
                  <div className="flex rounded-lg bg-slate-950/60 p-1 text-sm">
                    {["tree", "list", "detail"].map((tab) => (
                      <button key={tab} onClick={() => setActiveResultTab(tab)} className={`flex-1 rounded px-3 py-1.5 capitalize ${activeResultTab === tab ? "bg-purple-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{tab}</button>
                    ))}
                  </div>
                </div>
              </div>

              {comparison.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="mx-auto mb-3 h-14 w-14 text-green-400" />
                  <p className="text-xl font-semibold text-green-400">JSONs are identical.</p>
                  <p className="mt-1 text-slate-400">The current settings found no differences.</p>
                </div>
              ) : activeResultTab === "tree" ? (
                <div className="grid gap-px bg-slate-700/50 md:grid-cols-2">
                  <div className="bg-slate-900/50 p-4">
                    <JSONTree
                      title="First JSON"
                      data={parsedJson1}
                      diffMap={diffMap}
                      isLeft
                      pinnedPath={pinnedPath1}
                      hoveredPath={hoveredPath1}
                      selectedPath={selectedDiffPath}
                      searchTerm={searchTerm1}
                      currentMatchIndex={currentMatchIndex1}
                      searchMatches={searchMatches1}
                      expandedPaths={expandedPaths1}
                      globalExpandToggle={globalExpandToggle}
                      globalExpandAction={globalExpandAction}
                      onHover={setHoveredPath1}
                      onPin={(path) => setPinnedPath1(pinnedPath1 === path ? "" : path)}
                      onClearPin={() => setPinnedPath1("")}
                      onExpandAll={() => { setGlobalExpandAction("expand"); setGlobalExpandToggle((value) => value + 1); }}
                      onCollapseAll={() => { setGlobalExpandAction("collapse"); setGlobalExpandToggle((value) => value + 1); }}
                      scrollRef={scrollRef1}
                      onSearchChange={setSearchTerm1}
                      onSearchKeyDown={(event) => { if (event.key === "Enter" && searchMatches1.length) setCurrentMatchIndex1((current) => (current + 1) % searchMatches1.length); }}
                    />
                  </div>
                  <div className="bg-slate-900/50 p-4">
                    <JSONTree
                      title="Second JSON"
                      data={parsedJson2}
                      diffMap={diffMap}
                      isLeft={false}
                      pinnedPath={pinnedPath2}
                      hoveredPath={hoveredPath2}
                      selectedPath={selectedDiffPath}
                      searchTerm={searchTerm2}
                      currentMatchIndex={currentMatchIndex2}
                      searchMatches={searchMatches2}
                      expandedPaths={expandedPaths2}
                      globalExpandToggle={globalExpandToggle}
                      globalExpandAction={globalExpandAction}
                      onHover={setHoveredPath2}
                      onPin={(path) => setPinnedPath2(pinnedPath2 === path ? "" : path)}
                      onClearPin={() => setPinnedPath2("")}
                      onExpandAll={() => { setGlobalExpandAction("expand"); setGlobalExpandToggle((value) => value + 1); }}
                      onCollapseAll={() => { setGlobalExpandAction("collapse"); setGlobalExpandToggle((value) => value + 1); }}
                      scrollRef={scrollRef2}
                      onSearchChange={setSearchTerm2}
                      onSearchKeyDown={(event) => { if (event.key === "Enter" && searchMatches2.length) setCurrentMatchIndex2((current) => (current + 1) % searchMatches2.length); }}
                    />
                  </div>
                </div>
              ) : activeResultTab === "list" ? (
                <div className="max-h-[720px] overflow-auto p-4">
                  <div className="space-y-2">
                    {filteredComparison.map((diff, index) => (
                      <button key={`${diff.path}-${index}`} onClick={() => focusDiff(comparison.indexOf(diff))} className={`block w-full rounded-lg border p-3 text-left transition-colors ${selectedDiffPath === diff.path ? "border-purple-500 bg-purple-900/30" : "border-slate-700 bg-slate-900/50 hover:border-slate-500"}`}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${diff.type === "added" ? "bg-green-600/50 text-green-200" : diff.type === "removed" ? "bg-red-600/50 text-red-200" : "bg-yellow-600/50 text-yellow-200"}`}>{diff.type}</span>
                          <code className="break-all text-xs text-purple-300">{diff.path}</code>
                        </div>
                        <div className="font-mono text-xs text-slate-300">{safeJsonStringify(diff.type === "modified" ? { old: diff.oldValue, next: diff.newValue } : diff.value, 0).slice(0, 180)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  <div className="rounded-lg bg-slate-950/70 p-4">
                    <h4 className="mb-2 font-semibold text-white">Selected Path</h4>
                    <code className="break-all text-sm text-purple-300">{selectedDiffPath || "Select a difference"}</code>
                    <pre className="mt-4 max-h-80 overflow-auto rounded bg-black/30 p-3 text-xs text-slate-200">{resultValue ? safeJsonStringify(resultValue, 2) : ""}</pre>
                  </div>
                  <div className="rounded-lg bg-slate-950/70 p-4">
                    <h4 className="mb-2 font-semibold text-white">JSON Patch</h4>
                    <pre className="max-h-96 overflow-auto rounded bg-black/30 p-3 text-xs text-slate-200">{safeJsonStringify(patch, 2)}</pre>
                    <button disabled={!parsedJson1} onClick={() => downloadText("merged-output.json", safeJsonStringify(applyDiffToLeft(parsedJson1, comparison), 2))} className="mt-3 rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-40">Export merged output</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default JSONCompare;
