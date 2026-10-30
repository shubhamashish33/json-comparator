// Exercise the shipped Web Worker module through a Node worker_threads adapter.
// Times include message cloning, parse safety checks, indexing, and result transfer.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataURL = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const utilsURL = dataURL(await fs.readFile(path.join(root, "src/jsonUtils.js"), "utf8"));
const source = (await fs.readFile(path.join(root, "src/jsonWorker.js"), "utf8")).replace('"./jsonUtils"', JSON.stringify(utilsURL));
const worker = new Worker(`
  const { parentPort } = require("node:worker_threads");
  globalThis.postMessage = message => parentPort.postMessage(message);
  import(${JSON.stringify(dataURL(source))}).then(() => {
    parentPort.on("message", data => globalThis.onmessage({data}));
    parentPort.postMessage({type:"ready"});
  }).catch(error => { throw error; });
`, { eval: true });
const pending = new Map();
let sequence = 0;
const ready = new Promise((resolve, reject) => {
  worker.on("error", error => { reject(error); pending.forEach(task => task.reject(error)); });
  worker.on("message", message => {
    if (message.type === "ready") { resolve(); return; }
    const task = pending.get(message.id);
    if (!task || message.type === "progress") return;
    pending.delete(message.id);
    if (message.type === "error") task.reject(Error(message.error.message));
    else task.resolve(message.result);
  });
});
async function request(task, payload) {
  const id = ++sequence;
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => { pending.delete(id); reject(Error(`${task} exceeded 120 seconds`)); }, 120000);
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, task, payload });
    });
  } finally { clearTimeout(timer); }
}
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
async function measure(task, payload) {
  await request(task, payload); // Warm up each operation before three timed samples.
  const times = [];
  let result;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    result = await request(task, payload);
    times.push(performance.now() - started);
  }
  return { ms: Math.round(median(times) * 10) / 10, result };
}
const settings = { arrayMode: "match-key", arrayMatchKey: "id" };
const results = [];
async function runCase(name, leftText, rightText, expectedDifferences) {
  const parsed = await measure("parse", { text: leftText });
  const right = await request("parse", { text: rightText });
  if (parsed.result.error || right.error) throw Error(`Fixture failed parsing: ${name}`);
  const compared = await measure("diff", { left: parsed.result.value, right: right.value, settings });
  if (compared.result.length !== expectedDifferences) throw Error(`${name}: expected ${expectedDifferences} changes, received ${compared.result.length}`);
  const searched = await measure("search", { value: parsed.result.value, term: "benchmark-match", scope: "value" });
  const row = { case: name, bytesPerDocument: Buffer.byteLength(leftText), parseAndIndexMs: parsed.ms, comparisonMs: compared.ms, searchMs: searched.ms, differences: compared.result.length, indexedRows: parsed.result.index.rows.length, indexTruncated: parsed.result.index.truncated };
  results.push(row);
  console.log(JSON.stringify(row));
}
try {
  await ready;
  for (const mib of [1, 5, 10]) {
    const count = Math.ceil(mib * 1024 * 1024 / 220);
    const records = Array.from({ length: count }, (_, id) => ({ id, name: id % 500 === 0 ? "benchmark-match" : `record-${id}`, status: "pending", padding: "x".repeat(150) }));
    const changed = records.map((record, index) => index % 1000 === 0 ? { ...record, status: "shipped" } : record).reverse();
    await runCase(`${mib} MiB target, reordered records`, JSON.stringify(records), JSON.stringify(changed), Math.ceil(count / 1000));
  }
  let left = { status: "pending" };
  let right = { status: "shipped" };
  for (let i = 0; i < 128; i++) { left = { child: left }; right = { child: right }; }
  await runCase("128 nested objects", JSON.stringify(left), JSON.stringify(right), 1);
  const many = Array.from({ length: 10000 }, (_, id) => ({ id, status: "pending" }));
  await runCase("10,000 changed records", JSON.stringify(many), JSON.stringify(many.map(item => ({ ...item, status: "shipped" }))), 10000);
  const report = { generatedAt: new Date().toISOString(), runtime: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryGiB: Math.round(os.totalmem() / 1024 ** 3), methodology: "Actual jsonWorker.js executed in Node worker_threads; median of 3 samples after warmup; round trips include structured clone. Excludes browser UI, Monaco, storage, and network. These results do not establish a browser file-size guarantee.", results };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex !== -1) {
    if (!process.argv[outputIndex + 1]) throw Error("--output requires a file path");
    const output = path.resolve(root, process.argv[outputIndex + 1]);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.table(results);
} finally { await worker.terminate(); }
