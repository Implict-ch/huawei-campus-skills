#!/usr/bin/env python3
"""从 matched / processed / raw 数据重建手撕题，按算法分类，包含 CodeFun 和 LeetCode 链接。"""
import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from collections import defaultdict
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
MATCHED_PATH = ROOT / "frontend" / "tmp" / "hand_tear_problems_matched.json"
PROCESSED_PATH = ROOT / "frontend" / "tmp" / "hand_tear_problems_processed.json"
RAW_PATH = ROOT / "frontend" / "tmp" / "hand_tear_problems_raw.json"
HOT100_PATH = ROOT / "knowledge" / "coding-problems" / "hot100" / "index.json"
EXP_INDEX_PATH = ROOT / "knowledge" / "experiences" / "index.json"
OUT_JSON = ROOT / "frontend" / "tmp" / "hand_tear_data.json"
OUT_MD = ROOT / "knowledge" / "coding-problems" / "hand-tear-from-experiences.md"


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_leetcode_num(url: str) -> str | None:
    if not url:
        return None
    # 严格匹配：/problems/123/ 或 /problems/123/description/ 或 /problems/123
    # 避免从 /problems/24-game/ 中误提取 24
    m = re.search(r"/problems/([0-9]+)/", url)
    if m:
        return m.group(1)
    m = re.search(r"/problems/([0-9]+)/?$", url)
    if m:
        return m.group(1)
    return None


def clean_title(title: str) -> str:
    title = title.strip()
    # 修复常见拼写错误
    title = re.sub(r"Leetcpde", "LeetCode", title, flags=re.I)
    title = re.sub(r"^(?:LeetCode|Leetcode|LC)\s*[0-9]+\.\s*", "", title, flags=re.I)
    title = re.sub(r"-原题链接$", "", title)
    title = re.sub(r"^#+\s*题目描述$", "", title)
    title = re.sub(r"^## 题目描述$", "", title)
    return title.strip()


def clean_name(name: str) -> str:
    name = name.strip()
    # 去掉常见量词前缀
    name = re.sub(r"^(?:一个|两个|三道|几道|一题|道题|题|第\s*[0-9一二三四五]+\s*[、\.\s]*)", "", name)
    name = re.sub(r"^[0-9\s\.、]+", "", name)
    name = re.sub(r"[\(\)（）\[\]【】]", "", name)
    name = re.sub(r"^(?:leetcode|lc|力扣)\s*[0-9]*[\.\s]*", "", name, flags=re.I)
    name = re.sub(r"\s+\d+\s*[、\.]*$", "", name)
    name = re.sub(r"[，,。、；;！!？?]$", "", name)
    return name.strip()


STOP_WORDS = {
    "题", "代码", "算法", "编程", "手撕", "leetcode", "力扣", "lc", "一道", "了", "一题",
    "道题", "原题", "难度", "medium", "hard", "easy", "简单", "中等", "困难", "分钟",
    "min", "写", "实现", "函数", "用", "给出", "输出", "输入", "一个", "如下", "什么",
    "怎么", "多少", "即可", "环节", "吗", "吗？", "很简单", "没写出来", "都是", "都是用纸手写",
    "c++", "c语言", "java", "python", "sql", "两个", "几道题", "道题", "题没做出来",
    "也不是很难", "共享屏幕", "ide", "直接看", "运行结果", "面完", "短信过了", "分钟",
    "快速排序", "冒泡排序", "选择排序", "插入排序", "归并排序", "堆排序", "希尔排序",
    "计数排序", "桶排序", "基数排序", "拓扑排序",
}


def is_valid_name(name: str) -> bool:
    if not name or len(name) < 2 or len(name) > 35:
        return False
    lower = name.lower()
    if lower in STOP_WORDS or name in STOP_WORDS:
        return False
    # 如果 name 包含明显不是具体题目的 stop word（如排序算法名），过滤
    for sw in STOP_WORDS:
        if len(sw) >= 3 and sw in name:
            return False
    if re.match(r"^[0-9\s]+$", name):
        return False
    if len(name) > 20 and not re.search(r"[\u4e00-\u9fa5]", name):
        return False
    return True


def extract_problem_names(line: str) -> list[str]:
    line = line.strip()
    names = []
    for m in re.finditer(r"\[([^\]]{1,50})\]\s*\(", line):
        n = clean_name(m.group(1))
        if is_valid_name(n):
            names.append(n)
    if names:
        return names
    m = re.search(
        r"手撕(?:代码|题|一道|了)?[:：]?\s*(?:leetcode|lc|力扣)?\s*[0-9]*[\.\s]*([^，,、（()\[\]【】\n]{1,50})",
        line,
        re.IGNORECASE,
    )
    if m:
        n = clean_name(m.group(1))
        n = re.sub(r"\s+\d+([、\.].*)?$", "", n).strip()
        if is_valid_name(n):
            return [n]
    m = re.search(r"手撕(?:代码|题|一道|了)?[:：]?\s*([^，,。、【】\[\]\n]{1,150})", line, re.IGNORECASE)
    if m:
        segment = m.group(1)
        parts = re.split(r"[,，、]", segment)
        for part in parts:
            part = clean_name(part)
            part = re.sub(r"^(两题|一题|道题|题|第\s*[0-9一二三四五]+\s*[、\.\s]*)", "", part).strip()
            if is_valid_name(part):
                names.append(part)
        if names:
            return names
    m = re.search(
        r"(?:力扣|leetcode|lc)[\s\.]*([0-9]{0,4})[\.\s]*([^，,、（()\[\]【】\n]{1,50})",
        line,
        re.IGNORECASE,
    )
    if m:
        n = clean_name(m.group(2))
        if is_valid_name(n):
            return [n]
    return []


SYNONYMS = {
    "合并有序链表": "合并两个有序链表",
    "K个有序链表合并": "合并K个升序链表",
    "K个一组反转链表": "K个一组翻转链表",
    "K个一组翻转链表": "K个一组翻转链表",
    "链表相加": "两数相加",
    "两数相加": "两数相加",
    "有效括号": "有效的括号",
    "滑动窗口最大值": "滑动窗口的最大值",
    "无重复字符的最长子串": "无重复字符的最长子串",
    "找到字符串中所有字母异位词": "找到字符串中所有字母异位词",
    "上台阶": "爬楼梯",
    "爬楼梯变种": "爬楼梯",
    "搜索二维矩阵": "搜索二维矩阵Ⅱ",
    "旋转图像": "旋转图像",
    "轮转数组": "轮转数组",
    "螺旋矩阵": "螺旋矩阵",
    "买卖股票": "买卖股票的最佳时机",
    "跳跃游戏": "跳跃游戏",
    "划分字母区间": "划分字母区间",
    "最长公共子序列": "最长公共子序列",
    "最长重复子数组": "最长重复子数组",
    "最长递增子序列": "最长递增子序列",
    "最长有效括号": "最长有效括号",
    "最小覆盖子串": "最小覆盖子串",
    "和为K的子数组": "和为K的子数组",
    "二叉树的中序遍历": "二叉树的中序遍历",
    "翻转二叉树": "翻转二叉树",
    "对称二叉树": "对称二叉树",
    "二叉树的直径": "二叉树的直径",
    "将有序数组转换为二叉搜索树": "将有序数组转换为二叉搜索树",
    "验证二叉搜索树": "验证二叉搜索树",
    "二叉树的右视图": "二叉树的右视图",
    "二叉树展开为链表": "二叉树展开为链表",
    "从前序与中序遍历序列构造二叉树": "从前序与中序遍历序列构造二叉树",
    "二叉树的最近公共祖先": "二叉树的最近公共祖先",
    "二叉树中的最大路径和": "二叉树中的最大路径和",
    "课程表": "课程表",
    "实现Trie": "实现Trie(前缀树)",
    "前缀树": "实现Trie(前缀树)",
    "前K个高频元素": "前K个高频元素",
    "数据流的中位数": "数据流的中位数",
    "颜色分类": "颜色分类",
    "下一个排列": "下一个排序",
    "寻找重复数": "寻找重复数",
    "柱状图中最大的矩形": "柱状图中最大的矩形",
    "简化路径": "简化路径",
    "删除链表的倒数第N个结点": "删除链表的倒数第N个结点",
    "随即链表的复制": "随即链表的复制",
    "排序链表": "排序链表",
    "LRU缓存": "LRU缓存",
    "环形链表Ⅱ": "环形链表Ⅱ",
    "环形链表2": "环形链表Ⅱ",
    "回文链表": "回文链表",
    "最小栈": "最小栈",
    "杨辉三角": "杨辉三角",
    "打家劫舍": "打家劫舍",
    "完全平方数": "完全平方数",
    "零钱兑换": "零钱兑换",
    "乘积最大子数组": "乘积最大子数组",
    "分割等和子集": "分割等和子集",
    "两个字符串的删除操作": "两个字符串的删除操作",
    "矩阵置零": "矩阵置零",
    "除自身以外数组的乘积": "除自身以外数组的乘积",
    "缺失的第一个正数": "缺失的第一个正数",
    "只出现一次的数字": "只出现一次的数字",
    "找不同": "找不同",
    "24点游戏": "24 Game",
}


def resolve_synonym(name: str) -> str:
    return SYNONYMS.get(name, name)


def title_match_score(a: str, b: str) -> float:
    a = a.lower().replace(" ", "")
    b = b.lower().replace(" ", "")
    if a == b:
        return 1.0
    if a in b or b in a:
        ratio = min(len(a), len(b)) / max(len(a), len(b))
        return 0.75 + 0.25 * ratio
    return SequenceMatcher(None, a, b).ratio()


CATEGORY_MAP = {
    "数组": "数组",
    "链表": "链表",
    "二叉树": "二叉树",
    "二分查找": "二分查找",
    "排序": "排序",
    "字符串": "字符串",
    "栈": "栈 / 队列",
    "队列": "栈 / 队列",
    "堆": "堆",
    "BFS": "BFS / DFS",
    "DFS": "BFS / DFS",
    "BFS / DFS": "BFS / DFS",
    "动态规划": "动态规划",
    "回溯": "回溯",
    "贪心": "贪心",
    "滑动窗口": "滑动窗口",
    "双指针": "双指针",
    "哈希": "哈希",
    "并查集": "并查集",
    "图论": "图论",
    "数学": "数学",
    "位运算": "位运算",
    "设计": "设计",
    "子串": "滑动窗口",
}


def normalize_category(chapter: str, title: str) -> str:
    for k, v in CATEGORY_MAP.items():
        if k in chapter:
            return v
    fallback = {
        "链表": "链表", "树": "二叉树", "二叉树": "二叉树", "二叉搜索树": "二叉树",
        "BFS": "BFS / DFS", "DFS": "BFS / DFS", "层序": "BFS / DFS", "岛屿": "BFS / DFS",
        "排列": "回溯", "组合": "回溯", "子集": "回溯", "全排列": "回溯",
        "动态规划": "动态规划", "爬楼梯": "动态规划", "不同路径": "动态规划",
        "编辑距离": "动态规划", "最长递增": "动态规划", "最长有效": "动态规划",
        "单词拆分": "动态规划", "最大子数组": "动态规划", "最小路径": "动态规划",
        "贪心": "贪心", "二分": "二分查找", "栈": "栈 / 队列", "队列": "栈 / 队列",
        "括号": "栈 / 队列", "堆": "堆", "排序": "排序", "快速": "排序", "归并": "排序", "冒泡": "排序",
        "字符串": "字符串", "回文": "字符串", "滑动窗口": "滑动窗口", "双指针": "双指针",
        "哈希": "哈希", "并查集": "并查集", "图": "图论", "拓扑": "图论", "最短": "图论",
        "数学": "数学", "位运算": "位运算", "设计": "设计", "数组": "数组", "矩阵": "数组",
    }
    for k, v in fallback.items():
        if k in title:
            return v
    return "其他"


def is_leetcode_url(url: str) -> bool:
    if not url:
        return False
    return "leetcode" in url.lower()


def canonical_title_for_lookup(title: str) -> str:
    """用于合并的标题键：去除空格、英文转小写。"""
    return re.sub(r"\s+", "", title).lower()


def main():
    matched = load_json(MATCHED_PATH)
    processed = load_json(PROCESSED_PATH)
    raw = load_json(RAW_PATH)
    hot100_data = load_json(HOT100_PATH)
    exp_index = load_json(EXP_INDEX_PATH)

    # 构建 hot100 索引
    hot100_by_num = {}
    hot100_by_title = []
    for p in hot100_data.get("problems", []):
        title_raw = p.get("title", "")
        title = clean_title(title_raw)
        num_match = re.search(r"(?:LeetCode|Leetcode)\s*([0-9]+)", title_raw, re.I)
        num = num_match.group(1) if num_match else None
        item = {
            "pid": p.get("id"),
            "chapter": p.get("chapter", ""),
            "title": title,
            "url": p.get("source_url", ""),
            "num": num,
        }
        if title:
            hot100_by_title.append(item)
        if num:
            hot100_by_num[num] = item

    # 面经索引
    exp_by_id = {}
    for rec in exp_index.get("records", []):
        exp_by_id[rec["id"]] = rec
    if not exp_by_id:
        for v in exp_index.values():
            if isinstance(v, list):
                for rec in v:
                    if isinstance(rec, dict) and "id" in rec:
                        exp_by_id[rec["id"]] = rec

    # 候选池
    candidates = []

    def add_candidate(title, codefun_url, leetcode_url, sources, score, category=""):
        if not title:
            return
        # 至少有一个链接
        if not codefun_url and not leetcode_url:
            return
        # leetcode_url 必须看起来像 leetcode
        if leetcode_url and not is_leetcode_url(leetcode_url):
            return
        candidates.append({
            "title": title,
            "codefun_url": codefun_url,
            "leetcode_url": leetcode_url,
            "sources": set(sources) if isinstance(sources, (list, set, tuple)) else {sources} if sources else set(),
            "score": score,
            "category": category,
        })

    # 1. matched.json
    for item in matched:
        title = item.get("matched_title") or item.get("title") or ""
        title = resolve_synonym(title)
        add_candidate(
            title,
            item.get("codefun_url"),
            item.get("leetcode_url"),
            item.get("sources", []),
            item.get("match_score", 0),
        )

    # 2. processed.json
    for item in processed:
        title = item.get("title") or ""
        codefun_url = item.get("codefun_url")
        leetcode_url = item.get("leetcode_url")
        sources = item.get("sources", [])

        # 尝试用题号找 hot100 中文标题
        hot100_item = None
        if leetcode_url:
            num = extract_leetcode_num(leetcode_url)
            if num and num in hot100_by_num:
                hot100_item = hot100_by_num[num]

        # 标题匹配：只有中文标题才尝试与 hot100 中文标题匹配；纯英文标题容易误匹配
        has_chinese = bool(re.search(r"[\u4e00-\u9fa5]", title))
        if not hot100_item and title and has_chinese:
            best = None
            best_score = 0
            for h in hot100_by_title:
                score = title_match_score(title, h["title"])
                if score > best_score:
                    best_score = score
                    best = h
            if best and best_score >= 0.65:
                hot100_item = best

        if hot100_item:
            title = hot100_item["title"]
            codefun_url = codefun_url or hot100_item["url"]
            category = normalize_category(hot100_item["chapter"], title)
        else:
            title = resolve_synonym(title)
            category = ""
            # 清理英文标题：LeetCode 2 -> 保留数字，尽量可识别
            if re.match(r"^LeetCode\s*[0-9]+$", title, re.I):
                title = title.strip()

        add_candidate(title, codefun_url, leetcode_url, sources, 0.8 if hot100_item else 0.5, category)

    # 3. raw 直接匹配 hot100
    for item in raw:
        line = item.get("line", "")
        if not re.search(r"手撕|leetcode|力扣|lc|算法|编程题|原题|代码题", line, re.IGNORECASE):
            continue
        names = extract_problem_names(line)
        for name in names:
            name = resolve_synonym(name)
            if not name:
                continue
            best = None
            best_score = 0
            for h in hot100_by_title:
                score = title_match_score(name, h["title"])
                if score > best_score:
                    best_score = score
                    best = h
            if best and best_score >= 0.7:
                add_candidate(
                    best["title"],
                    best["url"],
                    None,
                    {item.get("source_id")},
                    best_score,
                    normalize_category(best["chapter"], best["title"]),
                )

    # 合并候选
    # 先用 codefun_url 聚合，再用 leetcode_url 聚合，再用 title 键聚合
    by_codefun = defaultdict(list)
    by_leetcode = defaultdict(list)
    by_title = defaultdict(list)

    for c in candidates:
        if c["codefun_url"]:
            by_codefun[c["codefun_url"]].append(c)
        elif c["leetcode_url"]:
            by_leetcode[c["leetcode_url"]].append(c)
        else:
            by_title[canonical_title_for_lookup(c["title"])].append(c)

    problems = []
    seen_titles = set()

    def merge_group(group):
        if not group:
            return None
        # 选分最高、标题最长的作为代表
        best = max(group, key=lambda x: (x["score"], len(x["title"])))
        title = best["title"]
        codefun_url = best["codefun_url"] or ""
        leetcode_url = best["leetcode_url"] or ""
        category = best["category"]
        sources = set()
        for g in group:
            sources.update(g["sources"])
        # 如果 group 中其他候选有缺失的 url，补充
        for g in group:
            if not codefun_url and g["codefun_url"]:
                codefun_url = g["codefun_url"]
            if not leetcode_url and g["leetcode_url"]:
                leetcode_url = g["leetcode_url"]
            if not category and g["category"]:
                category = g["category"]
        return {
            "title": title,
            "codefun_url": codefun_url,
            "leetcode_url": leetcode_url,
            "sources": sources,
            "category": category,
        }

    for group in by_codefun.values():
        rec = merge_group(group)
        if rec:
            problems.append(rec)
            seen_titles.add(canonical_title_for_lookup(rec["title"]))

    for group in by_leetcode.values():
        rec = merge_group(group)
        if rec and canonical_title_for_lookup(rec["title"]) not in seen_titles:
            problems.append(rec)
            seen_titles.add(canonical_title_for_lookup(rec["title"]))

    for group in by_title.values():
        rec = merge_group(group)
        if rec and canonical_title_for_lookup(rec["title"]) not in seen_titles:
            problems.append(rec)
            seen_titles.add(canonical_title_for_lookup(rec["title"]))

    # 过滤有效来源并生成输出
    valid_problems = []
    for rec in problems:
        valid_sources = [sid for sid in rec["sources"] if sid in exp_by_id]
        if not valid_sources:
            continue
        if not rec["category"]:
            # 再次尝试从 hot100 找分类
            if rec["codefun_url"]:
                pid_match = re.search(r"/p/(P\d+)", rec["codefun_url"])
                pid = pid_match.group(1) if pid_match else ""
                for h in hot100_by_title:
                    if h["pid"] == pid:
                        rec["category"] = normalize_category(h["chapter"], rec["title"])
                        break
        if not rec["category"]:
            rec["category"] = "其他"

        sources = []
        for sid in sorted(valid_sources):
            meta = exp_by_id[sid]
            sources.append({
                "id": sid,
                "title": meta.get("title", sid),
                "role": meta.get("role", "software-development"),
            })
        valid_problems.append({
            "title": rec["title"],
            "codefun_url": rec["codefun_url"],
            "leetcode_url": rec["leetcode_url"],
            "category": rec["category"],
            "sources": sources,
        })

    # 使用 LeetCode 官方标题和分类修正"其他"类别题目
    LC_TITLES_PATH = ROOT / "frontend" / "tmp" / "leetcode_titles.json"
    leetcode_titles = {}
    if LC_TITLES_PATH.exists():
        try:
            leetcode_titles = load_json(LC_TITLES_PATH)
        except Exception as e:
            print(f"[warn] failed to load leetcode_titles.json: {e}")

    TAG_TO_CATEGORY = {
        "array": "数组",
        "linked-list": "链表",
        "binary-tree": "二叉树",
        "binary-search": "二分查找",
        "sorting": "排序",
        "string": "字符串",
        "stack": "栈 / 队列",
        "queue": "栈 / 队列",
        "heap": "堆",
        "dynamic-programming": "动态规划",
        "backtracking": "回溯",
        "greedy": "贪心",
        "sliding-window": "滑动窗口",
        "two-pointers": "双指针",
        "hash-table": "哈希",
        "union-find": "并查集",
        "graph": "图论",
        "math": "数学",
        "bit-manipulation": "位运算",
        "design": "设计",
        "tree": "二叉树",
        "breadth-first-search": "BFS / DFS",
        "depth-first-search": "BFS / DFS",
    }

    def extract_leetcode_slug(url: str) -> str:
        parsed = urlparse(url)
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "problems":
            return parts[1]
        return ""

    # 手动补充：数字题号 URL 的标题和分类
    MANUAL_LEETCODE_NUM = {
        "2": {"title": "两数相加", "category": "链表"},
        "47": {"title": "全排列 II", "category": "回溯"},
        "63": {"title": "不同路径", "category": "动态规划"},
        "746": {"title": "使用最小花费爬楼梯", "category": "动态规划"},
        "224": {"title": "基本计算器", "category": "栈 / 队列"},
        "389": {"title": "找不同", "category": "位运算"},
        "435": {"title": "无重叠区间", "category": "贪心"},
    }

    for rec in valid_problems:
        if rec["category"] != "其他":
            continue
        if not rec["leetcode_url"]:
            continue
        slug = extract_leetcode_slug(rec["leetcode_url"])

        # 尝试数字题号手动映射（slug 是纯数字或不在 leetcode_titles 中）
        num = extract_leetcode_num(rec["leetcode_url"]) if rec["leetcode_url"] else None
        if num and num in MANUAL_LEETCODE_NUM:
            info = MANUAL_LEETCODE_NUM[num]
            rec["title"] = info["title"]
            rec["category"] = info["category"]
            continue

        if not slug or slug not in leetcode_titles:
            continue
        info = leetcode_titles[slug]
        # 标题使用官方中文标题（translatedTitle），没有则使用 title
        new_title = info.get("translatedTitle") or info.get("title")
        if new_title:
            rec["title"] = new_title
        # 分类使用第一个 topicTag 的映射
        tags = info.get("topicTags", [])
        for tag in tags:
            mapped = TAG_TO_CATEGORY.get(tag.get("slug"))
            if mapped:
                rec["category"] = mapped
                break
        # 如果没有任何已知映射，尝试 translatedName 关键词
        if rec["category"] == "其他":
            for tag in tags:
                name = tag.get("translatedName", "")
                for k, v in TAG_TO_CATEGORY.items():
                    if v in name or name in v:
                        rec["category"] = v
                        break
                if rec["category"] != "其他":
                    break

    # 修正已知的错误 LeetCode URL（来自 matched/processed 数据中的错误）
    URL_FIXES = {
        "最大子数组和": "https://leetcode.cn/problems/maximum-subarray/",
        "最长回文子串": "https://leetcode.cn/problems/longest-palindromic-substring/",
    }
    for rec in valid_problems:
        if rec["title"] in URL_FIXES:
            rec["leetcode_url"] = URL_FIXES[rec["title"]]

    # 最终按标题去重（合并 LeetCode 标题修正后产生的重复）
    merged_by_title = {}
    for rec in valid_problems:
        key = canonical_title_for_lookup(rec["title"])
        if key not in merged_by_title:
            merged_by_title[key] = rec
        else:
            existing = merged_by_title[key]
            # 保留有 CodeFun URL 的
            if not existing["codefun_url"] and rec["codefun_url"]:
                existing["codefun_url"] = rec["codefun_url"]
            # 保留有 LeetCode URL 的（优先当前已有）
            if not existing["leetcode_url"] and rec["leetcode_url"]:
                existing["leetcode_url"] = rec["leetcode_url"]
            # 合并来源
            seen_ids = {s["id"] for s in existing["sources"]}
            for s in rec["sources"]:
                if s["id"] not in seen_ids:
                    existing["sources"].append(s)
                    seen_ids.add(s["id"])
            # 保留已知分类（非其他）
            if existing["category"] == "其他" and rec["category"] != "其他":
                existing["category"] = rec["category"]
    valid_problems = list(merged_by_title.values())

    # 排序
    category_order = [
        "数组", "链表", "二叉树", "BFS / DFS", "二分查找", "排序", "字符串",
        "栈 / 队列", "堆", "动态规划", "回溯", "贪心", "滑动窗口", "双指针",
        "哈希", "并查集", "图论", "数学", "位运算", "设计", "其他",
    ]
    valid_problems.sort(key=lambda x: (
        category_order.index(x["category"]) if x["category"] in category_order else 999,
        x["title"],
    ))

    categories = defaultdict(int)
    for p in valid_problems:
        categories[p["category"]] += 1

    category_list = [
        {
            "name": name,
            "count": categories[name],
            "slug": name.lower().replace(" / ", "-").replace(" ", "-"),
        }
        for name in categories
    ]
    category_list.sort(key=lambda x: (
        category_order.index(x["name"]) if x["name"] in category_order else 999,
        x["name"],
    ))

    data = {
        "categories": category_list,
        "problems": valid_problems,
    }
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT_JSON}: {len(valid_problems)} problems, {len(category_list)} categories")

    # 生成 Markdown 备用
    lines = ["# 面经手撕题汇总\n"]
    lines.append(f"共收录 {len(valid_problems)} 道真实面经中出现的手撕题。\n")
    for cat in category_list:
        lines.append(f"\n## {cat['name']}\n")
        for p in valid_problems:
            if p["category"] != cat["name"]:
                continue
            lines.append(f"\n### {p['title']}")
            if p["codefun_url"]:
                lines.append(f"- **CodeFun2000**: [{p['codefun_url']}]({p['codefun_url']})")
            if p["leetcode_url"]:
                lines.append(f"- **LeetCode**: [{p['leetcode_url']}]({p['leetcode_url']})")
            source_links = [f"[{s['title']}](/experiences/{s['role']}/{s['id']})" for s in p["sources"]]
            lines.append("- **来源面经**: " + "、".join(source_links))
            lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT_MD}")


if __name__ == "__main__":
    main()
