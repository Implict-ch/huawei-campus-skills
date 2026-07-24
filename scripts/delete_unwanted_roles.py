"""Delete local experience files for roles/modules that should be removed."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
INDEX_PATH = EXP_DIR / "index.json"

MECH_KW = ["机械", "结构", "制造", "材料", "车辆"]
PROD_KW = ["客户经理", "产品经理", "运营", "项目经理", "销售", "商务", "售前", "服务"]
FUNC_KW = ["财务", "法务", "人力", "行政", "审计", "供应链", "财经"]


def matches(title: str, keywords: list[str]) -> bool:
    return any(k in title for k in keywords)


def main() -> None:
    idx = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    records = idx["experiences"]

    to_delete = []
    for rec in records:
        title = rec["title"]
        if matches(title, MECH_KW) or matches(title, PROD_KW) or matches(title, FUNC_KW):
            to_delete.append(rec)

    print(f"Deleting {len(to_delete)} experience files:")
    for rec in to_delete:
        path = EXP_DIR / f"{rec['id']}.md"
        if path.exists():
            path.unlink()
            print(f"  deleted: {rec['title']}")
        else:
            print(f"  missing: {rec['id']}")


if __name__ == "__main__":
    main()
