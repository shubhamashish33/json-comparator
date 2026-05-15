import {
  compareJSONValues,
  parseJSONDetailed,
  repairJSONish,
  toJsonPatch,
  validateAgainstSchema,
} from "./jsonUtils";

test("reports JSON parse line and column", () => {
  const result = parseJSONDetailed('{\n  "name": "JSONSync",\n}');
  expect(result.error.line).toBe(3);
  expect(result.error.column).toBeGreaterThan(0);
});

test("repairs common JSON-ish input", () => {
  const repaired = repairJSONish("{name: 'JSONSync', trailing: true,}");
  expect(JSON.parse(repaired)).toEqual({ name: "JSONSync", trailing: true });
});

test("supports ignored paths and numeric tolerance", () => {
  const diffs = compareJSONValues(
    { price: 10, metadata: { updatedAt: "old" } },
    { price: 10.001, metadata: { updatedAt: "new" } },
    { numberTolerance: 0.01, ignorePaths: "metadata.updatedAt" }
  );
  expect(diffs).toEqual([]);
});

test("compares arrays by object key", () => {
  const diffs = compareJSONValues(
    { users: [{ id: 1, name: "Ada" }, { id: 2, name: "Linus" }] },
    { users: [{ id: 2, name: "Linus" }, { id: 1, name: "Ada Lovelace" }] },
    { arrayMode: "match-key", arrayMatchKey: "id" }
  );
  expect(diffs).toEqual([
    {
      path: 'users[id="1"].name',
      type: "modified",
      oldValue: "Ada",
      newValue: "Ada Lovelace",
    },
  ]);
});

test("exports JSON Patch operations", () => {
  expect(
    toJsonPatch([
      { path: "user.name", type: "modified", oldValue: "Ada", newValue: "Grace" },
      { path: "user.age", type: "added", value: 37 },
      { path: "debug", type: "removed", value: true },
    ])
  ).toEqual([
    { op: "replace", path: "/user/name", value: "Grace" },
    { op: "add", path: "/user/age", value: 37 },
    { op: "remove", path: "/debug" },
  ]);
});

test("validates a useful subset of JSON Schema", () => {
  const errors = validateAgainstSchema(
    { id: 123, tags: ["ok", 12] },
    {
      type: "object",
      required: ["name"],
      properties: {
        id: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
    }
  );

  expect(errors).toEqual([
    { path: "name", message: "Required property is missing" },
    { path: "id", message: "Expected string, received number" },
    { path: "tags[1]", message: "Expected string, received number" },
  ]);
});
