"""Delete all experience files classified as 'general' (other module)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
INDEX_PATH = EXP_DIR / "index.json"


def main() -> None:
    idx = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    records = [r for r in idx["experiences"] if r.get("role") == "general"]

    print(f"Deleting {len(records)} 'general' experience files:")
    for rec in records:
        path = ROOT / rec["path"]
        if path.exists():
            path.unlink()
            print(f"  deleted: {rec['title']}")
        else:
            print(f"  missing: {rec['id']} at {rec['path']}")


if __name__ == "__main__":
    main()
