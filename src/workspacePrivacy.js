import { STORAGE_KEYS } from "./workbenchConfig";

const PREFERENCE_KEY = "json-comparator-remember-workspace";

export function shouldRememberWorkspace() {
  try { return localStorage.getItem(PREFERENCE_KEY) !== "false"; }
  catch { return false; }
}

export function setRememberWorkspace(remember) {
  try {
    localStorage.setItem(PREFERENCE_KEY, String(remember));
  } catch {
    // The current session can still use the requested mode.
  }
  if (!remember) clearSavedWorkspace();
}

export function clearSavedWorkspace() {
  Object.values(STORAGE_KEYS).forEach(key => {
    try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
  });
}
