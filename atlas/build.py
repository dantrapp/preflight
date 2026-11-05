#!/usr/bin/env python3
"""Label every endpoint in five IT APIs with the vendor's own scope model, then count where
the HTTP verb disagrees with it. Output is a candidate list, not ground truth (see suite.json)."""
import collections
import json
import re
from pathlib import Path

import yaml

HERE = Path(__file__).parent
SPECS = HERE / "specs"
METHODS = {"get", "post", "put", "patch", "delete"}
READ_PERM = re.compile(r"\.Read(Basic)?(\.|$)")
SLACK_READ = re.compile(r":(read|history)|^(identity|tokens)\.basic$")
SECRET = re.compile(r"recoverykey|bitlocker|localcredential|laps|password|secret|verificationcode|backup.?code|"
                    r"private.?key|signingkey|client.?secret|/keys?\b|credential|\btokens?\b|apitoken|sharedkey", re.I)
NAME_READ = re.compile(r"^(get|list|check|verify|validate|test|preview|search|find|lookup|fetch|read|view|query|describe)", re.I)


def row(vendor, method, path, op, scopes, scope_class, desc="", **extra):
    return dict(vendor=vendor, method=method.upper(), path=path, op=op, scopes=sorted(set(scopes)),
                scope_class=scope_class, desc=(desc or "")[:400], **extra)


def okta():
    spec = yaml.load((SPECS / "okta.yaml").read_text(), Loader=yaml.CSafeLoader)
    for path, item in spec["paths"].items():
        for m, o in item.items():
            if m not in METHODS:
                continue
            scopes = [s for sec in o.get("security", []) for s in sec.get("oauth2", [])]
            if scopes:
                cls = "read" if any(s.endswith(".read") for s in scopes) else "write"
                yield row("okta", m, path, o.get("operationId", ""), scopes, cls, f"{o.get('summary', '')} {o.get('description') or ''}")


def google():
    spec = json.loads((SPECS / "gws-directory.json").read_text())
    stack = [spec]
    while stack:
        node = stack.pop()
        for res in node.get("resources", {}).values():
            stack.append(res)
            for mv in res.get("methods", {}).values():
                scopes = [s.rsplit("/", 1)[-1] for s in mv.get("scopes", [])]
                cls = "read" if any(s.endswith(".readonly") for s in scopes) else "write"
                yield row("google", mv["httpMethod"], "/" + mv.get("flatPath", mv["path"]), mv["id"], scopes, cls, mv.get("description", ""))


def graph():
    perms = json.loads((SPECS / "graph-permissions.json").read_text())["permissions"]
    grants = collections.defaultdict(lambda: {"perms": set(), "desc": set()})
    for name, p in perms.items():
        desc = next((s.get("adminDescription") for s in p["schemes"].values() if s.get("adminDescription")), "")
        for ps in p.get("pathSets", []):
            for path, note in ps["paths"].items():
                also = re.findall(r"AlsoRequires=([\w.\-]+)", note or "")
                # A read permission that also requires a write permission is not a read grant.
                effective = name if not any("Write" in a for a in also) else "+".join([name, *also])
                for m in ps["methods"]:
                    g = grants[(m.upper(), path.lower())]
                    g["perms"].add(effective)
                    g["desc"].add(desc)

    def level(p):
        schemes = perms[p.split("+")[0]]["schemes"].values()
        return min((s.get("privilegeLevel") or 9) for s in schemes)

    for (m, path), g in grants.items():
        reads = sorted(p for p in g["perms"] if READ_PERM.search(p) and "Write" not in p)
        yield row("graph", m, path, "", g["perms"], "read" if reads else "write", " | ".join(sorted(d for d in g["desc"] if d)),
                  least_privilege_level=min(level(p) for p in g["perms"]), read_perms=reads)


def jira():
    spec = json.loads((SPECS / "jira-v3.json").read_text())
    for path, item in spec["paths"].items():
        for m, o in item.items():
            if m not in METHODS:
                continue
            entries = o.get("x-atlassian-oauth2-scopes", [])
            scopes = [s for e in entries if e.get("state") == "Current" for s in e.get("scopes", [])] or \
                     [s for e in entries for s in e.get("scopes", [])]
            if scopes:
                cls = "read" if all(s.startswith("read:") for s in scopes) else "write"
                yield row("jira", m, path, o.get("operationId", ""), scopes, cls, f"{o.get('summary', '')} {(o.get('description') or '')[:300]}")


def slack():
    spec = json.loads((SPECS / "slack.json").read_text())
    for path, item in spec["paths"].items():
        for m, o in item.items():
            if m not in ("get", "post"):
                continue
            scopes = [x for sec in o.get("security", []) for v in sec.values() for x in v if x != "none"]
            if scopes:
                cls = "read" if all(SLACK_READ.search(x) for x in scopes) else "write"
                yield row("slack", m, path, o.get("operationId", path.strip("/")), scopes, cls, o.get("description", ""))


def annotate(r):
    verb_read = r["method"] == "GET"
    r["verb_says"] = "read" if verb_read else "write"
    r["disagree"] = ("write-verb, vendor-read" if not verb_read and r["scope_class"] == "read"
                     else "GET, vendor-write-scope" if verb_read and r["scope_class"] == "write" else "")
    r["secret_candidate"] = r["scope_class"] == "read" and bool(SECRET.search(f"{r['path']} {r['op']}"))
    name = r["op"].split(".")[-1] if r["op"] else r["path"].rstrip("/").split("/")[-1]
    r["name_says_read_but_vendor_write"] = not verb_read and r["scope_class"] == "write" and bool(NAME_READ.search(name))
    return r


def main():
    rows = [annotate(r) for source in (okta, google, graph, jira, slack) for r in source()]
    with open(HERE / "atlas.jsonl", "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")

    cols = [("endpoints", lambda r: True), ("GET", lambda r: r["method"] == "GET"),
            ("non-GET, vendor read", lambda r: r["disagree"].startswith("write-verb")),
            ("GET, vendor write", lambda r: r["disagree"].startswith("GET")),
            ("read + secret?", lambda r: r["secret_candidate"]),
            ("read name, vendor write", lambda r: r["name_says_read_but_vendor_write"])]
    print(f"{'vendor':8}" + "".join(f"{c:>24}" for c, _ in cols))
    for vendor in ("okta", "google", "graph", "jira", "slack", None):
        sub = [r for r in rows if vendor is None or r["vendor"] == vendor]
        print(f"{vendor or 'TOTAL':8}" + "".join(f"{sum(map(fn, sub)):>24}" for _, fn in cols))


if __name__ == "__main__":
    main()
