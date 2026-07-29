import {
  formatBytes,
  jsonPointerToPath,
  replaceJsonMatches,
} from "./workbenchUtils";

describe("workbench utilities", () => {
  test("converts JSON pointers into editor paths", () => {
    expect(jsonPointerToPath("/users/0/profile/email")).toBe("users[0].profile.email");
    expect(jsonPointerToPath("/a~1b/c~0d")).toBe("a/b.c~d");
    expect(jsonPointerToPath("")).toBe("");
  });

  test("replaces matching string values without changing keys", () => {
    const result = replaceJsonMatches(
      { status: "pending", nested: { status: "pending-review" } },
      "pending",
      "ready",
      "value"
    );

    expect(result.value).toEqual({
      status: "ready",
      nested: { status: "ready-review" },
    });
    expect(result.count).toBe(2);
  });

  test("renames matching keys while preserving values", () => {
    const result = replaceJsonMatches(
      { user_name: "Ada", nested: { user_name: "Linus" } },
      "user_",
      "",
      "key"
    );

    expect(result.value).toEqual({
      name: "Ada",
      nested: { name: "Linus" },
    });
    expect(result.count).toBe(2);
  });

  test("formats document sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
