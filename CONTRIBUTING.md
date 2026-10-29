# Contributing

Thanks for contributing to JSONEditor.

## Before You Start

- Search existing issues and pull requests before opening a duplicate.
- Open an issue before making a large behavioral or architectural change.
- Never include real credentials, tokens, private keys, or sensitive JSON in
  issues, screenshots, tests, or commits.

## Local Setup

Requirements:

- Node.js 22 (the CI version)
- npm

Install the locked dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm start
```

## Making Changes

Browse [help wanted issues](https://github.com/shubhamashish33/json-comparator/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22).
Comment with your approach to coordinate with other contributors. Fork and
clone the repository, create a focused branch, and open your pull request
against `main`. Use `Closes #123` to link a resolved issue.

Open http://localhost:3000 after starting the dev server. Local JSON editing
and comparison require no backend or credentials.

### Project Map

- `src/App.js`: routing; workspace and help routes load on demand.
- `src/JSONCompare.js`: workspace state, worker coordination, and user actions.
- `src/components/`: reusable controls, tree view, node dialog, and query panel.
- `src/hooks/`: debouncing and modal keyboard/focus behavior.
- `src/workbenchConfig.js`: storage keys, defaults, examples, and size limits.
- `src/workbenchOperations.js`: immutable document edits, tree/table helpers,
  downloads, and storage helpers.
- `src/workbenchUtils.js`: document creation, replacement, and display utilities.
- `src/jsonUtils.js`: parsing, repair, comparison, paths, redaction, and exports.
- `src/jsonUtils.test.js`: utility regression tests.
- `src/jsonWorker.js`: background parsing, indexing, search, and comparison.
- `src/HelpPage.js`: user-facing workflow documentation.
- `src/index.css`: application styles.

Follow the [Code of Conduct](.github/CODE_OF_CONDUCT.md) and report
vulnerabilities through the [Security Policy](.github/SECURITY.md).

### Working on the Workspace

Keep document operations independent of React so they can be tested with plain
JSON inputs. UI components receive data and callbacks; workspace state and
worker coordination stay in `JSONCompare.js`. Use the existing `ToolbarButton`
for consistent action styling and accessible names for icon-only controls.

The `/compare` route opens the editor. `/compare?tab=compare` opens comparison
mode directly. Route loading is deferred so the homepage does not download the
workspace's editor, query, and schema dependencies immediately.

Tree children are paginated and their entries are memoized. Preserve forced
selection beyond the current page when changing tree rendering. Keep parsing,
search, and comparison in the worker, and preserve the lightweight editor
fallback for large inputs.

### Change Guidelines

- Keep changes focused on one problem.
- Follow the existing React and utility patterns.
- Preserve browser-local processing and privacy behavior.
- Add or update tests when changing JSON parsing, comparison, querying,
  transformation, or redaction logic.
- Update the README and Help page when user-facing behavior changes.

## Verification

Run both commands before submitting a pull request:

```bash
CI=true npm test -- --watchAll=false --runInBand
CI=true npm run build
```

Use `npm test` for interactive testing. For bug fixes, add a regression test
that fails before the fix and passes afterward. Manually check the affected
workspace: utility tests do not exercise Monaco or worker/UI interactions.
Include actual check results and anything you could not verify in your PR.

## Pull Requests

- Explain the problem and the implemented solution.
- Link the related issue when one exists.
- Include screenshots for visible UI changes.
- Describe how the change was tested.
- Keep unrelated formatting or refactoring out of the pull request.

By contributing, you agree that your contribution is licensed under the
project's MIT License.
