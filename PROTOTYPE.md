# Search everything prototype

Branch: `prototype/command-search`

Run `npm start`, open the JSON workspace, and click **Search everything** or press **Ctrl/Cmd+K**.

- Search across commands, open documents, and indexed paths/values in the active JSON document.
- Prefix with `>` for commands, `@` for documents, or `#` for JSON.
- Use Up/Down to select, Enter to run, Escape to dismiss. Tab stays inside the panel; closing restores focus.
- Unavailable commands remain visible and dimmed. Format, minify, and other parsed-data actions wait for current JSON.
- JSON selection opens Tree view and reveals the selected path.

This prototype uses the existing bounded JSON index and shows at most 80 palette results. Narrow the query to find additional indexed results. It does not search JSON content in inactive documents or the comparison's right-hand input. Full arrow-key tree navigation is a follow-up, separate from palette keyboard navigation.

Feedback to explore: centered palette versus docked panel, result grouping/ranking, shortcuts, and which commands should be exposed next.
