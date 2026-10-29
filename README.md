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
