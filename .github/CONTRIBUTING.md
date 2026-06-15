# Contributing

Thanks for contributing to JSONEditor.

## Before You Start

- Search existing issues and pull requests before opening a duplicate.
- Open an issue before making a large behavioral or architectural change.
- Never include real credentials, tokens, private keys, or sensitive JSON in
  issues, screenshots, tests, or commits.

## Local Setup

Requirements:

- Node.js 22 or newer
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

- Keep changes focused on one problem.
- Follow the existing React and utility patterns.
- Preserve browser-local processing and privacy behavior.
- Add or update tests when changing JSON parsing, comparison, querying,
  transformation, or redaction logic.
- Update the README and Help page when user-facing behavior changes.

## Verification

Run both commands before submitting a pull request:

```bash
npm test -- --watchAll=false
npm run build
```

## Pull Requests

- Explain the problem and the implemented solution.
- Link the related issue when one exists.
- Include screenshots for visible UI changes.
- Describe how the change was tested.
- Keep unrelated formatting or refactoring out of the pull request.

By contributing, you agree that your contribution is licensed under the
project's MIT License.
