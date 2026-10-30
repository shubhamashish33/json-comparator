# JSONEditor

Edit, compare, and clean up JSON in your browser.

[Open JSONEditor](https://jsoneditor.shubhamashish.xyz/) · [Help](https://jsoneditor.shubhamashish.xyz/help) · [Report a bug](https://github.com/shubhamashish33/json-comparator/issues)

![JSONEditor workspace](https://github.com/user-attachments/assets/e05507c0-30a7-4b92-8192-facb7e29f752)

## What you can do

- **Edit:** Paste JSON or open a file. Format it, fix common errors, or explore it as a tree or table.
- **Compare:** Edit two documents side by side and see what changed.
- **Query:** Find the values you need or filter a list.
- **Sanitize:** Find and replace passwords, tokens, and other sensitive values before sharing.

Copy your results or download them as JSON.

## Get started

1. [Open the app](https://jsoneditor.shubhamashish.xyz/) and choose **Start editing** or **Compare JSON**.
2. Paste your JSON, open a file, or load an example.
3. For comparison, text changes appear as you type. Choose **Tree** to compare values and browse the changes.

Need more detail? Open **Help** in the app.

## Your data

JSON editing and comparison happen in your browser. Your document contents are not uploaded to a server for processing.

Small documents can be restored after a refresh. Large documents stay in memory, so download them before closing the page.

## Run locally

You'll need Node.js 22 and npm.

```bash
npm ci
npm start
```

Then open [localhost:3000](http://localhost:3000).

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for the code layout, tests, and contribution steps.

## License

[MIT](LICENSE)

## Browser storage and privacy

Open **Privacy & storage** in the workspace to turn off **Remember workspace after refresh**. This clears the app's saved documents, schema, and settings and keeps the current workspace in memory only. Download anything you need before refreshing or closing the tab. The storage preference itself is remembered when browser storage is available.

Document processing is local. Site analytics and editor asset loading may make network requests; importing from a URL contacts that URL. Secret detection is a review aid and may miss sensitive values.

Tree keyboard controls: Up/Down move between visible nodes, Right expands or enters a node, Left collapses or returns to its parent, and Home/End move to the first/last visible node. Enter/Space selects and toggles a container. Shift+F10 opens node actions. Action menus support arrows, Home/End, Escape, and return focus to their trigger. Paged children remain available through the Show next button.

Comparison presets: use Strict, Match records by ID, or API responses in Compare. Expand Customize rules to edit array matching, path filters, case rules, and numeric tolerance, then save a named preset. Up to 20 presets are stored locally when workspace saving is enabled; memory-only mode keeps them only for the open workspace session.

Public tool pages are available at `/json-compare`, `/compare-json-arrays-by-id`, `/json-redactor`, and `/json-formatter`. `npm run build` prerenders the homepage, help, and tool pages and writes unique metadata for all routes. Vercel serves these HTML files directly; the editing workspace remains client-rendered. The public formatter keeps its input in memory.
