# JSONEditor

JSONEditor is a browser-local JSON workbench for editing, inspecting, transforming, comparing, and redacting JSON documents. The current design is developer-focused: monospace UI, code-first editing, tree navigation when needed, separate workspaces for editor/compare/query/redact, and guardrails for larger JSON payloads.

<img width="1414" height="755" alt="image" src="https://github.com/user-attachments/assets/e05507c0-30a7-4b92-8192-facb7e29f752" />


## What It Does

- Edit JSON in multiple modes: Code, Tree, Paths, and Table.
- Keep several browser-local JSON documents open in tabs.
- Validate documents against a pasted JSON Schema and jump to schema problems by path.
- Search keys, values, or paths and replace matching strings or keys.
- Inspect and manipulate nodes from a JSON tree.
- Compare two JSON documents with tree-based next/previous diff navigation.
- Query paths and preview JavaScript-style transforms locally.
- Preview and apply secret redaction without sending JSON to a server.
- Open a built-in Help page for Table, Query, Compare, and large JSON workflows.
- Import, export, copy, format, compact, repair, sort keys, and reset the workspace.
- Keep JSON processing local in the browser.

## Workspaces

### Editor

The editor workspace is the main mode for working with one JSON document.

Available views:

- `Code`: default Monaco JSON editor for raw editing and paste workflows.
- `Tree`: expandable JSON tree with path-aware selection.
- `Paths`: flattened path/type/value projection capped for large files.
- `Table`: tabular view for arrays of objects.

Tree interactions:

- Click a node to select it and show its path.
- `Ctrl`/`Cmd`/`Shift` click toggles multi-select.
- Right-click a node for context actions.
- Search results appear in the sidebar; click a result or press `Enter` to jump through matches.
- Large arrays/objects are paged in chunks instead of rendering every child at once.

Node actions:

- Add child
- Edit node
- Duplicate node
- Remove selected
- Copy path
- Copy value

The editor toolbar is contextual: common actions stay visible, while less frequent transforms and workspace controls live under `More`.

Toolbar actions:

- Load sample JSON
- Import JSON file
- Export current JSON
- Copy current JSON
- Undo / redo
- Sort keys
- Repair JSON-ish input
- Compact JSON
- Format JSON
- Reset workspace

Document tabs:

- Create a document with the `+` control or `Ctrl`/`Cmd`+`N`.
- Switch documents without losing the current tab contents.
- Small documents are restored in browser storage; large documents remain memory-only.

JSON Schema:

- Open `More` → `JSON Schema`.
- Paste a schema and enable validation.
- Click a listed schema problem to jump to its JSON path in Tree mode.

Search and replace:

- Search keys and values together, keys only, values only, or full paths.
- Use `Replace all` to update matching string values or key names.
- Replacements participate in the normal editor undo history.

### Table Mode

Table mode renders arrays of objects.

It works in two ways:

1. If the root JSON is an array of objects, it renders automatically.
2. If a nested tree node is an array of objects, select that node first, then switch to `Table`.

Example:

```json
{
  "users": [
    { "id": 1, "name": "Alice", "active": true },
    { "id": 2, "name": "Bob", "active": false }
  ]
}
```

Select `users` in Tree mode, then open Table mode.

For performance, Table mode renders a capped projection:

- Up to 1000 object rows.
- Columns sampled from the first 250 object rows.
- The active table source path is shown above the table.

### Compare

Comparison uses editable inputs, a Monaco side-by-side text diff, and semantic Tree review.

How it works:

- Open Compare and choose an open document for the left and right sides. The right side can also remain a temporary input.
- Use `Edit inputs` to paste or edit left and right JSON in Monaco editors.
- Editing a selected right document changes it to a temporary input, preserving the source document tab.
- Click `Compare`.
- Compare opens the side-by-side text diff automatically.
- Switch to `Semantic tree` to review differences by JSON path.
- Both sides render as paged trees.
- Diff paths are highlighted in the trees.
- Use the sticky top compare bar for `Prev` / `Next`, filtering, patch export, and merged export.
- The active diff panel shows path, type, and left/right value previews.

Diff types:

- `added`
- `removed`
- `modified`

Comparison options:

- Ignore string case.
- Ignore key case.
- Treat numeric strings as numbers.
- Numeric tolerance.
- Array comparison by index, ignore-order, or object match key.
- Include/ignore path filters.

Exports:

- JSON Patch
- Merged output

### Help

The Help page is available from the top navigation. It explains the workflows that need more context:

- Table mode and nested arrays of objects.
- Query path lookup and transform examples.
- Compare Text/Tree workflow.
- Large JSON usage tips.

### Query And Transform

The query workspace supports live JMESPath expressions, simple path lookup, and local transform previews.

JMESPath examples:

```text
users[?active].{name: name, email: email}
[*].id
keys(@)
```

Path examples:

```text
profile.email
users[0].name
data.items[10].id
```

Transform snippets receive:

- `value`: a cloned copy of the current JSON value.
- `clone`: helper for cloning values.

Example:

```js
value.users = value.users.filter((user) => user.active);
return value;
```

JavaScript transforms are in the collapsed Advanced section. Prefer JMESPath for routine filtering and projection.

## Keyboard Shortcuts

- `Ctrl`/`Cmd` + `N`: create a document.
- `Ctrl`/`Cmd` + `K`: open JSON search in Tree mode.
- `Ctrl`/`Cmd` + `Shift` + `F`: format the active document.
- `Ctrl`/`Cmd` + `Shift` + `M`: minify the active document.

Transform output can be previewed, then applied back to the editor if it parses as JSON.

### Secret Redaction

The Redact workspace provides a direct source-to-output workflow:

1. Paste JSON into the Source JSON editor, import a file, or load the example.
2. Click `Redact secrets`.
3. Review the Safe JSON output and detected paths.
4. Copy or download the result, or replace the source to continue editing sanitized JSON.

Advanced redaction rules are collapsed by default so they do not block the main workflow.

Default key detection includes common credentials such as:

- `password`, `passwd`, and `pwd`
- `secret`, `clientSecret`, and `privateKey`
- `apiKey`, `accessKey`, and `secretKey`
- `accessToken`, `refreshToken`, `authToken`, and `sessionToken`
- `authorization`, `cookie`, and related header keys

Key matching is case-insensitive and ignores separators, so `apiKey`, `api_key`, and `API-KEY` are treated as the same key. Additional project-specific keys can be supplied one per line or comma-separated.

Optional value-pattern detection recognizes:

- Bearer and Basic authorization values
- JWTs
- AWS access keys
- GitHub tokens
- PEM private keys
- URLs containing embedded credentials

The replacement text is configurable. Preview results list only the detected path and reason, never the original value. Editing or importing new source JSON clears stale output so an older result cannot overwrite newer input.

## Large JSON Handling

The app has been optimized for larger JSON documents, including multi-MB payloads.

Current guardrails:

- JSON parsing is debounced to avoid parsing on every keystroke.
- Parsing, tree indexing, search, and comparison run through a Web Worker so heavy work does not block the main UI thread.
- Worker tasks expose progress state and can be cancelled from the toolbar while processing.
- If worker processing fails or times out, parsing falls back to the browser thread instead of leaving the workspace blank.
- Tree rendering is paged in chunks of 200 children.
- Tree child collection avoids expanding every object key just to render the first visible page.
- Sidebar search results can jump and scroll to matching paths in large trees.
- Text mode is capped to 5000 projected rows.
- Table mode is capped to 1000 rows.
- Search starts after 2 characters and caps at 500 matches.
- Diff results are navigated one at a time instead of rendering a huge list.
- Compare navigation controls stay in the sticky top compare bar so Prev/Next remain accessible while reviewing large trees.
- The main toolbar uses horizontal scrolling on smaller screens instead of wrapping controls into unstable rows.
- A fixed scroll-to-top control is available for long JSON pages.
- Large JSON is not written to `localStorage`.
- Undo history is disabled for very large documents to avoid large memory growth.

Important notes:

- Full JSON parsing still happens in the browser.
- The Web Worker improves responsiveness, but it does not remove the memory cost of holding parsed JSON in the browser.
- Very large documents will still use memory proportional to parsed object size.
- Browser-local comparison of very large nested documents can still be CPU-heavy.
- The UI avoids rendering every node/diff at once, and worker-backed processing keeps long parse/search/compare work away from React rendering.

## Worker Architecture

Large-document processing is split between the React UI and `src/jsonWorker.js`.

Worker-backed tasks:

- Parse JSON and return detailed errors.
- Build a capped path/type/value index for Text mode.
- Search keys and scalar values with a match cap.
- Run semantic JSON comparison for Compare mode.

Main-thread responsibilities:

- Render the current workspace.
- Keep Monaco Code mode interactive.
- Apply explicit edit actions such as add, edit, remove, duplicate, clear values, format, compact, and sort.
- Maintain small-document undo/redo history.

This keeps the app responsive during common large-payload workflows while preserving the same editor behavior for structured actions.

## Persistence And Privacy

JSONEditor runs in the browser. The app does not send pasted JSON to a backend service.

Persistence behavior:

- Small JSON documents may be restored from `localStorage`.
- Large JSON documents are kept in memory only.
- Large documents show a warning that they will not be restored after refresh.
- Reset clears app workspace state and JSONEditor localStorage keys.

If old localStorage data causes a stale state, run this in DevTools:

```js
localStorage.removeItem("json-comparator-json1");
localStorage.removeItem("json-comparator-json2");
localStorage.removeItem("json-comparator-settings");
location.reload();
```

## Reset Workspace

The `Reset` toolbar action clears:

- Left JSON
- Right JSON
- Compare results
- Selected paths
- Search
- Undo / redo history
- Query / transform state
- Fetch URL
- Storage notices
- JSONEditor localStorage entries

After reset, the editor returns to `Code` mode.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Build production bundle:

```bash
npm run build
```

## Tech Stack

- React
- React Router
- Monaco Editor
- Web Worker for parse/search/index/compare work
- Lucide React
- Tailwind CSS compiled as part of the local production build
- Self-hosted JetBrains Mono variable font
- Vercel Analytics

## Current Limitations

- Table mode is a projection for arrays of objects, not a full spreadsheet.
- Search is capped for performance.
- Text mode is capped for performance.
- Transform uses a local `Function` constructor, so it should be treated as user-authored local code only.
- Large JSON comparison can still be CPU-heavy because semantic comparison must traverse the parsed structures.
- Undo/redo uses full snapshots only below the configured history size limit; very large documents should use explicit structured actions carefully.

## License

MIT
