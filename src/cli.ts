import fs from "node:fs";
import path from "node:path";
import { analyze, naiveReadOnly, type Finding, type Manifest, type Policy } from "./analyze.js";

const useColor = process.stdout.isTTY || Boolean(process.env.FORCE_COLOR);
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint("31"), yellow = paint("33"), green = paint("32"), dim = paint("2"), bold = paint("1");
const byEffect = (e: string) => (e === "read" ? green : e === "notify" || e === "write" ? yellow : red);

// Serval's documented default Okta scope set.
const DEFAULT_GRANTED: Record<string, string[]> = {
  okta: ["okta.apps.read", "okta.apps.manage", "okta.users.read", "okta.users.manage", "okta.groups.read", "okta.groups.manage", "okta.logs.read"],
};

const read = (file: string) => fs.readFileSync(file, "utf8");
const tsFiles = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith(".ts")).sort().map((f) => path.join(dir, f));

function formatFinding(f: Finding): string {
  const tags = [
    f.fanout === "unbounded" ? red("unbounded") : f.fanout !== "single" ? `max ${f.fanout.slice(8, -1)}` : "",
    f.conditional ? "conditional" : "",
    f.via ? `via ${f.via}()` : "",
    f.reversible === false ? red("irreversible") : "",
    f.sensitive ? red("secret material") : "",
  ].filter(Boolean).join(", ");
  return `${byEffect(f.effect)(f.effect.padEnd(11))} ${f.integration}: ${f.op}${tags ? `  [${tags}]` : ""}${f.why ? dim(`  (${f.why})`) : ""}  ${dim(`L${f.line}`)}`;
}

function render(m: Manifest): string {
  const verdict = m.verdict === "AUTO_RUN_SAFE" ? green("AUTO-RUN SAFE") : red("REQUIRES APPROVAL");
  const lines = [`${bold(path.basename(m.file))}  ${dim(m.title ?? "")}`, `  verdict: ${verdict}   risk: ${m.risk}`];
  for (const f of m.findings) lines.push("  " + formatFinding(f));
  for (const r of m.reasons) lines.push(dim(`  • ${r}`));
  const used = new Set(m.findings.map((f) => f.integration));
  const needed = new Set(m.scopesRequired);
  for (const [integration, granted] of Object.entries(DEFAULT_GRANTED)) {
    if (!used.has(integration) || m.findings.some((f) => f.integration === integration && f.effect === "unknown")) continue;
    const extra = granted.filter((s) => !needed.has(s));
    if (extra.length) lines.push(dim(`  • least privilege: ${integration} needs [${granted.filter((s) => needed.has(s)).join(", ")}], default grant adds [${extra.join(", ")}]`));
  }
  return lines.join("\n");
}

function evaluate(dir: string, policy: Policy) {
  const rows = tsFiles(dir).map((file) => {
    const src = read(file);
    const m = analyze(file, src, policy);
    return {
      file: path.basename(file),
      expect: /@expect\s+(read-only|approval)/.exec(src)?.[1],
      preflight: m.verdict === "AUTO_RUN_SAFE" ? "read-only" : "approval",
      naive: naiveReadOnly(src) ? "read-only" : "approval",
      risk: m.risk,
    };
  });
  const score = (k: "preflight" | "naive") => ({
    correct: rows.filter((r) => r[k] === r.expect).length,
    unsafeAutoRun: rows.filter((r) => r[k] === "read-only" && r.expect === "approval").map((r) => r.file),
    needlessApproval: rows.filter((r) => r[k] === "approval" && r.expect === "read-only").map((r) => r.file),
  });
  return { n: rows.length, preflight: score("preflight"), naive: score("naive"), rows };
}

function printEval(r: ReturnType<typeof evaluate>) {
  console.log(bold("file".padEnd(38) + "expect".padEnd(11) + "naive".padEnd(11) + "preflight".padEnd(11) + "risk"));
  for (const row of r.rows) {
    const mark = (v: string) => (v === row.expect ? green : red)(v.padEnd(10));
    console.log(`${row.file.padEnd(38)}${(row.expect ?? "?").padEnd(11)}${mark(row.naive)} ${mark(row.preflight)} ${row.risk}`);
  }
  for (const k of ["naive", "preflight"] as const) {
    const s = r[k];
    console.log(`\n${bold(k)}: ${s.correct}/${r.n} correct, unsafe auto-runs ${s.unsafeAutoRun.length}, needless approvals ${s.needlessApproval.length}`);
    if (s.unsafeAutoRun.length) console.log(dim(`  unsafe: ${s.unsafeAutoRun.join(" ")}`));
  }
}

export function diff(reviewed: string, published: string): { changes: string[]; before: Manifest; after: Manifest } {
  const before = analyze(reviewed, read(reviewed));
  const after = analyze(published, read(published));
  const key = (f: Finding) => `${f.integration}|${f.op}|${f.effect}`;
  const a = new Map(before.findings.map((f) => [key(f), f]));
  const b = new Map(after.findings.map((f) => [key(f), f]));
  const changes: string[] = [];
  for (const [k, f] of b) {
    const old = a.get(k);
    if (!old) changes.push(`${red("+ new")}      ${formatFinding(f)}`);
    else if (old.fanout !== f.fanout) changes.push(`${yellow("~ fan-out")}  ${f.op}: ${old.fanout} → ${f.fanout}`);
  }
  for (const [k, f] of a) if (!b.has(k)) changes.push(`${green("- removed")}  ${formatFinding(f)}`);
  return { changes, before, after };
}

function queue(dirs: string[]) {
  const blocked = new Map<string, Set<string>>();
  for (const dir of dirs) for (const file of tsFiles(dir)) {
    for (const f of analyze(file, read(file)).findings) {
      if (f.effect !== "unknown") continue;
      const k = f.path ? `${f.integration} ${f.method} ${f.path.split("?")[0]}` : `${f.integration} ${f.op} (${f.why})`;
      (blocked.get(k) ?? blocked.set(k, new Set()).get(k)!).add(file);
    }
  }
  const rows = [...blocked].sort((x, y) => y[1].size - x[1].size);
  console.log(bold(`${rows.length} distinct unknowns to label`));
  for (const [k, files] of rows) console.log(`  ${String(files.size).padStart(2)} wf  ${k}`);
}

function main(argv: string[]) {
  const [cmd, ...args] = argv;
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const pos = args.filter((a) => !a.startsWith("--"));
  const policy: Policy = flags.has("--trust-get") ? "trust-get" : "strict";
  switch (cmd) {
    case "scan":
      for (const f of pos) console.log(render(analyze(f, read(f), policy)) + "\n");
      return 0;
    case "manifest":
      console.log(JSON.stringify(analyze(pos[0], read(pos[0]), policy), null, 2));
      return 0;
    case "eval": {
      const r = evaluate(pos[0] ?? "fixtures/corpus", policy);
      if (flags.has("--json")) console.log(JSON.stringify(r, null, 2));
      else printEval(r);
      return 0;
    }
    case "diff": {
      const { changes, before, after } = diff(pos[0], pos[1]);
      console.log(bold(`Effect drift: ${path.basename(pos[0])} (reviewed) → ${path.basename(pos[1])} (to publish)`));
      console.log(`  verdict: ${before.verdict}/${before.risk} → ${after.verdict}/${after.risk}`);
      for (const c of changes) console.log("  " + c);
      console.log(changes.length ? red(`  ${changes.length} effect change(s) since review, re-review required`) : green("  no effect changes since review"));
      return changes.length ? 1 : 0;
    }
    case "queue":
      queue(pos);
      return 0;
    default:
      console.log("usage: preflight scan <files..> | manifest <file> | eval <dir> [--json] [--trust-get] | diff <reviewed.ts> <published.ts> | queue <dirs..>");
      return cmd ? 2 : 0;
  }
}

process.exitCode = main(process.argv.slice(2));
