#!/usr/bin/env python3
"""Try to fetch CodeFun2000 hwmj problemset catalog from public page embed."""
import json
import re
import urllib.request

URL = "https://codefun2000.com/problemset/hwmj"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r"window\.UiContextNew\s*=\s*'(\{.*?\})';", html, re.DOTALL)
    if not m:
        print("UiContextNew not found")
        return
    raw = m.group(1).encode("utf-8").decode("unicode_escape")
    data = json.loads(raw)
    ps = data.get("ps", {})
    print("psid:", data.get("psid"))
    print("name:", ps.get("name"))
    print("totalProblems:", data.get("totalProblems"))
    print("have:", data.get("have"))
    print("nodes count:", len(data.get("nodes") or []))
    print("allAlgTags count:", len(data.get("allAlgTags") or []))
    if data.get("nodes"):
        print("sample node:", json.dumps(data["nodes"][0], ensure_ascii=False)[:500])


if __name__ == "__main__":
    main()
