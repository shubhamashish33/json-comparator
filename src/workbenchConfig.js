export const STORAGE_KEYS = {
  left: "json-comparator-json1",
  right: "json-comparator-json2",
  settings: "json-comparator-settings",
  documents: "json-comparator-documents",
  activeDocument: "json-comparator-active-document",
  schema: "json-comparator-schema",
  schemaEnabled: "json-comparator-schema-enabled",
};

export const defaultSettings = {
  ignoreCase: false,
  ignoreKeyCase: false,
  stringNumberEquivalence: false,
  numberTolerance: 0,
  arrayMode: "index",
  arrayMatchKey: "id",
  ignorePaths: "",
  includePaths: "",
};

export const sampleLeft = {
  id: "usr_001",
  profile: {
    name: "John Doe",
    email: "john@example.com",
    active: true,
  },
  roles: ["admin", "editor"],
  limits: {
    requestsPerMinute: 120,
    beta: false,
  },
  metadata: {
    requestId: "abc-1",
    updatedAt: "2026-01-01T10:00:00Z",
  },
};

export const sampleRight = {
  id: "usr_001",
  profile: {
    name: "John Doe",
    email: "john.doe@example.com",
    active: true,
  },
  roles: ["admin", "editor", "reviewer"],
  limits: {
    requestsPerMinute: 240,
    beta: true,
  },
  metadata: {
    requestId: "abc-2",
    updatedAt: "2026-01-01T10:00:01Z",
  },
};

export const redactionSample = {
  user: {
    email: "john@example.com",
    password: "correct-horse-battery-staple",
  },
  apiKey: "service-key-value",
  headers: {
    authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
  },
  databaseUrl: "postgres://app:database-password@db.example.com/app",
  metadata: {
    requestId: "req_123",
  },
};

export const TREE_PAGE_SIZE = 200;
export const TABLE_ROW_LIMIT = 1000;
export const TABLE_COLUMN_SAMPLE = 250;
export const SEARCH_RESULT_LIMIT = 500;
export const PARSE_DEBOUNCE_MS = 350;
export const STORAGE_TEXT_LIMIT = 750_000;
export const HISTORY_TEXT_LIMIT = 1_000_000;
export const WORKER_TIMEOUT_MS = 15000;
export const COMPARE_WORKER_TIMEOUT_MS = 120000;
export const MONACO_COMPARE_TEXT_LIMIT = 2_000_000;
export const MONACO_COMPARE_COMBINED_LIMIT = 3_000_000;
export const EMPTY_WORKER_PARSE = {
  value: null,
  error: null,
  index: { rows: [], visited: 0, truncated: false },
  status: "idle",
  label: "Idle",
  progress: 0,
};

