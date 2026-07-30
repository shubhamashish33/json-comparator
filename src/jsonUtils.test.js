import {
  compareJSONValues,
  getPathParents,
  parseJSONDetailed,
  redactSecrets,
  repairJSONish,
  toJsonPatch,
  validateAgainstSchema,
} from "./jsonUtils";

test("reports JSON parse line and column", () => {
  const result = parseJSONDetailed('{\n  "name": "JSONEditor",\n}');
  expect(result.error.line).toBe(3);
  expect(result.error.column).toBeGreaterThan(0);
});

test("repairs common JSON-ish input", () => {
  const repaired = repairJSONish("{name: 'JSONEditor', trailing: true,}");
  expect(JSON.parse(repaired)).toEqual({ name: "JSONEditor", trailing: true });
});

test("repairs single quoted strings without unsafe manual escaping", () => {
  const repaired = repairJSONish(String.raw`{
    message: 'say "hi"',
    owner: 'Bob\'s account',
    path: 'C:\\tmp\\file.json',
    line: 'first\nsecond',
    unicode: '\u004aSONEditor'
  }`);

  expect(JSON.parse(repaired)).toEqual({
    message: 'say "hi"',
    owner: "Bob's account",
    path: "C:\\tmp\\file.json",
    line: "first\nsecond",
    unicode: "JSONEditor",
  });
});

test("returns path parents without ad hoc bracket cleanup", () => {
  expect(getPathParents("users[1].profile.email")).toEqual([
    "users",
    "users[1]",
    "users[1].profile",
    "users[1].profile.email",
  ]);
});

test("redacts nested secrets by normalized key without mutating the source", () => {
  const source = {
    password: "correct horse battery staple",
    profile: {
      api_key: "key-value",
      displayName: "Ada",
    },
    sessions: [{ refreshToken: "refresh-value" }],
  };

  const result = redactSecrets(source);

  expect(result.value).toEqual({
    password: "[REDACTED]",
    profile: {
      api_key: "[REDACTED]",
      displayName: "Ada",
    },
    sessions: [{ refreshToken: "[REDACTED]" }],
  });
  expect(result.matches).toEqual([
    { path: "password", reason: "Sensitive key" },
    { path: "profile.api_key", reason: "Sensitive key" },
    { path: "sessions[0].refreshToken", reason: "Sensitive key" },
  ]);
  expect(source.profile.api_key).toBe("key-value");
});

test("redacts recognizable secret values and custom keys", () => {
  const result = redactSecrets(
    {
      headers: { value: "Bearer abc.def.ghi" },
      deployCode: 123456,
      publicId: "usr_123",
    },
    {
      customKeys: "deploy_code",
      replacement: "***",
    }
  );

  expect(result.value).toEqual({
    headers: { value: "***" },
    deployCode: "***",
    publicId: "usr_123",
  });
  expect(result.matches).toEqual([
    { path: "headers.value", reason: "Bearer token" },
    { path: "deployCode", reason: "Sensitive key" },
  ]);
});

test("can disable secret value pattern detection", () => {
  const token = "Bearer abc.def.ghi";
  expect(redactSecrets({ value: token }, { detectValuePatterns: false }).value).toEqual({ value: token });
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

test("handles a large nested difference set without spreading worker results", () => {
  const size = 130000;
  const left = { items: Array.from({ length: size }, (_, index) => index) };
  const right = { items: Array.from({ length: size }, (_, index) => index + 1) };

  const diffs = compareJSONValues(left, right);

  expect(diffs).toHaveLength(size);
  expect(diffs[0]).toMatchObject({ path: "items[0]", type: "modified", oldValue: 0, newValue: 1 });
  expect(diffs[size - 1]).toMatchObject({
    path: `items[${size - 1}]`,
    type: "modified",
    oldValue: size - 1,
    newValue: size,
  });
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
