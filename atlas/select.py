#!/usr/bin/env python3
"""Pick the candidate traps from atlas.jsonl that were then checked by hand against vendor docs."""
import collections
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
DEVICE_MGMT = re.compile(r"devicemanagement|deviceappmanagement")
GRAPH_ACTION = re.compile(r"/(getmembergroups|checkmembergroups|getmemberobjects|checkmemberobjects|getbyids|getschedule|"
                          r"findmeetingtimes|validateproperties|getavailableextensionproperties|evaluate\w*|get\w+|check\w+)$")
GRAPH_STATE_CHANGE = re.compile(r"/(rotate\w+|wipe|retire|reboot\w*|syncdevice|remotelock|resetpasscode|locatedevice|"
                                r"createserverlogcollectionrequest)$", re.I)

rows = [json.loads(line) for line in open(HERE / "atlas.jsonl")]
picked, seen = [], set()


def take(cls, pred, cap=None):
    hits = [r for r in rows if pred(r)][:cap]
    for r in hits:
        key = (r["vendor"], r["method"], r["path"])
        if key not in seen:
            seen.add(key)
            picked.append(dict(cls=cls, vendor=r["vendor"], method=r["method"], path=r["path"], op=r["op"],
                               scopes=r["scopes"][:6], desc=r["desc"][:200]))


take("C1 write-verb, vendor-read", lambda r: r["vendor"] != "graph" and r["disagree"] == "write-verb, vendor-read")
take("C2 GET, vendor-write-scope", lambda r: r["vendor"] not in ("graph", "jira") and r["disagree"] == "GET, vendor-write-scope")
take("C2 GET, vendor-write-scope", lambda r: r["vendor"] == "jira" and r["disagree"] == "GET, vendor-write-scope", 6)
take("C1 write-verb, vendor-read", lambda r: r["vendor"] == "graph" and r["disagree"] == "write-verb, vendor-read"
     and GRAPH_ACTION.search(r["path"]) and not DEVICE_MGMT.search(r["path"]) and r["path"].count("{id}") <= 1, 25)
take("C3 vendor-read, secret?", lambda r: r["secret_candidate"] and not re.search(r"devicemanagement|reports/", r["path"])
     and r["path"].count("{id}") <= 2, 40)
take("C4 read name, vendor-write", lambda r: r["name_says_read_but_vendor_write"] and not DEVICE_MGMT.search(r["path"]), 30)
take("C5 vendor map grants state change to .Read", lambda r: r["vendor"] == "graph" and r["disagree"] == "write-verb, vendor-read"
     and GRAPH_STATE_CHANGE.search(r["path"]) and r["path"].count("{id}") <= 1, 10)

(HERE / "candidates.json").write_text(json.dumps(picked, indent=1))
print(len(picked), dict(collections.Counter(p["cls"] for p in picked)))
