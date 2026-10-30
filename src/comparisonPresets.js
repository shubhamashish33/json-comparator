import { defaultSettings } from "./workbenchConfig";

export const builtInPresets = [
  { name: "Strict", settings: { ...defaultSettings } },
  { name: "Match records by ID", settings: { ...defaultSettings, arrayMode: "match-key", arrayMatchKey: "id" } },
  { name: "API responses", settings: { ...defaultSettings, arrayMode: "match-key", arrayMatchKey: "id", ignorePaths: "updatedAt,requestId,metadata.updatedAt,metadata.requestId" } },
];

export function normalizeComparisonSettings(value = {}) {
  const result = { ...defaultSettings };
  Object.keys(result).forEach(key => {
    if (typeof value[key] === typeof result[key]) result[key] = value[key];
  });
  if (!["index", "ignore-order", "match-key"].includes(result.arrayMode)) result.arrayMode = "index";
  if (!Number.isFinite(result.numberTolerance) || result.numberTolerance < 0) result.numberTolerance = 0;
  return result;
}

export function readComparisonPresets(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.name === "string" && item.name.trim() && item.settings && typeof item.settings === "object")
      .slice(0, 20).map(item => ({ name: item.name.trim().slice(0, 60), settings: normalizeComparisonSettings(item.settings) }));
  } catch { return []; }
}
