import { addAtPath, clearValuesAtPaths, collectTreeEntries, duplicateAtPath, removeAtPath, setAtPath } from "./workbenchOperations";

describe("workspace edits preserve the original document", () => {
  const source = { users: [{ name: "Ada", roles: ["admin"] }], enabled: true };
  test("updates and renames nested keys", () => {
    expect(setAtPath(source, "users[0].name", "Grace", "displayName").users[0])
      .toEqual({ displayName: "Grace", roles: ["admin"] });
    expect(source.users[0].name).toBe("Ada");
  });
  test("adds, duplicates and removes array items", () => {
    expect(addAtPath(source, "users", "", { name: "Grace" }).users).toHaveLength(2);
    expect(duplicateAtPath(source, "users[0]").users).toEqual([source.users[0], source.users[0]]);
    expect(removeAtPath(source, "users[0]").users).toEqual([]);
    expect(source.users).toHaveLength(1);
  });
  test("clears selected values using their types", () => {
    expect(clearValuesAtPaths(source, new Set(["users[0].name", "users[0].roles", "enabled"])))
      .toEqual({ users: [{ name: "", roles: [] }], enabled: null });
  });
});

test("tree pagination includes a selected item beyond the visible page", () => {
  const values = Array.from({ length: 500 }, (_, index) => index);
  const result = collectTreeEntries(values, 200, "450");
  expect(result.childCount).toBe(500);
  expect(result.entries).toHaveLength(201);
  expect(result.entries.at(-1)).toEqual([450, 450]);
  expect(collectTreeEntries(values, 0, null).entries).toEqual([]);
});
