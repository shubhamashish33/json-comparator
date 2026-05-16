# JSONEditor

JSONEditor is a browser-local JSON workbench for editing, inspecting, transforming, validating, and comparing JSON documents. The current design is developer-focused: monospace UI, tree-first navigation, separate workspaces for editor/compare/query/schema, and guardrails for larger JSON payloads.

<img width="1414" height="755" alt="image" src="https://github.com/user-attachments/assets/e05507c0-30a7-4b92-8192-facb7e29f752" />


## What It Does

- Edit JSON in multiple modes: Tree, Code, Text, and Table.
- Inspect and manipulate nodes from a JSON tree.
- Compare two JSON documents with tree-based next/previous diff navigation.
- Query paths and preview JavaScript-style transforms locally.
- Validate JSON against a JSON Schema.
- Import, export, copy, format, compact, repair, sort keys, and reset the workspace.
- Keep JSON processing local in the browser.

## Workspaces

### Editor

The editor workspace is the main mode for working with one JSON document.

Available views:

- `Tree`: expandable JSON tree with path-aware selection.
- `Code`: Monaco JSON editor for raw editing.
- `Text`: flattened path/type/value projection capped for large files.
- `Table`: tabular view for arrays of objects.

Tree interactions:

- Click a node to select it and show its path.
- `Ctrl`/`Cmd`/`Shift` click toggles multi-select.
- Right-click a node for context actions.
- Large arrays/objects are paged in chunks instead of rendering every child at once.

Node actions:

- Add child
- Edit node
- Duplicate node
- Remove selected
- Copy path
- Copy value

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
- Compare
- Reset workspace

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

Comparison is tree-based instead of list-heavy.

How it works:

- Load or paste left and right JSON documents.
- Click `Compare`.
- Both sides render as paged trees.
- Diff paths are highlighted in the trees.
- Use `Prev` / `Next` to move through changes one at a time.
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

### Query And Transform

The query workspace supports path lookup and local transform previews.

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

Transform output can be previewed, then applied back to the editor if it parses as JSON.

### Schema

The schema workspace validates the current left JSON document against a JSON Schema.

Supported validation is intentionally lightweight:

- `type`
- `required`
- `properties`
- `items`
- `enum`

This is not a full JSON Schema engine yet.

## Large JSON Handling

The app has been optimized for larger JSON documents, including multi-MB payloads.

Current guardrails:

- JSON parsing is debounced to avoid parsing on every keystroke.
- Tree rendering is paged in chunks of 200 children.
- Text mode is capped to 5000 projected rows.
- Table mode is capped to 1000 rows.
- Search starts after 2 characters and caps at 500 matches.
- Diff results are navigated one at a time instead of rendering a huge list.
- Large JSON is not written to `localStorage`.
- Undo history is disabled for very large documents to avoid large memory growth.

Important notes:

- Full JSON parsing still happens in the browser.
- Very large documents will still use memory proportional to parsed object size.
- Browser-local comparison of very large nested documents can still be CPU-heavy.
- The UI avoids rendering every node/diff at once, which is the main performance protection.

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
localStorage.removeItem("json-comparator-schema");
localStorage.removeItem("json-comparator-settings");
location.reload();
```

## Reset Workspace

The `Reset` toolbar action clears:

- Left JSON
- Right JSON
- Schema
- Compare results
- Selected paths
- Search
- Undo / redo history
- Query / transform state
- Fetch URL
- Storage notices
- JSONEditor localStorage entries

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
- Lucide React
- Tailwind via CDN in `public/index.html`
- Vercel Analytics

## Current Limitations

- Table mode is a projection for arrays of objects, not a full spreadsheet.
- Search is capped for performance.
- Text mode is capped for performance.
- JSON Schema support is partial.
- Transform uses a local `Function` constructor, so it should be treated as user-authored local code only.
- Large JSON comparison can still be CPU-heavy because semantic comparison must traverse the parsed structures.

## License

MIT
