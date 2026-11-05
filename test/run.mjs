import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cli = (...args) => execFileSync("node", ["dist/cli.mjs", ...args], { encoding: "utf8" });

for (const dir of ["fixtures/corpus", "fixtures/heldout", "fixtures/heldout2"]) {
  test(`no unsafe auto-runs in ${dir}`, () => {
    const r = JSON.parse(cli("eval", dir, "--json"));
    assert.deepEqual(r.preflight.unsafeAutoRun, []);
  });
}

test("trust-get policy auto-runs the BitLocker recovery-key read", () => {
  const r = JSON.parse(cli("eval", "fixtures/heldout2", "--json", "--trust-get"));
  assert.ok(r.preflight.unsafeAutoRun.includes("14-bitlocker-recovery-key.ts"));
});

test("drift flags new effects and ignores an effect-neutral refactor", () => {
  const run = (b) => spawnSync("node", ["dist/cli.mjs", "diff", "fixtures/drift/offboard.reviewed.ts", b]).status;
  assert.equal(run("fixtures/drift/offboard.published.ts"), 1);
  assert.equal(run("fixtures/drift/offboard.refactor.ts"), 0);
});

test("every published Serval sample with a side effect or unknown call needs approval", () => {
  for (const f of fs.readdirSync("samples").filter((x) => x.endsWith(".ts"))) {
    const m = JSON.parse(cli("manifest", `samples/${f}`));
    const risky = m.findings.some((x) => x.effect !== "read" || x.sensitive);
    assert.equal(m.verdict === "AUTO_RUN_SAFE", !risky, f);
  }
});

test("ambiguous const names fail closed", () => {
  const src = `import * as okta from "serval/integrations/okta";
const p = "/api/v1/users";
function a(ctx) { const p = "/api/v1/users/x/lifecycle/deactivate"; return okta.apiRequest({ path: p, method: "POST" }, ctx); }
export const main = { fn: async (_a, ctx) => okta.apiRequest({ path: p }, ctx) };`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-"));
  const file = path.join(dir, "ambiguous.ts");
  fs.writeFileSync(file, src);
  const m = JSON.parse(cli("manifest", file));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(m.verdict, "REQUIRES_APPROVAL");
  assert.ok(m.findings.every((f) => f.effect === "unknown"));
});

test("router never exposes a dangerous tool to the cheap tier", () => {
  assert.equal(spawnSync("node", ["dist/router.mjs"]).status, 0);
});
