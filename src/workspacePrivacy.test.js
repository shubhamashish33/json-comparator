import { STORAGE_KEYS } from "./workbenchConfig";
import { shouldRememberWorkspace, setRememberWorkspace, clearSavedWorkspace } from "./workspacePrivacy";

beforeEach(() => localStorage.clear());
test("opting out clears all app data, persists the choice, and preserves other sites' data", () => {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.setItem(key, "private"));
  localStorage.setItem("unrelated", "keep");
  expect(shouldRememberWorkspace()).toBe(true);
  setRememberWorkspace(false);
  expect(shouldRememberWorkspace()).toBe(false);
  Object.values(STORAGE_KEYS).forEach(key => expect(localStorage.getItem(key)).toBeNull());
  expect(localStorage.getItem("unrelated")).toBe("keep");
  clearSavedWorkspace();
  expect(shouldRememberWorkspace()).toBe(false);
  setRememberWorkspace(true);
  expect(shouldRememberWorkspace()).toBe(true);
});
test("unavailable storage defaults to memory only", () => {
  const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
  expect(shouldRememberWorkspace()).toBe(false);
  get.mockRestore();
});
