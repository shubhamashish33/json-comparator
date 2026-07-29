const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const jsonPointerToPath = (pointer = "") => {
  if (!pointer) return "";
  return pointer
    .split("/")
    .slice(1)
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((path, part) => {
      if (/^\d+$/.test(part)) return `${path}[${part}]`;
      return path ? `${path}.${part}` : part;
    }, "");
};

export const replaceJsonMatches = (source, term, replacement, scope = "all") => {
  if (!term) return { value: source, count: 0 };
  const matcher = new RegExp(escapeRegExp(term), "gi");
  let count = 0;

  const replaceText = (value) => value.replace(matcher, () => {
    count += 1;
    return replacement;
  });

  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") {
      return Object.entries(value).reduce((result, [key, child]) => {
        const nextKey = scope === "all" || scope === "key" || scope === "path"
          ? replaceText(key)
          : key;
        result[nextKey] = visit(child);
        return result;
      }, {});
    }
    if (typeof value === "string" && (scope === "all" || scope === "value")) {
      return replaceText(value);
    }
    return value;
  };

  return { value: visit(source), count };
};

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const createDocument = (index = 1, text = "", name) => ({
  id: `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: name || `Document ${index}.json`,
  text,
});
