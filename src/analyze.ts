import ts from "typescript";
import { classify, HELPERS, SEVERITY, type Effect } from "./catalog.js";

export type Fanout = "single" | `bounded(${number})` | "unbounded";
export type Policy = "strict" | "trust-get";

export interface Finding {
  integration: string;
  op: string;
  method?: string;
  path?: string;
  effect: Effect;
  scope?: string;
  reversible?: boolean;
  sensitive?: boolean;
  fanout: Fanout;
  conditional: boolean;
  via?: string;
  line: number;
  why?: string;
}

export interface Manifest {
  file: string;
  title?: string;
  findings: Finding[];
  verdict: "AUTO_RUN_SAFE" | "REQUIRES_APPROVAL";
  risk: "none" | "low" | "medium" | "high";
  reasons: string[];
  scopesRequired: string[];
}

type Draft = Omit<Finding, "fanout" | "conditional" | "line" | "via">;
interface Context { fanout: Fanout; conditional: boolean; fn?: string }

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_DEPTH = 8;
const ITERATORS = new Set(["map", "forEach", "flatMap", "filter", "reduce", "some", "every"]);
// Frozen at the version written before heldout2 existed, so the trust-get result stays reproducible.
// Secrets are a per-endpoint label problem, not a regex problem.
const SENSITIVE_PATH = /verificationCodes|factors\/.*\/secret|\/passwords?\b|\/tokens\b/i;
const NETWORK_GLOBALS = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]);
const AMBIGUOUS = Symbol("ambiguous");

const isFn = (n: ts.Node): n is ts.ArrowFunction | ts.FunctionExpression =>
  ts.isArrowFunction(n) || ts.isFunctionExpression(n);

function unwrap(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

function rankFanout(f: Fanout) {
  return f === "single" ? 0 : f === "unbounded" ? 2 : 1;
}

export function analyze(file: string, source: string, policy: Policy = "strict"): Manifest {
  if (source.length > MAX_SOURCE_BYTES) {
    return finalize(file, undefined, [{ integration: "(input)", op: "file too large to analyze", effect: "unknown", fanout: "single", conditional: false, line: 1 }]);
  }
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const title = /@title\s+(.+)/.exec(source)?.[1]?.trim();

  const aliases = new Map<string, string>();
  const consts = new Map<string, ts.Expression | typeof AMBIGUOUS>();
  const localFns = new Map<string, ts.Node>();
  const callSites = new Map<string, ts.CallExpression[]>();
  const ctxNames = new Set(["ctx"]);

  // Pass 1: imports, consts, local functions, call sites, ctx parameter names.
  const collect = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const m = /^serval\/integrations\/(.+)$/.exec(n.moduleSpecifier.text);
      const nb = n.importClause?.namedBindings;
      if (m && nb && ts.isNamespaceImport(nb)) aliases.set(nb.name.text, m[1]);
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const name = n.name.text;
      if (ts.getCombinedNodeFlags(n) & ts.NodeFlags.Const) {
        // A name declared twice in different scopes can't be resolved safely by name alone.
        consts.set(name, consts.has(name) ? AMBIGUOUS : n.initializer);
      }
      if (isFn(n.initializer)) localFns.set(name, n.initializer);
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      localFns.set(n.name.text, n);
    } else if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === "fn" && isFn(n.initializer)) {
      const p = n.initializer.parameters[1];
      if (p && ts.isIdentifier(p.name)) ctxNames.add(p.name.text);
    } else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const list = callSites.get(n.expression.text);
      if (list) list.push(n);
      else callSites.set(n.expression.text, [n]);
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);

  const constOf = (name: string): ts.Expression | undefined => {
    const v = consts.get(name);
    return v === AMBIGUOUS ? undefined : v;
  };

  const resolveString = (e: ts.Expression | undefined, depth = 0): string | undefined => {
    if (!e || depth > MAX_DEPTH) return;
    e = unwrap(e);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => "{x}" + s.literal.text).join("");
    if (ts.isIdentifier(e)) return resolveString(constOf(e.text), depth + 1);
  };

  const resolveNumber = (e: ts.Expression | undefined, depth = 0): number | undefined => {
    if (!e || depth > MAX_DEPTH) return;
    e = unwrap(e);
    if (ts.isNumericLiteral(e)) return Number(e.text);
    if (ts.isIdentifier(e)) return resolveNumber(constOf(e.text), depth + 1);
  };

  const prop = (o: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined => {
    for (const p of o.properties) {
      if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key) return p.initializer;
      if (ts.isShorthandPropertyAssignment(p) && p.name.text === key) return p.name;
    }
  };

  const batchItems = (e: ts.Expression | undefined, depth = 0): ts.ObjectLiteralExpression[] | undefined => {
    if (!e || depth > MAX_DEPTH) return;
    e = unwrap(e);
    if (ts.isIdentifier(e)) return batchItems(constOf(e.text), depth + 1);
    if (ts.isObjectLiteralExpression(e)) return [e];
    const collectAll = (xs: readonly ts.Expression[]) => {
      const out: ts.ObjectLiteralExpression[] = [];
      for (const x of xs) {
        const sub = batchItems(ts.isSpreadElement(x) ? x.expression : x, depth + 1);
        if (!sub) return;
        out.push(...sub);
      }
      return out;
    };
    if (ts.isArrayLiteralExpression(e)) return collectAll(e.elements);
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && ["map", "flatMap"].includes(e.expression.name.text)) {
      const fn = e.arguments[0];
      if (!fn || !isFn(fn)) return;
      if (!ts.isBlock(fn.body)) return batchItems(fn.body, depth + 1);
      const returns: ts.Expression[] = [];
      const walk = (x: ts.Node): void => {
        if (ts.isReturnStatement(x) && x.expression) returns.push(x.expression);
        else if (!ts.isFunctionLike(x)) ts.forEachChild(x, walk);
      };
      walk(fn.body);
      const out = collectAll(returns);
      return out?.length ? out : undefined;
    }
  };

  const enclosingHelper = (n: ts.Node): string | undefined => {
    for (let a = n.parent; a; a = a.parent) {
      if (ts.isFunctionDeclaration(a) && a.name) return a.name.text;
      if (isFn(a) && ts.isVariableDeclaration(a.parent) && ts.isIdentifier(a.parent.name) && localFns.has(a.parent.name.text)) return a.parent.name.text;
      if (ts.isPropertyAssignment(a) && ts.isIdentifier(a.name) && a.name.text === "fn") return;
    }
  };

  const boundOf = (iter: ts.Expression): number | undefined => {
    iter = unwrap(iter);
    if (ts.isCallExpression(iter) && ts.isPropertyAccessExpression(iter.expression) && iter.expression.name.text === "slice")
      return resolveNumber(iter.arguments[1]);
  };

  const localContext = (n: ts.Node): Context => {
    let fanout: Fanout = "single";
    let conditional = false;
    const loop = (bound?: number) => {
      if (bound === undefined) fanout = "unbounded";
      else if (fanout === "single") fanout = `bounded(${bound})`;
    };
    for (let a: ts.Node | undefined = n.parent; a; a = a.parent) {
      if (ts.isFunctionDeclaration(a)) break;
      if (ts.isForOfStatement(a) || ts.isForInStatement(a)) loop(boundOf(a.expression));
      else if (ts.isForStatement(a) || ts.isWhileStatement(a) || ts.isDoStatement(a)) loop();
      else if (ts.isIfStatement(a) || ts.isConditionalExpression(a) || ts.isCatchClause(a) || ts.isCaseClause(a)) conditional = true;
      else if (isFn(a) && ts.isCallExpression(a.parent) && ts.isPropertyAccessExpression(a.parent.expression) && ITERATORS.has(a.parent.expression.name.text))
        loop(boundOf(a.parent.expression.expression));
      if (isFn(a) && ts.isVariableDeclaration(a.parent)) break;
    }
    return { fanout, conditional, fn: enclosingHelper(n) };
  };

  // A call inside a helper inherits the worst context of every site that calls the helper.
  const helperContext = new Map<string, Context>();
  const contextOf = (n: ts.Node, seen = new Set<string>()): Context => {
    const own = localContext(n);
    if (!own.fn || seen.has(own.fn)) return own;
    let inherited = helperContext.get(own.fn);
    if (!inherited) {
      seen.add(own.fn);
      inherited = { fanout: "single", conditional: false };
      for (const site of callSites.get(own.fn) ?? []) {
        const c = contextOf(site, seen);
        if (rankFanout(c.fanout) > rankFanout(inherited.fanout)) inherited.fanout = c.fanout;
        inherited.conditional ||= c.conditional;
      }
      helperContext.set(own.fn, inherited);
    }
    return {
      fanout: rankFanout(inherited.fanout) > rankFanout(own.fanout) ? inherited.fanout : own.fanout,
      conditional: own.conditional || inherited.conditional,
      fn: own.fn,
    };
  };

  const findings: Finding[] = [];
  const push = (at: ts.Node, ctxNode: ts.Node, f: Draft) => {
    const c = contextOf(ctxNode);
    findings.push({ ...f, fanout: c.fanout, conditional: c.conditional, via: c.fn, line: sf.getLineAndCharacterOfPosition(at.getStart(sf)).line + 1 });
  };

  const classifyEndpoint = (at: ts.Node, call: ts.Node, integration: string, method: string, path: string, prefix = "") => {
    const rule = classify(integration, method, path.replace(/\{[^}]+\}/g, "{x}"));
    if (!rule) {
      push(at, call, { integration, op: `${prefix}${method} ${path}`, method, path, effect: "unknown", why: "endpoint not in effect catalog" });
      return;
    }
    push(at, call, {
      integration, op: prefix + rule.label, method, path, effect: rule.effect, scope: rule.scope, reversible: rule.reversible,
      sensitive: SENSITIVE_PATH.test(path) || undefined,
    });
  };

  const classifyRequest = (call: ts.CallExpression, integration: string) => {
    const req = call.arguments[0] && unwrap(call.arguments[0]);
    if (!req || !ts.isObjectLiteralExpression(req)) {
      push(call, call, { integration, op: "apiRequest", effect: "unknown", why: "request is not a literal object" });
      return;
    }
    const methodExpr = prop(req, "method");
    const method = methodExpr ? resolveString(methodExpr) : "GET";
    const path = resolveString(prop(req, "path"));
    if (!method) return push(call, call, { integration, op: "apiRequest", path, effect: "unknown", why: "HTTP method chosen at runtime" });
    if (!path) return push(call, call, { integration, op: "apiRequest", method, effect: "unknown", why: "path not statically known" });

    if (/\/\$batch$/.test(path)) {
      const body = prop(req, "body");
      const items = batchItems(body && ts.isObjectLiteralExpression(unwrap(body)) ? prop(unwrap(body) as ts.ObjectLiteralExpression, "requests") : undefined);
      if (!items) return push(call, call, { integration, op: "$batch", method, path, effect: "unknown", why: "batch contents not statically known" });
      for (const item of items) {
        const m = prop(item, "method");
        const itemMethod = m ? resolveString(m) : "GET";
        const url = resolveString(prop(item, "url"));
        if (!itemMethod || !url) push(item, call, { integration, op: "$batch item", effect: "unknown", why: "batch item not statically known" });
        else classifyEndpoint(item, call, integration, itemMethod, "/v1.0" + url, "$batch: ");
      }
      return;
    }
    classifyEndpoint(call, call, integration, method, path);
  };

  const aliasChain = (e: ts.Expression): { integration: string; chain: string[] } | undefined => {
    const chain: string[] = [];
    let cur = unwrap(e);
    while (ts.isPropertyAccessExpression(cur)) {
      chain.unshift(cur.name.text);
      cur = unwrap(cur.expression);
    }
    if (ts.isIdentifier(cur) && aliases.has(cur.text)) return { integration: aliases.get(cur.text)!, chain };
  };

  const rootName = (e: ts.Expression): string | undefined => {
    let cur = unwrap(e);
    while (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) cur = unwrap(cur.expression);
    return ts.isIdentifier(cur) ? cur.text : undefined;
  };

  // Pass 2: effects.
  const inspect = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const callee = unwrap(n.expression);
      const known = aliasChain(callee);

      if (ts.isElementAccessExpression(callee)) {
        const base = aliasChain(callee.expression);
        if (base) push(n, n, { integration: base.integration, op: `${callee.expression.getText(sf)}[<dynamic>]`, effect: "unknown", why: "operation chosen at runtime" });
      } else if (known) {
        const name = known.chain.join(".");
        if (name === "apiRequest") classifyRequest(n, known.integration);
        else if (known.chain[0] !== "context") {
          const h = HELPERS[known.integration]?.[name];
          push(n, n, h
            ? { integration: known.integration, op: h.label, effect: h.effect, scope: h.scope, reversible: h.reversible }
            : { integration: known.integration, op: name, effect: "unknown", why: "typed helper not in effect catalog" });
        }
      } else if (ts.isPropertyAccessExpression(callee) && callee.name.text === "apiRequest") {
        classifyRequest(n, rootName(callee) ?? "(unknown)");
      } else if (ts.isPropertyAccessExpression(callee) && rootName(callee) === "serval") {
        const text = callee.getText(sf);
        if (!text.startsWith("serval.context.")) push(n, n, { integration: "serval", op: text, effect: "unknown", why: "platform call not in effect catalog" });
      } else if (ts.isIdentifier(callee) && NETWORK_GLOBALS.has(callee.text)) {
        push(n, n, { integration: "(raw network)", op: `${callee.text} ${resolveString(n.arguments[0]) ?? "<dynamic url>"}`, effect: "unknown", why: "network call outside the integration proxy" });
      } else if (!(ts.isIdentifier(callee) && localFns.has(callee.text)) && n.arguments.some((a) => ts.isIdentifier(a) && ctxNames.has(a.text))) {
        push(n, n, { integration: "(unrecognized)", op: callee.getText(sf).slice(0, 60), effect: "unknown", why: "receives integration context but is not a recognized call" });
      }
    } else if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && NETWORK_GLOBALS.has(n.expression.text)) {
      push(n, n, { integration: "(raw network)", op: `new ${n.expression.text}`, effect: "unknown", why: "network call outside the integration proxy" });
    }
    ts.forEachChild(n, inspect);
  };
  inspect(sf);

  if (policy === "trust-get") {
    for (const f of findings) {
      if (f.effect === "unknown" && f.method === "GET" && f.path) {
        f.effect = "read";
        f.why = "assumed read under trust-get policy";
        f.sensitive = SENSITIVE_PATH.test(f.path) || undefined;
      }
    }
  }
  return finalize(file, title, findings);
}

export function finalize(file: string, title: string | undefined, findings: Finding[]): Manifest {
  const uniq = (xs: string[]) => [...new Set(xs)].join("; ");
  const nonRead = findings.filter((f) => f.effect !== "read");
  const sensitive = findings.filter((f) => f.sensitive);
  const unbounded = nonRead.filter((f) => f.fanout === "unbounded");
  const irreversible = findings.filter((f) => f.effect === "destructive" && f.reversible === false);
  const unknown = findings.some((f) => f.effect === "unknown");
  const max = Math.max(-1, ...findings.map((f) => SEVERITY[f.effect]));

  const reasons: string[] = [];
  if (nonRead.length) reasons.push(`${nonRead.length} non-read effect(s): ${uniq(nonRead.map((f) => f.effect))}`);
  if (sensitive.length) reasons.push(`returns secret material: ${uniq(sensitive.map((f) => f.op))}`);
  if (unbounded.length) reasons.push(`unbounded fan-out: ${uniq(unbounded.map((f) => f.op))}`);
  if (irreversible.length) reasons.push(`irreversible: ${uniq(irreversible.map((f) => f.op))}`);

  const safe = nonRead.length === 0 && sensitive.length === 0;
  let risk: Manifest["risk"] = safe ? "none" : "low";
  if (max >= SEVERITY.write || sensitive.length) risk = "medium";
  if (unknown || (irreversible.length && unbounded.length) || (max >= SEVERITY.unknown && (unbounded.length || irreversible.length))) risk = "high";

  return {
    file, title, findings,
    verdict: safe ? "AUTO_RUN_SAFE" : "REQUIRES_APPROVAL",
    risk, reasons,
    scopesRequired: [...new Set(findings.flatMap((f) => (f.scope ? [f.scope] : [])))].sort(),
  };
}

const MUTATING_NAME = /^(create|update|delete|remove|add|suspend|deactivate|reset|set|send|revoke|grant|assign|unassign|patch|put)/i;

// Baseline: read-only if every apiRequest is a GET and no helper name starts with a mutating verb.
export function naiveReadOnly(source: string): boolean {
  const sf = ts.createSourceFile("x.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  let readOnly = true;
  const visit = (n: ts.Node): void => {
    if (!readOnly) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const name = n.expression.name.text;
      const arg = n.arguments[0];
      if (name === "apiRequest" && arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties)
          if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "method" && ts.isStringLiteral(p.initializer) && p.initializer.text !== "GET") readOnly = false;
      } else if (name !== "apiRequest" && MUTATING_NAME.test(name)) readOnly = false;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return readOnly;
}
