import fs from "node:fs";
import path from "node:path";
import { analyze, type Manifest } from "./analyze.js";

// Risk-tiered routing. The cheap model only ever holds tools that pass as auto-run safe.
// Anything else escalates to the frontier model.

interface Ticket { id: string; text: string; needs: string | null }

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  const v = i >= 0 ? Number(args[i + 1]) : fallback;
  if (!Number.isFinite(v) || v < 0) throw new Error(`${name} must be a non-negative number`);
  return v;
};
const CHEAP = flag("--cheap", 0.002);
const FRONTIER = flag("--frontier", 0.04);
const DIRS = ["fixtures/corpus", "fixtures/heldout", "fixtures/heldout2", "fixtures/drift"];

const tools = new Map<string, Manifest>();
for (const dir of DIRS) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
  const key = path.join(dir, f);
  tools.set(key, analyze(key, fs.readFileSync(key, "utf8")));
}
const cheapTier = new Set([...tools].filter(([, m]) => m.verdict === "AUTO_RUN_SAFE").map(([k]) => k));
const exposed = [...cheapTier].filter((k) => tools.get(k)!.findings.some((f) => f.effect !== "read" || f.sensitive));

const reason = (m: Manifest) => {
  const bad = m.findings.filter((f) => f.effect !== "read" || f.sensitive);
  if (bad.every((f) => f.why === "endpoint not in effect catalog")) return "uncatalogued endpoint";
  return `${m.risk} risk: ${[...new Set(bad.map((f) => f.op))].slice(0, 2).join("; ")}`;
};

const tickets: Ticket[] = JSON.parse(fs.readFileSync("fixtures/tickets.json", "utf8"));
let cost = 0;
let cheap = 0;
for (const t of tickets) {
  const toCheap = t.needs === null || cheapTier.has(t.needs);
  if (toCheap) cheap++;
  cost += toCheap ? CHEAP : CHEAP + FRONTIER;
  const m = t.needs ? tools.get(t.needs) : undefined;
  console.log(`  ${toCheap ? "cheap   " : "frontier"}  ${t.id}  ${t.text.slice(0, 60)}${!toCheap && m ? `  → ${reason(m)}` : ""}`);
}
const allFrontier = tickets.length * FRONTIER;
const per1k = (x: number) => ((x / tickets.length) * 1000).toFixed(2);
console.log(`\ntools: ${tools.size}, cheap-tier eligible: ${cheapTier.size}, dangerous tools exposed to cheap tier: ${exposed.length}`);
console.log(`tickets: ${tickets.length}, resolved on cheap tier: ${cheap}, escalated: ${tickets.length - cheap}`);
console.log(`cost per 1k tickets: all-frontier $${per1k(allFrontier)}, tiered $${per1k(cost)} (${(100 * (1 - cost / allFrontier)).toFixed(0)}% lower)`);
console.log(`per-ticket costs are placeholders (--cheap ${CHEAP} --frontier ${FRONTIER})`);
process.exitCode = exposed.length ? 1 : 0;
