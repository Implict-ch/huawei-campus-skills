"""语义过滤面经：只保留与华为校招实质相关的面经。

使用 BGE 向量模型 + 关键词规则，判断每篇面经是否真正关于华为面试。
用法：py -3.11 scripts/semantic_filter_huawei.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path

import frontmatter
import numpy as np
from sentence_transformers import SentenceTransformer

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
OTHER_DIR = EXP_DIR / "_other" / "non-huawei-semantic"

# 华为相关语义参考文本
HUAWEI_REF = [
    "华为校招面试经验",
    "华为技术面经",
    "华为实习面经",
    "华为秋招面经",
    "华为春招面经",
    "华为机考笔试",
    "华为一面二面主管面",
    "华为offer入池",
]

# 正向关键词：出现这些说明大概率是华为相关
POSITIVE_KEYWORDS = [
    "华为",
    "华子",
    "huawei",
    "HUAWEI",
    "Huawei",
    "菊厂",
    "hw",
    "海思",
    "2012实验室",
    "鸿蒙",
    "华为校招",
    "华为实习",
    "华为秋招",
    "华为春招",
    "华为面试",
    "华为一面",
    "华为二面",
    "华为主管面",
    "华为机考",
    "华为笔试",
    "华为测评",
    "华为入池",
    "华为保温",
    "华为报批",
]

# 负面公司：这些公司的面经应删除（注意区分平台名和公司名）
NEGATIVE_COMPANIES = [
    "拼多多",
    "pdd",
    "PDD",
    "字节跳动",
    "抖音",
    "腾讯",
    "阿里",
    "阿里巴巴",
    "淘宝",
    "天猫",
    "美团",
    "百度",
    "京东",
    "快手",
    "网易",
    "滴滴",
    "OPPO",
    "vivo",
    "中兴",
    "联想",
    "虾皮",
    "携程",
    "B站",
    "哔哩哔哩",
    "大疆",
    "海康威视",
    "科大讯飞",
    "深信服",
    "用友",
    "金山",
    "搜狐",
    "新浪",
    "360",
    "奇安信",
    "旷视",
    "商汤",
    "小红书面试",
    "小红书校招",
    "小红书实习",
    "小红书一面",
    "小红书二面",
    "小红书算法",
    "小红书面经",
]

# 明确去其他公司面试的表述
EXPLICIT_OTHER_PATTERNS = [
    r"最近面了(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)",
    r"面试的是(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)",
    r"我去了(字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)",
    r"(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)面试",
    r"(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)二面",
    r"(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)一面",
    r"(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)校招",
    r"(拼多多|字节跳动|腾讯|阿里|美团|百度|京东|快手|网易|滴滴|小红书|B站|哔哩哔哩|大疆|海康威视|科大讯飞|深信服|小米|OPPO|vivo|荣耀|中兴|联想|携程|旷视|商汤)实习",
]


def compute_similarity(texts: list[str], ref_texts: list[str], model: SentenceTransformer) -> np.ndarray:
    text_embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    ref_embeddings = model.encode(ref_texts, normalize_embeddings=True, show_progress_bar=False)
    return text_embeddings @ ref_embeddings.T


def has_interview_process(content: str) -> bool:
    """判断内容是否为面试流程记录（而非纯算法题）"""
    markers = ["一面", "二面", "三面", "主管面", "技术面", "专业面", "综合面", "面试流程", "面试过程", "hr面", "HR面"]
    return any(m in content for m in markers)


def effective_content_length(content: str) -> int:
    """计算正文有效字符长度（去掉标题、来源、图片、emoji）"""
    lines = content.splitlines()
    text_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            continue
        if line.startswith("- 来源：") or line.startswith("来源："):
            continue
        if line.startswith("- 作者：") or line.startswith("作者："):
            continue
        if line.startswith("![]"):
            continue
        text_lines.append(line)
    text = " ".join(text_lines)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    # 移除 emoji
    text = re.sub(r"[\U00010000-\U0010ffff]", "", text)
    return len(text.strip())


def is_deleted_or_empty(content: str) -> bool:
    """判断原文是否已删除或内容为空/无效。"""
    if effective_content_length(content) < 50:
        return True
    deleted_markers = [
        "该内容已删除",
        "内容已被删除",
        "帖子已被删除",
        "原帖已删除",
        "原文已删除",
        "页面不存在",
        "内容不存在",
        "链接已失效",
    ]
    return any(m in content for m in deleted_markers)


def is_recruitment_ad(content: str, title: str) -> bool:
    """判断是否为招聘/内推广告（非面经）。"""
    title_has_recruitment = any(k in title for k in ["招聘", "内推", "重磅来袭", "火热进行中", "欢迎投递"])
    content_has_recruitment = any(
        k in content
        for k in ["招聘对象", "投递流程", "内推码", "投递链接", "岗位列表", "投递方式", "实习地点"]
    )
    # 具体面试流程描述足够多，说明是真正的面经
    interview_markers = ["一面", "二面", "三面", "主管面", "技术面", "专业面", "综合面"]
    interview_count = sum(1 for m in interview_markers if m in content)
    return title_has_recruitment and content_has_recruitment and interview_count < 2


def is_problem_set_promotion(content: str) -> bool:
    """判断是否为题单/题库宣传帖（非面经）。"""
    has_tiku = "牛客题库" in content or "机试题单" in content or "题单" in content
    has_real = "笔试真题" in content or "真题" in content
    has_huawei = "华为" in content
    interview_markers = [
        "面试官", "面试过程", "面试经历", "面试体验", "面试流程",
        "一面", "二面", "三面", "主管面", "技术面", "专业面", "综合面", "HR面", "hr面",
        "我回答", "我答", "问我", "问了", "他问我", "面试官问",
        "聊天", "交谈",
    ]
    interview_count = sum(1 for m in interview_markers if m in content)
    return has_tiku and has_real and has_huawei and interview_count < 2


def is_pure_problem_solution(content: str) -> bool:
    """判断内容是否为纯笔试题讲解（非面经）。

    特征：包含多道题目或完整单题题解（输入/输出描述、样例、代码块），
    且缺少面试流程/主观面试描述。
    """
    # 匹配第 1 题、第1题、第一题、第 2 题 等带空格变体
    problem_count = len(re.findall(r"第\s*[1-5一二三四五]\s*题", content))

    explanation_markers = [
        "输入描述", "输出描述", "样例输入", "样例输出",
        "参考题解", "解题思路", "代码实现", "数据范围",
        "时间复杂度", "空间复杂度", "AC代码", "通过代码",
    ]
    explanation_count = sum(1 for m in explanation_markers if m in content)

    # 必须有代码块才算完整题解
    has_code_block = (
        "```" in content
        or "int main" in content
        or "public class" in content
        or "def " in content
    )

    # 多道题 或 单题但输入/输出/样例/代码完整
    is_multi_problems = problem_count >= 2 and explanation_count >= 1 and has_code_block
    is_single_detailed = (
        problem_count >= 1
        and all(m in content for m in ("输入描述", "输出描述"))
        and any(m in content for m in ("样例输入", "样例输出"))
        and has_code_block
    )
    if not (is_multi_problems or is_single_detailed):
        return False

    # 面试流程/主观描述（仅使用明确指向面试对话的词汇）
    interview_markers = [
        "面试官", "面试过程", "面试经历", "面试体验", "面试流程",
        "一面", "二面", "三面", "主管面", "技术面", "专业面", "综合面", "HR面", "hr面",
        "我回答", "我答", "问我", "问了", "他问我", "面试官问",
        "聊天", "交谈",
    ]
    interview_count = sum(1 for m in interview_markers if m in content)
    # 面试描述极少则判定为纯题解
    return interview_count < 2


def classify(path: Path, model: SentenceTransformer) -> tuple[bool | None, str, float]:
    raw = path.read_text(encoding="utf-8")
    post = frontmatter.loads(raw)
    data = post.metadata
    content = post.content

    source = data.get("sources")
    source = source[0] if isinstance(source, list) and source else {}
    title = str(data.get("title") or source.get("title") or "").strip()
    source_title = str(source.get("title") or "").strip()
    platform = str(source.get("platform") or "").lower()

    # 全文本（标题 + 来源标题 + 正文前 1500 字）
    full_text = f"{title}\n{source_title}\n{content[:1500]}"

    # 1. 明确去其他公司面试 -> 直接删除
    for pattern in EXPLICIT_OTHER_PATTERNS:
        if re.search(pattern, content):
            return False, "explicit_other_company", 0.0

    # 2. 原文已删除或内容为空/无效 -> 删除
    if is_deleted_or_empty(content):
        return False, "deleted_or_empty_content", 0.0

    # 3. 标题中明确是负面公司且没有华为关键词 -> 删除
    has_negative_title = any(k in title or k in source_title for k in NEGATIVE_COMPANIES)
    has_positive_title = any(k in title or k in source_title for k in POSITIVE_KEYWORDS)
    if has_negative_title and not has_positive_title:
        return False, "negative_title", 0.0

    # 4. CodeFun2000 hwmj 站内面经：默认保留面试流程记录，删除纯算法题
    if platform == "codefun2000":
        if has_interview_process(content):
            return True, "codefun2000_interview_process", 0.0
        else:
            # 纯算法题/题目解析，不是面经
            return False, "codefun2000_pure_algorithm", 0.0

    # 4. 招聘/内推广告（非面经）-> 删除
    if is_recruitment_ad(content, title + source_title):
        return False, "recruitment_ad", 0.0

    # 5. 题单/题库宣传帖（非面经）-> 删除
    if is_problem_set_promotion(content):
        return False, "problem_set_promotion", 0.0

    # 6. 纯笔试题讲解（非面经）-> 删除
    if is_pure_problem_solution(content):
        return False, "pure_problem_solution", 0.0

    # 7. 强正向关键词判断
    positive_count = sum(1 for k in POSITIVE_KEYWORDS if k in full_text)
    if positive_count >= 3:
        return True, f"strong_positive_{positive_count}", 0.0

    # 8. 语义相似度（取与多个参考文本相似度的最大值）
    sims = compute_similarity([full_text], HUAWEI_REF, model)[0]
    sim = float(sims.max())

    if sim >= 0.60:
        return True, f"semantic_high_{sim:.3f}", sim

    if positive_count >= 1 and sim >= 0.45:
        return True, f"positive_and_semantic_{positive_count}_{sim:.3f}", sim

    if positive_count >= 1:
        # 有华为关键词但语义不高，需要人工审查
        return None, f"review_positive_{positive_count}_sim_{sim:.3f}", sim

    # 9. 默认删除
    return False, f"low_similarity_{sim:.3f}", sim


def main() -> None:
    print("[filter] loading BGE model...")
    model = SentenceTransformer("BAAI/bge-small-zh-v1.5")

    files = [p for p in EXP_DIR.rglob("hw-exp-*.md") if not any(parent.name.startswith("_") for parent in p.relative_to(EXP_DIR).parents)]
    print(f"[filter] found {len(files)} experience files")

    keep: list[tuple[Path, str, float]] = []
    delete: list[tuple[Path, str, float]] = []
    review: list[tuple[Path, str, float]] = []

    for idx, path in enumerate(files, 1):
        result, reason, sim = classify(path, model)
        if result is True:
            keep.append((path, reason, sim))
        elif result is False:
            delete.append((path, reason, sim))
        else:
            review.append((path, reason, sim))
        if idx % 50 == 0:
            print(f"[filter] processed {idx}/{len(files)}")

    print(f"\n[filter] keep={len(keep)}, delete={len(delete)}, review={len(review)}")

    # 保存审查列表
    review_file = ROOT / "frontend" / "tmp" / "semantic_review.json"
    review_file.parent.mkdir(parents=True, exist_ok=True)
    review_file.write_text(
        json.dumps(
            [{"path": str(p.relative_to(ROOT)), "reason": r, "sim": sim} for p, r, sim in review],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[filter] review list saved to {review_file}")

    # 移动删除的文件
    if delete:
        OTHER_DIR.mkdir(parents=True, exist_ok=True)
        for path, reason, sim in delete:
            dest = OTHER_DIR / path.relative_to(EXP_DIR)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(path, dest)
        print(f"[filter] moved {len(delete)} files to {OTHER_DIR}")

    # 输出删除示例
    print("\n[filter] delete samples:")
    for path, reason, sim in delete[:20]:
        print(f"  [{reason}] {path.name}")

    # 输出审查示例
    print("\n[filter] review samples:")
    for path, reason, sim in review[:20]:
        print(f"  [{reason}] {path.name}")


if __name__ == "__main__":
    main()
