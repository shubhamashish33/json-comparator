# Performance measurements and current limits

Run `npm run benchmark` to exercise the actual `src/jsonWorker.js` parse/index, search, and diff handlers through a Node worker_threads adapter. Use `npm run benchmark -- --output docs/benchmarks/sample-results.json` to save a report. Each timing is the median of three round trips after an untimed warmup, including message cloning and result transfer. Fixtures verify expected difference counts and cover reordered arrays near 1, 5, and 10 MiB, 128 nested objects, and 10,000 changed records.

## Recorded run

Node v24.22.1, Windows x64, AMD Ryzen 5 3550H, 8 logical CPUs, approximately 14 GiB system RAM. Full environment and exact byte counts are in [sample-results.json](benchmarks/sample-results.json).

| Fixture | Bytes per document | Parse + index | Comparison | Search |
|---|---:|---:|---:|---:|
| ~1 MB, reordered records | 1,022,730 | 49.6 ms | 52.4 ms | 17.2 ms |
| ~5 MB, reordered records | 5,149,493 | 175.6 ms | 188.3 ms | 67.0 ms |
| ~10 MB, reordered records | 10,320,964 | 357.3 ms | 367.8 ms | 133.3 ms |
| 128 nested objects | 1,300 | 2.0 ms | 0.8 ms | 0.3 ms |
| 10,000 changed records | 308,891 | 37.8 ms | 74.5 ms | 17.1 ms |

These are engine/worker measurements, not browser interaction benchmarks or maximum supported sizes. They exclude React rendering, Monaco, localStorage, and network requests. Browser memory, payload shape, hardware, and other open tabs affect responsiveness. Very deep inputs can still exceed recursion limits. The corpus does not benchmark worst-case ignore-order matching. No fixed browser file-size guarantee is established by this run.

## Enforced application guardrails

| Area | Current behavior |
|---|---|
| Tree children | 200 per page; Show next loads another page |
| Flattened path index | First 5,000 rows; the worker still visits the full document |
| Command palette | At most 80 results, from commands, documents, and the bounded active-document index |
| JSON search | Starts at 2 characters; at most 500 matches |
| Table | At most 1,000 object rows; columns sampled from the first 250 object rows |
| Saved content | Individual text and combined document text bounded at 750,000 UTF-16 code units; oversized saved document snapshots are removed |
| Undo snapshots | Text above 1,000,000 UTF-16 code units is excluded from history snapshots |
| Comparison text editor | Lightweight textareas above 2,000,000 code units per side or 3,000,000 combined; structural comparison remains available |
| Worker timeouts | General tasks: 15 seconds; structural comparison: 120 seconds |
| Numeric fidelity | Unsafe integers and non-finite parsed numbers are blocked; this is not arbitrary-precision decimal support |

Code-unit thresholds are not file-byte thresholds. Most are defined in `src/workbenchConfig.js`; the worker's 5,000-row index cap is in `src/jsonWorker.js`, and the palette cap is in `src/components/CommandPalette.js`.

## Browser verification still needed

On a named browser/version and viewport, measure paste/load-to-ready time, interaction latency while parsing, tree expansion, comparison navigation, and memory usage with the same payload shapes. Include the first-load editor asset cost separately. Browser automation was unavailable in the implementation session, so this document does not claim browser measurements or completed visual QA.
