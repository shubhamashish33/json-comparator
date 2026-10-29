import { getValueAtPath, parseJSONDetailed } from "./jsonUtils";
import { TABLE_ROW_LIMIT, TABLE_COLUMN_SAMPLE, STORAGE_TEXT_LIMIT } from "./workbenchConfig";

export const stringify = (value, spacing = 2) => {
  try {
    return JSON.stringify(value, null, spacing);
  } catch {
    return String(value);
  }
};

export const clone = (value) => JSON.parse(JSON.stringify(value));

export const parsePath = (path) => {
  if (!path) return [];
  return path.match(/[^.[\]]+/g) || [];
};

export const formatPath = (base, key, parentIsArray = false) => {
  if (!base) return parentIsArray ? `[${key}]` : String(key);
  return parentIsArray ? `${base}[${key}]` : `${base}.${key}`;
};

export const parentPathOf = (path) => {
  const parts = parsePath(path);
  parts.pop();
  return parts.reduce((current, part, index) => {
    const isIndex = /^\d+$/.test(part);
    if (index === 0) return isIndex ? `[${part}]` : part;
    return isIndex ? `${current}[${part}]` : `${current}.${part}`;
  }, "");
};

export const keyOfPath = (path) => parsePath(path).at(-1) || "";

export const setAtPath = (source, path, nextValue, nextKey) => {
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

export const addAtPath = (source, parentPath, key, value) => {
  const next = clone(source);
  const target = parentPath ? getValueAtPath(next, parentPath) : next;
  if (Array.isArray(target)) target.push(value);
  else if (target && typeof target === "object") target[key || `key_${Object.keys(target).length + 1}`] = value;
  return next;
};

export const removeAtPath = (source, path) => {
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

export const clearValuesAtPaths = (source, paths) => {
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

export const duplicateAtPath = (source, path) => {
  const value = getValueAtPath(source, path);
  const parentPath = parentPathOf(path);
  const key = keyOfPath(path);
  const parent = parentPath ? getValueAtPath(source, parentPath) : source;
  if (Array.isArray(parent)) return addAtPath(source, parentPath, "", clone(value));
  return addAtPath(source, parentPath, `${key}_copy`, clone(value));
};

export const sortKeysDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
};

export const parseTypedValue = (raw, type) => {
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

export const valueType = (value) => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
};

export const collectTreeEntries = (value, visibleCount, forcedKey) => {
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

export const buildFallbackIndex = (value, limit = 5000) => {
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

export const collectTable = (value) => {
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

export const downloadText = (name, text, type = "application/json") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const safeSetStorage = (key, value) => {
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

export const safeSetStorageJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Settings are non-critical.
  }
};

