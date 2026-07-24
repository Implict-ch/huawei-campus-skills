#!/usr/bin/env python3
"""删除招聘广告、宣传帖、问答求助帖等非面经内容。

用法:
  python scripts/filter_non_experience.py --dry-run
  python scripts/filter_non_experience.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
REPORT = ROOT / "frontend" / "tmp" / "filter_non_experience_report.json"

INTERVIEW_MARKERS = [
    "一面", "二面", "三面", "四面", "五面",
    "主管面", "技术面", "专业面", "综合面", "HR面", "hr面",
    "面试官", "面试过程", "面试经历", "面试体验", "面试流程",
    "手撕", "问了我", "他问", "面试官问", "自我介绍", "反问",
    "问了", "问一些", "项目追问", "专业问题",
]

# 标题强特征：基本不是面经
TITLE_SPAM = re.compile(
    r"("
    r"招聘|内推码|内推码|直招|缺人|重磅来袭|火热进行中|通道开启|欢迎投递|欢迎骚扰|"
    r"辅导|有偿|接单|代做|包你满意|加微信|加[微v]|wx\s*:|"
    r"FAQ|常见问题|相关问题|申请进度|进度查询|"
    r"许愿|求offer|求个|蹲一个|有没有人|求助|急问|问问|"
    r"题单|题库推荐|真题合集|刷题群|"
    r"宣讲会|空宣|开放日|打卡打卡"
    r")",
    re.I,
)

# 正文招聘/宣传特征
BODY_RECRUIT = [
    "招聘对象", "投递流程", "投递方式", "投递链接", "投递入口",
    "内推码", "内推链接", "岗位列表", "岗位介绍", "招聘岗位",
    "简历投递", "官网投递", "立即投递", "点击投递",
    "校招正式启动", "火热进行中", "重磅来袭", "通道已开启",
    "欢迎投递", "虚位以待", "简历直通", "大量HC", "招贤纳士",
]

BODY_PROMO = [
    "牛客题库", "机试题单", "加入刷题群", "扫码进群",
    "关注公众号", "私聊领取", "免费领取", "限时免费",
    "面试辅导", "一对一辅导", "保过", "包过",
]

# 纯问答/进度求助
QA_PATTERNS = re.compile(
    r"("
    r"我想问|请问一下|有没有.*[吗嘛]|怎么办|怎么弄|"
    r"是不是代表|代表.*过了吗|有没有收到|多久能收到|"
    r"还没收到|一直没消息|卡在|进度.*怎么|"
    r"求问|求大佬|有人知道吗"
    r")",
    re.I,
)

META_LINE = re.compile(r"^- (作者|来源|分类)：")


def extract(path: Path) -> tuple[str, str, str, dict]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    fm = {}
    body = raw
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            body = parts[2]
            for line in parts[1].splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    fm[k.strip()] = v.strip().strip('"')
    m = re.search(r"^#\s+(.+)$", body, re.M)
    title = (m.group(1).strip() if m else "") or str(fm.get("id") or path.stem)
    # source title from frontmatter yaml-ish
    source_title = ""
    for line in raw.splitlines():
        if "title:" in line and "sources" not in line:
            source_title = line.split("title:", 1)[-1].strip().strip('"')
            if source_title and source_title != title:
                break
    lines = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith("# ") or META_LINE.match(s):
            continue
        lines.append(s)
    content = "\n".join(lines).strip()
    return title, source_title, content, fm


def effective_len(content: str) -> int:
    flat = re.sub(r"https?://\S+", "", content)
    flat = re.sub(r"!\[.*?\]\(.*?\)", "", flat)
    flat = re.sub(r"\[.*?\]\(.*?\)", "", flat)
    flat = re.sub(r"\s+", "", flat)
    return len(flat)


def interview_signal(content: str) -> int:
    score = 0
    for m in INTERVIEW_MARKERS:
        if m in ("问了", "问一些"):
            score += min(content.count(m), 5)
        elif m in content:
            score += 1
    return score


def classify(path: Path) -> tuple[bool, str]:
    """返回 (should_delete, reason)。"""
    title, source_title, content, fm = extract(path)
    full_title = f"{title} {source_title}"
    platform = ""
    raw = path.read_text(encoding="utf-8", errors="replace")
    if "platform: codefun2000" in raw:
        platform = "codefun2000"

    chars = effective_len(content)
    # 标题+正文一起算面试信号，避免短面经（如主管面）被误删
    iv = interview_signal(full_title + "\n" + content)

    # 资料引流/组团领取：即使标题带「面经」也删
    if any(k in content for k in ("组团即可免费领取", "点击马上领取", "专栏售价", "不收费，3人组团")):
        return True, "material_promo"

    # 空/过短且无面试信号
    if chars < 60 and iv < 1:
        return True, "empty_or_too_short"

    # 标题广告/宣传/求助
    if TITLE_SPAM.search(full_title) and iv < 2:
        return True, "title_spam_or_qa"

    # 招聘广告正文
    recruit_hits = sum(1 for k in BODY_RECRUIT if k in content or k in full_title)
    if recruit_hits >= 2 and iv < 2:
        return True, "recruitment_ad"
    if recruit_hits >= 1 and iv < 1 and chars < 400:
        return True, "recruitment_ad_weak"

    # 宣传/辅导/引流
    promo_hits = sum(1 for k in BODY_PROMO if k in content or k in full_title)
    if promo_hits >= 2 and iv < 2:
        return True, "promotion_spam"
    if promo_hits >= 1 and iv < 1:
        return True, "promotion_spam_weak"

    # 纯问答求助（短文）
    if chars < 220 and QA_PATTERNS.search(content) and iv < 2:
        return True, "qa_help_post"
    if chars < 160 and QA_PATTERNS.search(full_title) and iv < 2:
        return True, "qa_help_title"

    # 纯进度/offer 状态帖
    status_kw = ["口头offer", "已offer", "申请进度", "测评通知", "性格测试通知", "机考一个星期"]
    if any(k in full_title for k in status_kw) and iv < 2 and chars < 300:
        return True, "status_or_progress_post"

    # 纯题单/真题宣传（无面试过程）
    if (("题单" in content or "题库" in content) and ("真题" in content or "笔试" in content)) and iv < 2:
        if "输入描述" in content or "样例" in content or chars < 500:
            return True, "problem_set_promo"

    # CodeFun：无面试流程且像算法题；有面经标题的短文保留
    if platform == "codefun2000":
        if any(k in content for k in ("输入描述", "输出描述", "样例输入", "数据范围")) and iv < 1:
            return True, "codefun_pure_problem"
        if "面经" in full_title or iv >= 1:
            return False, "keep"

    # 几乎无实质内容的水帖
    if chars < 100 and iv < 1:
        return True, "low_content"

    return False, "keep"


def iter_files():
    for path in EXP_DIR.rglob("hw-exp-*.md"):
        rel_parents = path.relative_to(EXP_DIR).parts[:-1]
        if any(p.startswith("_") or p.startswith(".") for p in rel_parents):
            continue
        yield path


def main() -> int:
    dry = "--dry-run" in sys.argv
    delete_rows = []
    keep = 0
    reasons = Counter()

    for path in iter_files():
        should_delete, reason = classify(path)
        if not should_delete:
            keep += 1
            continue
        title, _, content, _ = extract(path)
        delete_rows.append(
            {
                "path": str(path.relative_to(ROOT)).replace("\\", "/"),
                "id": path.stem,
                "reason": reason,
                "title": title[:120],
                "chars": effective_len(content),
            }
        )
        reasons[reason] += 1
        if not dry:
            path.unlink()

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(delete_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"keep={keep} delete={len(delete_rows)} dry_run={dry}")
    print("reasons:", dict(reasons))
    print(f"report -> {REPORT}")
    print("samples:")
    for row in delete_rows[:30]:
        print(f"  [{row['reason']}] {row['id']} | {row['title']}")
    if len(delete_rows) > 30:
        print(f"  ... and {len(delete_rows) - 30} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
