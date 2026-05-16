const primitiveTypes = new Set(["string", "number", "boolean", "object", "array", "null", "integer"]);

export const formatPath = (base, key) => {
  if (typeof key === "number") return `${base}[${key}]`;
  return base ? `${base}.${key}` : key;
};

export const getPathParents = (path) => {
  const parents = [];
  let current = "";
  (path.match(/[^.[\]]+/g) || []).forEach((part, index) => {
    if (index === 0) current = part;
    else if (/^\d+$/.test(part)) current += `[${part}]`;
    else current += `.${part}`;
    parents.push(current);
  });
  return parents;
};

export const getValueAtPath = (source, path) => {
  if (!path) return source;
  const tokens = path.match(/[^.[\]]+/g) || [];
  return tokens.reduce((value, token) => {
    if (value === undefined || value === null) return undefined;
    return value[token];
  }, source);
};

export const parseJSONDetailed = (text) => {
  if (!text.trim()) return { value: null, error: null };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    const positionMatch = /position (\d+)/i.exec(error.message);
    const position = positionMatch ? Number(positionMatch[1]) : -1;
    let line = 1;
    let column = 1;

    if (position >= 0) {
      const before = text.slice(0, position);
      const lines = before.split(/\r\n|\r|\n/);
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    }

    return {
      value: null,
      error: {
        message: error.message,
        position,
        line,
        column,
      },
    };
  }
};

export const repairJSONish = (text) => {
  let repaired = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,\s*([}\]])/g, "$1");

  repaired = repaired.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => {
    const normalized = value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\(['"\\/bfnrt])/g, (_, escaped) => {
        const escapes = {
          "'": "'",
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        return escapes[escaped];
      });
    return JSON.stringify(normalized);
  });

  return repaired;
};

export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const normalizeDiffPath = (path, ignoreCase) => (ignoreCase ? path.toLowerCase() : path);

const parsePathList = (value) =>
  String(value || "")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const pathMatches = (path, patterns) =>
  patterns.some((pattern) => {
    if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
      try {
        return new RegExp(pattern.slice(1, -1)).test(path);
      } catch {
        return false;
      }
    }
    return path === pattern || path.startsWith(`${pattern}.`) || path.startsWith(`${pattern}[`);
  });

export const shouldSkipPath = (path, settings) => {
  const ignorePaths = parsePathList(settings.ignorePaths);
  const includePaths = parsePathList(settings.includePaths);
  if (ignorePaths.length && pathMatches(path, ignorePaths)) return true;
  if (includePaths.length && !pathMatches(path, includePaths)) return true;
  return false;
};

const valuesEqual = (left, right, settings) => {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= (Number(settings.numberTolerance) || 0);
  }
  if (settings.stringNumberEquivalence) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
      return Math.abs(leftNumber - rightNumber) <= (Number(settings.numberTolerance) || 0);
    }
  }
  if (settings.ignoreCase && typeof left === "string" && typeof right === "string") {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
};

const objectEntries = (obj, settings) => {
  if (!settings.ignoreKeyCase) return Object.entries(obj || {});
  const seen = new Map();
  Object.entries(obj || {}).forEach(([key, value]) => {
    seen.set(key.toLowerCase(), { key, value });
  });
  return Array.from(seen.entries()).map(([normalizedKey, entry]) => [normalizedKey, entry.value, entry.key]);
};

const compareArrayByIndex = (left, right, path, settings, compareAny) => {
  const differences = [];
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const currentPath = formatPath(path, index);
    if (shouldSkipPath(currentPath, settings)) continue;
    if (index >= left.length) differences.push({ path: currentPath, type: "added", value: right[index] });
    else if (index >= right.length) differences.push({ path: currentPath, type: "removed", value: left[index] });
    else differences.push(...compareAny(left[index], right[index], currentPath));
  }
  return differences;
};

const compareArrayIgnoringOrder = (left, right, path, settings) => {
  const differences = [];
  const rightBuckets = new Map();
  right.forEach((item, index) => {
    const key = stableStringify(item);
    const bucket = rightBuckets.get(key) || [];
    bucket.push({ item, index });
    rightBuckets.set(key, bucket);
  });

  left.forEach((item, index) => {
    const key = stableStringify(item);
    const bucket = rightBuckets.get(key);
    if (bucket?.length) {
      bucket.shift();
      return;
    }
    differences.push({ path: formatPath(path, index), type: "removed", value: item });
  });

  rightBuckets.forEach((bucket) => {
    bucket.forEach(({ item, index }) => {
      differences.push({ path: formatPath(path, index), type: "added", value: item });
    });
  });

  return differences;
};

const compareArrayByKey = (left, right, path, settings, compareAny) => {
  const keyName = settings.arrayMatchKey?.trim();
  if (!keyName) return compareArrayByIndex(left, right, path, settings, compareAny);

  const leftMap = new Map();
  const rightMap = new Map();
  left.forEach((item, index) => leftMap.set(String(item?.[keyName] ?? `__index_${index}`), { item, index }));
  right.forEach((item, index) => rightMap.set(String(item?.[keyName] ?? `__index_${index}`), { item, index }));

  const differences = [];
  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  allKeys.forEach((key) => {
    const leftEntry = leftMap.get(key);
    const rightEntry = rightMap.get(key);
    const currentPath = `${path || "root"}[${keyName}=${JSON.stringify(key)}]`;
    if (shouldSkipPath(currentPath, settings)) return;
    if (!leftEntry) differences.push({ path: currentPath, type: "added", value: rightEntry.item });
    else if (!rightEntry) differences.push({ path: currentPath, type: "removed", value: leftEntry.item });
    else differences.push(...compareAny(leftEntry.item, rightEntry.item, currentPath));
  });
  return differences;
};

export const compareJSONValues = (left, right, settings = {}, path = "") => {
  const compareAny = (leftValue, rightValue, currentPath) => {
    if (shouldSkipPath(currentPath, settings)) return [];
    const leftIsObject = leftValue && typeof leftValue === "object";
    const rightIsObject = rightValue && typeof rightValue === "object";

    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      if (settings.arrayMode === "ignore-order") {
        return compareArrayIgnoringOrder(leftValue, rightValue, currentPath, settings);
      }
      if (settings.arrayMode === "match-key") {
        return compareArrayByKey(leftValue, rightValue, currentPath, settings, compareAny);
      }
      return compareArrayByIndex(leftValue, rightValue, currentPath, settings, compareAny);
    }

    if (leftIsObject && rightIsObject && !Array.isArray(leftValue) && !Array.isArray(rightValue)) {
      const leftEntries = objectEntries(leftValue, settings);
      const rightEntries = objectEntries(rightValue, settings);
      const leftMap = new Map(leftEntries.map(([key, value, originalKey]) => [key, { value, originalKey: originalKey || key }]));
      const rightMap = new Map(rightEntries.map(([key, value, originalKey]) => [key, { value, originalKey: originalKey || key }]));
      const differences = [];
      const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);

      allKeys.forEach((key) => {
        const displayKey = rightMap.get(key)?.originalKey || leftMap.get(key)?.originalKey || key;
        const nextPath = formatPath(currentPath, displayKey);
        if (shouldSkipPath(nextPath, settings)) return;
        if (!leftMap.has(key)) differences.push({ path: nextPath, type: "added", value: rightMap.get(key).value });
        else if (!rightMap.has(key)) differences.push({ path: nextPath, type: "removed", value: leftMap.get(key).value });
        else differences.push(...compareAny(leftMap.get(key).value, rightMap.get(key).value, nextPath));
      });

      return differences;
    }

    if (leftIsObject !== rightIsObject || Array.isArray(leftValue) !== Array.isArray(rightValue) || !valuesEqual(leftValue, rightValue, settings)) {
      return [{ path: currentPath || "root", type: "modified", oldValue: leftValue, newValue: rightValue }];
    }

    return [];
  };

  return compareAny(left, right, path);
};

export const searchInObject = (obj, searchTerm, currentPath = "", parentPaths = []) => {
  const matches = [];
  const lowerSearchTerm = searchTerm.toLowerCase();

  const search = (value, path, parents) => {
    if (value === null || value === undefined) return;
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([key, val]) => {
        const newPath = formatPath(path, key);
        const newParents = [...parents, path].filter(Boolean);
        if (key.toLowerCase().includes(lowerSearchTerm)) matches.push({ path: newPath, parents: newParents });
        if (typeof val !== "object" && val !== null && String(val).toLowerCase().includes(lowerSearchTerm)) {
          matches.push({ path: newPath, parents: newParents });
        }
        search(val, newPath, newParents);
      });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const newPath = formatPath(path, index);
        const newParents = [...parents, path].filter(Boolean);
        if (typeof item !== "object" && item !== null && String(item).toLowerCase().includes(lowerSearchTerm)) {
          matches.push({ path: newPath, parents: newParents });
        }
        search(item, newPath, newParents);
      });
    }
  };

  search(obj, currentPath, parentPaths);
  return matches;
};

export const validateAgainstSchema = (value, schema, path = "root") => {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;

  const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  const expected = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (expected.length && expected.some((type) => primitiveTypes.has(type)) && !expected.includes(actualType)) {
    errors.push({ path, message: `Expected ${expected.join(" or ")}, received ${actualType}` });
    return errors;
  }

  if (schema.enum && !schema.enum.some((item) => stableStringify(item) === stableStringify(value))) {
    errors.push({ path, message: `Value is not one of the allowed enum values` });
  }

  if (schema.required && value && typeof value === "object" && !Array.isArray(value)) {
    schema.required.forEach((key) => {
      if (!(key in value)) errors.push({ path: formatPath(path === "root" ? "" : path, key), message: "Required property is missing" });
    });
  }

  if (schema.properties && value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(schema.properties).forEach(([key, childSchema]) => {
      if (key in value) errors.push(...validateAgainstSchema(value[key], childSchema, formatPath(path === "root" ? "" : path, key)));
    });
  }

  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...validateAgainstSchema(item, schema.items, formatPath(path === "root" ? "" : path, index)));
    });
  }

  return errors;
};

const toPointer = (path) => {
  if (!path || path === "root") return "";
  return `/${(path.match(/[^.[\]]+|\[[^\]]+\]/g) || [])
    .map((token) => token.replace(/^\[|\]$/g, ""))
    .map((token) => token.replace(/~/g, "~0").replace(/\//g, "~1"))
    .join("/")}`;
};

export const toJsonPatch = (differences) =>
  differences.map((diff) => {
    if (diff.type === "added") return { op: "add", path: toPointer(diff.path), value: diff.value };
    if (diff.type === "removed") return { op: "remove", path: toPointer(diff.path) };
    return { op: "replace", path: toPointer(diff.path), value: diff.newValue };
  });

export const applyDiffToLeft = (left, differences) => {
  const clone = JSON.parse(JSON.stringify(left));
  differences.forEach((diff) => {
    if (!diff.path || diff.path === "root") return;
    const tokens = diff.path.match(/[^.[\]]+/g) || [];
    const last = tokens.pop();
    const parent = tokens.reduce((value, token) => value?.[token], clone);
    if (!parent || last === undefined) return;
    if (diff.type === "removed") {
      if (Array.isArray(parent)) parent.splice(Number(last), 1);
      else delete parent[last];
    } else {
      parent[last] = diff.type === "added" ? diff.value : diff.newValue;
    }
  });
  return clone;
};
