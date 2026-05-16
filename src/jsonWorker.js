/* global globalThis */
import {
  compareJSONValues,
  formatPath,
  parseJSONDetailed,
} from "./jsonUtils";

const TEXT_ROW_LIMIT = 5000;
const SEARCH_RESULT_LIMIT = 500;

const valueType = (value) => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
};

const stringifyPreview = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildIndex = (value, limit = TEXT_ROW_LIMIT) => {
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
        value: node && typeof node === "object" ? stringifyPreview(node) : node,
      });
    }

    if (node && typeof node === "object") {
      const entries = Array.isArray(node)
        ? Array.from({ length: node.length }, (_, index) => [index, node[index]])
        : Object.keys(node).map((key) => [key, node[key]]);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, child] = entries[index];
        stack.push({ node: child, path: formatPath(path, key) });
      }
    }
  }

  return {
    rows,
    visited,
    truncated: rows.length >= limit && visited > rows.length,
  };
};

const searchIndex = (value, term, limit = SEARCH_RESULT_LIMIT) => {
  if (!term || term.length < 2) return { matches: [], visited: 0, truncated: false };
  const lower = term.toLowerCase();
  const matches = [];
  const stack = [{ node: value, path: "" }];
  let visited = 0;

  while (stack.length && matches.length < limit) {
    const { node, path } = stack.pop();
    visited += 1;
    if (node === null || node === undefined) continue;
    if (typeof node !== "object") {
      if (String(node).toLowerCase().includes(lower)) matches.push(path || "root");
      continue;
    }

    const entries = Array.isArray(node)
      ? Array.from({ length: node.length }, (_, index) => [index, node[index]])
      : Object.keys(node).map((key) => [key, node[key]]);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, child] = entries[index];
      const nextPath = formatPath(path, key);
      if (String(key).toLowerCase().includes(lower)) matches.push(nextPath);
      if (matches.length >= limit) break;
      stack.push({ node: child, path: nextPath });
    }
  }

  return { matches, visited, truncated: matches.length >= limit };
};

const postProgress = (id, label, progress) => {
  globalThis.postMessage({ id, type: "progress", label, progress });
};

globalThis.onmessage = (event) => {
  const { id, task, payload } = event.data;

  try {
    if (task === "parse") {
      postProgress(id, "Parsing JSON", 15);
      const parsed = parseJSONDetailed(payload.text || "");
      if (parsed.error) {
        globalThis.postMessage({ id, type: "result", task, result: { ...parsed, index: { rows: [], visited: 0, truncated: false } } });
        return;
      }

      postProgress(id, "Indexing tree", 70);
      const index = parsed.value === null ? { rows: [], visited: 0, truncated: false } : buildIndex(parsed.value);
      globalThis.postMessage({ id, type: "result", task, result: { ...parsed, index } });
      return;
    }

    if (task === "search") {
      postProgress(id, "Searching indexed tree", 20);
      const result = searchIndex(payload.value, payload.term || "");
      globalThis.postMessage({ id, type: "result", task, result });
      return;
    }

    if (task === "diff") {
      postProgress(id, "Comparing documents", 20);
      const differences = compareJSONValues(payload.left, payload.right, payload.settings || {});
      globalThis.postMessage({ id, type: "result", task, result: differences });
      return;
    }
  } catch (error) {
    globalThis.postMessage({
      id,
      type: "error",
      task,
      error: {
        message: error.message || "Worker task failed",
      },
    });
  }
};
