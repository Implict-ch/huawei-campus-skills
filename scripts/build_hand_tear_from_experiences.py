#!/usr/bin/env python3
"""从全量面经抽取真实手撕题，匹配 leetcode.cn，并写入 hand_tear_data.json。

原则：
1. 只收「面经里真实出现」的题（题号 / LC 链接 / 可对齐到 Hot100 的题名）
2. 力扣链接一律规范化为 https://leetcode.cn/problems/{slug}/
3. 禁止用题号硬拼 /problems/{num}/（无效）
4. 中国站 LCR/剑指 短 slug 尽量映射到国际站同题 slug（仍用 leetcode.cn）
5. 分类优先用 Hot100 chapter，否则按标题关键词
6. 原创/变种：无法对齐力扣但描述具体的题，用 kind=original|variant + prompt（面经原述）收录
7. 最后合并 AI 岗本地题库（merge_ai_hand_tear）
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

EXP_DIR = ROOT / "knowledge" / "experiences"
HOT100_DIR = ROOT / "knowledge" / "coding-problems" / "hot100"
EXP_JSON = ROOT / "frontend" / "public" / "experiences.json"
OUT_JSON = ROOT / "frontend" / "tmp" / "hand_tear_data.json"
OUT_MD = ROOT / "knowledge" / "coding-problems" / "hand-tear-from-experiences.md"
OUT_MAP = ROOT / "frontend" / "tmp" / "leetcode_hot100_map.json"

NEG_PATTERNS = [
    r"没有手撕",
    r"无手撕",
    r"没手撕",
    r"不手撕",
    r"一道手撕都没有",
    r"没有.*手撕",
    r"手撕.*没有",
    r"没考手撕",
    r"未手撕",
    r"以为是手撕",
]

# Hot100 未收录、但面经里明确出现过的题号 → (slug, 中文名, 分类)
EXTRA_NUM_MAP = {
    "435": ("non-overlapping-intervals", "无重叠区间", "贪心"),
    "224": ("basic-calculator", "基本计算器", "栈 / 队列"),
    "283": ("move-zeroes", "移动零", "双指针"),
    "48": ("rotate-image", "旋转图像", "数组"),
    "61": ("rotate-list", "旋转链表", "链表"),
    "215": ("kth-largest-element-in-an-array", "数组中的第K个最大元素", "堆"),
    "206": ("reverse-linked-list", "反转链表", "链表"),
    "241": ("different-ways-to-add-parentheses", "为运算表达式设计优先级", "分治"),
}

# 中国站 LCR / 剑指 Offer 等短 slug → 国际站同题 slug（便于统一展示）
CN_SLUG_ALIASES = {
    "2VG8Kg": "minimum-size-subarray-sum",  # LCR 008
    "vvXgSW": "merge-k-sorted-lists",  # LCR 078
    "NUPfPr": "partition-equal-subset-sum",  # LCR 101
    "4ueAj6": "insert-into-a-sorted-circular-linked-list",  # LCR 029
    "1fGaJU": "3sum",  # LCR 007 / 三数之和
    "qJnOS7": "longest-common-subsequence",  # LCR 095
    "wtcaE1": "longest-substring-without-repeating-characters",  # LCR 016
    "SLwz0R": "remove-nth-node-from-end-of-list",  # LCR 021
    "a7VOhD": "palindromic-substrings",  # LCR 020
    "biao-shi-shu-zhi-de-zi-fu-chuan-lcof": "valid-number",
}

CHAPTER_TO_CATEGORY = {
    "普通数组": "数组",
    "数组": "数组",
    "矩阵": "数组",
    "技巧": "数组",
    "入门教程必刷": "数组",
    "链表": "链表",
    "二叉树": "二叉树",
    "二分查找": "二分查找",
    "排序": "排序",
    "字符串": "字符串",
    "子串": "滑动窗口",
    "栈": "栈 / 队列",
    "堆": "堆",
    "动态规划": "动态规划",
    "多堆动态规划": "动态规划",
    "回溯": "回溯",
    "贪心算法": "贪心",
    "贪心": "贪心",
    "滑动窗口": "滑动窗口",
    "双指针": "双指针",
    "哈希": "哈希",
    "图论": "图论",
    "数学": "数学",
}

CATEGORY_SLUG = {
    "数组": "array",
    "链表": "linked-list",
    "二叉树": "binary-tree",
    "BFS / DFS": "bfs-dfs",
    "二分查找": "binary-search",
    "排序": "sorting",
    "字符串": "string",
    "栈 / 队列": "stack-queue",
    "堆": "heap",
    "动态规划": "dp",
    "回溯": "backtracking",
    "贪心": "greedy",
    "滑动窗口": "sliding-window",
    "双指针": "two-pointers",
    "哈希": "hash",
    "并查集": "union-find",
    "图论": "graph",
    "数学": "math",
    "位运算": "bit",
    "设计": "design",
    "分治": "divide-conquer",
    "原创 / 变种": "original",
    "其他": "other",
}

# 高置信原创/变种（稳定标题 + 分类）；match 命中面经描述即收录
# related: 可选近似力扣 slug（展示「可参考」而非声称原题）
ORIGINAL_CURATED = [
    {
        "id": "orig-decimal-fraction-base",
        "title": "十进制小数转 n 进制小数",
        "kind": "original",
        "category": "数学",
        "match": [r"十进制小数转", r"十进制小数n转", r"十进制小数.*进制"],
        "related": "",
    },
    {
        "id": "orig-twos-complement-array",
        "title": "二进制补码数组转十进制",
        "kind": "original",
        "category": "位运算",
        "match": [r"补码数组", r"二进制的补码"],
        "related": "",
    },
    {
        "id": "orig-bank-card-prefix",
        "title": "银行卡号前缀匹配银行",
        "kind": "original",
        "category": "设计",
        "match": [r"银行卡号前缀"],
        "related": "",
        "prompt_extract": r"银行卡号前缀匹配银行",
    },
    {
        "id": "orig-spiral-array-nth",
        "title": "螺旋数组第 n 个数",
        "kind": "variant",
        "category": "数组",
        "match": [r"螺旋数组第", r"边长为x的螺旋"],
        "related": "spiral-matrix",
    },
    {
        "id": "orig-pair-sum-100",
        "title": "数组中和为 100 的数对个数",
        "kind": "variant",
        "category": "哈希",
        "match": [r"有多少对数的和为100", r"对数的和为\s*100"],
        "related": "two-sum",
    },
    {
        "id": "orig-interview-schedule",
        "title": "判断面试时间是否无冲突",
        "kind": "variant",
        "category": "数组",
        "match": [r"几场面试开始和结束时间", r"无冲突参加所有面试"],
        "related": "merge-intervals",
    },
    {
        "id": "orig-max-sum-unique-subarray",
        "title": "不含重复元素的最大连续子数组和",
        "kind": "variant",
        "category": "滑动窗口",
        "match": [r"不含重复元素的\s*连续子数组", r"和最大的\s*不含重复"],
        "related": "longest-substring-without-repeating-characters",
    },
    {
        "id": "orig-coin-ways",
        "title": "硬币凑金额的组合数",
        "kind": "variant",
        "category": "动态规划",
        "match": [r"1分、2分、3分硬币", r"最少硬币凑出目标金额"],
        "related": "coin-change",
    },
    {
        "id": "orig-climb-stairs-variant",
        "title": "爬楼梯变种",
        "kind": "variant",
        "category": "动态规划",
        "match": [r"爬楼梯变种"],
        "related": "climbing-stairs",
    },
    {
        "id": "orig-lis-variant",
        "title": "最长子序列变种",
        "kind": "variant",
        "category": "动态规划",
        "match": [r"最长子序列变种"],
        "related": "longest-increasing-subsequence",
    },
    {
        "id": "orig-group-by-k-same",
        "title": "能否分成每组恰好 k 个相同元素",
        "kind": "original",
        "category": "哈希",
        "match": [r"每一组都刚好有k个相同", r"刚好有k个相同的元素"],
        "related": "",
    },
    {
        "id": "orig-circular-insert-head",
        "title": "双向循环链表头部插入",
        "kind": "variant",
        "category": "链表",
        "match": [r"双向循环链表.*插入到链表头", r"定义一个双向循环链表"],
        "related": "insert-into-a-sorted-circular-linked-list",
    },
    {
        "id": "orig-string-avg-weight",
        "title": "计算字符串的平均重量 / 平均单词长度",
        "kind": "original",
        "category": "字符串",
        "match": [r"字符串的平均重量", r"平均单词长度"],
        "related": "",
        "prompt_extract": r"(?:换了一题[:：])?[^，。]{0,8}(?:平均重量|平均单词长度)[^。]{0,40}",
    },
    {
        "id": "orig-lcm-1-to-n",
        "title": "1 到 n 的最小公倍数",
        "kind": "original",
        "category": "数学",
        "match": [r"1到n的最小公倍数"],
        "related": "",
        "prompt_extract": r"1到n的最小公倍数",
    },
    {
        "id": "orig-cut-rope",
        "title": "剪绳子（二分）",
        "kind": "variant",
        "category": "二分查找",
        "match": [r"割绳子", r"剪绳子"],
        "related": "",
        "prompt_extract": r"[剪割]绳子(?:（二分）|\(二分\))?",
    },
    {
        "id": "orig-nested-repeat-decode",
        "title": "嵌套字母重复规则解码",
        "kind": "variant",
        "category": "栈 / 队列",
        "match": [r"字母重复的规则", r"b\(c\)<\d+>d", r"数字是字母重复数量"],
        "related": "decode-string",
    },
    {
        "id": "orig-sort-greedy",
        "title": "排序 + 贪心原创题",
        "kind": "original",
        "category": "贪心",
        "match": [r"排序\+贪心原创"],
        "related": "",
    },
    {
        "id": "orig-opposite-count",
        "title": "数组里相反数的数量",
        "kind": "original",
        "category": "哈希",
        "match": [r"相反数数量"],
        "related": "",
    },
    {
        "id": "orig-vowel-substring",
        "title": "连续元音字母最长子串",
        "kind": "original",
        "category": "字符串",
        "match": [r"连续元音字母最长"],
        "related": "",
    },
    {
        "id": "orig-delete-substring-loop",
        "title": "循环删除字符串中的特定子串",
        "kind": "variant",
        "category": "栈 / 队列",
        "match": [r"删除字符串中的特定子串"],
        "related": "remove-all-adjacent-duplicates-in-string",
        "prompt_extract": r"循环执行操作：删除字符串中的特定子串",
    },
    {
        "id": "orig-two-single-numbers",
        "title": "找出只出现一次的两个数（O(n)/O(1)）",
        "kind": "variant",
        "category": "位运算",
        "match": [r"只出现一次的两个数"],
        "related": "single-number-iii",
    },
    {
        "id": "orig-soap-combinations",
        "title": "100 元购买三类物品的组合数",
        "kind": "original",
        "category": "动态规划",
        "match": [r"100元去购买肥皂", r"购买肥皂等三类物品"],
        "related": "",
    },
    {
        "id": "orig-linux-path-windows",
        "title": "Linux 路径转 Windows 格式",
        "kind": "variant",
        "category": "字符串",
        "match": [r"linux文件目录转成window"],
        "related": "",
    },
    {
        "id": "orig-integer-unique-reverse",
        "title": "整数倒序且数字不重复",
        "kind": "original",
        "category": "数学",
        "match": [r"倒序数字不重复"],
        "related": "reverse-integer",
    },
    {
        "id": "orig-expression-all-results",
        "title": "向表达式加括号求所有结果",
        "kind": "variant",
        "category": "分治",
        "match": [r"向表达式中添加括号", r"所有的可能的计算结果"],
        "related": "different-ways-to-add-parentheses",
    },
    {
        "id": "orig-interval-cube-prime-sum",
        "title": "区间立方和 / 质数和",
        "kind": "original",
        "category": "数学",
        "match": [r"区间里所有整数的立方和", r"区间里所有质数的和"],
        "related": "",
    },
    {
        "id": "orig-char-freq-sort",
        "title": "统计字符出现次数并按次数排序",
        "kind": "variant",
        "category": "哈希",
        "match": [r"统计每个字符出现的次数.*排序"],
        "related": "sort-characters-by-frequency",
    },
    {
        "id": "orig-majority-nlogn",
        "title": "出现次数超过一半的元素（要求 nlogn）",
        "kind": "variant",
        "category": "数组",
        "match": [r"出现次数超过一半.*nlogn"],
        "related": "majority-element",
    },
    {
        "id": "orig-shortest-path-2d-dp",
        "title": "二维端点最短路（DP）",
        "kind": "variant",
        "category": "动态规划",
        "match": [r"二维数组两个端点的最短路"],
        "related": "minimum-path-sum",
    },
    {
        "id": "orig-find-common-chars",
        "title": "多个字符串中的共有字符",
        "kind": "variant",
        "category": "哈希",
        "match": [r"多个字符串中的共有字符"],
        "related": "find-common-characters",
    },
    {
        "id": "orig-shortest-subarray-target",
        "title": "寻找目标和的最短子数组",
        "kind": "variant",
        "category": "滑动窗口",
        "match": [r"目标和的最短子数组"],
        "related": "minimum-size-subarray-sum",
    },
]

VAGUE_ORIGINAL = re.compile(
    r"^(?:一道|两道|几道)?(?:题|代码|算法)?|"
    r"简单|中等|困难|秒了|秒撕|不难|很简单|超级|"
    r"hot\s*100|leetcode|力扣|原题|没写出来|没做出来|"
    r"环节|八股|项目|电路|时序|运放|MOS|PFC|I2C|SPI|"
    r"K-?Means|softmax|attention|ViT|机器学习|深度学习|"
    r"相关疑问|打好基础|重点来了",
    re.I,
)

REJECT_AUTO = re.compile(
    r"二选一|讲解实现思路|项目介绍|不强制|ACM形式|medium难度|easy代码|"
    r"都是leetcode|难度代码|反问|八股可能|方向不匹配|"
    r"盛水最多的容器|大数相加|上台阶|第k\s*大的元素|"
    r"正整数a.*质数|质数.*很大",
    re.I,
)

PROMPT_SIGNAL = re.compile(
    r"给定|给一个|给了|输入|输出|求|找出|实现|写一个|定义|"
    r"能否|判断|统计|计算|删除|转换|转成|凑出|分组|插入"
)

# 已由力扣通道覆盖的描述，勿再进原创
SKIP_IF_LC_COVERED = re.compile(
    r"盛水最多的容器|大数相加|string类型的大数|上台阶|"
    r"第k\s*大的元素|第K个最大|质数.*很大很大|找出所有小于等于这个数的质数|"
    r"linux文件目录转成window",  # 有原题但 slug 未确认，下面单独策展
    re.I,
)

SYNONYMS = {
    "合并有序链表": "合并两个有序链表",
    "合并两个序链表": "合并两个有序链表",
    "K个有序链表合并": "合并K个升序链表",
    "K个升序链表合并": "合并K个升序链表",
    "有效括号": "有效的括号",
    "二叉树最大深度": "二叉树的最大深度",
    "层序遍历二叉树": "二叉树的层序遍历",
    "二叉树层序遍历": "二叉树的层序遍历",
    "层序遍历": "二叉树的层序遍历",
    "翻转链表": "反转链表",
    "判断链表有没有环": "环形链表",
    "链表有环": "环形链表",
    "滑动窗口最大值": "滑动窗口的最大值",
    "LRU": "LRU缓存",
    "LRU缓存": "LRU缓存",
    "岛屿问题": "岛屿数量",
    "第k大的元素": "数组中的第K个最大元素",
    "求第k大的元素": "数组中的第K个最大元素",
    "链表向右移动k次": "旋转链表",
    "两个字符串数字相加": "字符串相加",
    "大数相加": "字符串相加",
    "最大雨水面积": "接雨水",
    "路径之和II": "路径总和 II",
    "路径之和": "路径总和",
    "三数之和等于0": "三数之和",
    "翻转矩阵": "旋转图像",
    "旋转矩阵": "旋转图像",
    "求第k大的元素": "数组中的第K个最大元素",
    "第k大的元素": "数组中的第K个最大元素",
    "找到数组中第n大的数": "数组中的第K个最大元素",
    "移动0": "移动零",
    "存在重复元素": "存在重复元素",
    "计数质数": "计数质数",
    "前K个高频单词": "前K个高频单词",
    "可获得最大点数": "可获得的最大点数",
    "最长公共前缀": "最长公共前缀",
    "最长公共子序列": "最长公共子序列",
    "解码方法": "解码方法",
    "加油站": "加油站",
    "小行星碰撞": "小行星碰撞",
    "去除重复字母": "去除重复字母",
    "回文数": "回文数",
    "寻找数组的中心下标": "寻找数组的中心下标",
    "单词替换": "单词替换",
    "24点游戏": "24 点游戏",
    "24 点游戏": "24 点游戏",
}


# 无中文标题时的 slug → 中文名（中国站常用译名）
SLUG_CN_TITLE = {
    "find-pivot-index": "寻找数组的中心下标",
    "palindrome-number": "回文数",
    "rabbits-in-forest": "森林中的兔子",
    "top-k-frequent-words": "前 K 个高频单词",
    "finding-3-digit-even-numbers": "找出 3 位偶数",
    "path-sum-ii": "路径总和 II",
    "path-sum-iii": "路径总和 III",
    "kth-node-from-end-of-list-lcci": "链表中倒数第k个节点",
    "daily-temperatures": "每日温度",
    "24-game": "24 点游戏",
    "maximum-points-you-can-obtain-from-cards": "可获得的最大点数",
    "employee-importance": "员工的重要性",
    "kill-process": "杀掉进程",
    "replace-words": "单词替换",
    "count-primes": "计数质数",
    "contains-duplicate": "存在重复元素",
    "gas-station": "加油站",
    "remove-duplicate-letters": "去除重复字母",
    "asteroid-collision": "小行星碰撞",
    "longest-common-prefix": "最长公共前缀",
    "decode-ways": "解码方法",
    "rectangle-area": "矩形面积",
    "valid-number": "有效数字",
    "insert-into-a-sorted-circular-linked-list": "循环有序列表的插入",
    "3sum": "三数之和",
    "trapping-rain-water": "接雨水",
    "merge-k-sorted-lists": "合并 K 个升序链表",
    "remove-nth-node-from-end-of-list": "删除链表的倒数第 N 个结点",
    "longest-substring-without-repeating-characters": "无重复字符的最长子串",
    "palindromic-substrings": "回文子串",
    "lru-cache": "LRU 缓存",
    "reverse-linked-list": "反转链表",
    "rotate-list": "旋转链表",
    "rotate-image": "旋转图像",
    "kth-largest-element-in-an-array": "数组中的第K个最大元素",
    "non-overlapping-intervals": "无重叠区间",
    "basic-calculator": "基本计算器",
    "move-zeroes": "移动零",
}


def clean_title(title: str, slug: str | None = None) -> str:
    if not title:
        return SLUG_CN_TITLE.get(slug or "", "")
    t = title.strip()
    t = re.sub(r"^\[|\]$", "", t)
    t = re.sub(r"^(?:LeetCode|Leetcode|力扣|LC|LCR|剑指\s*Offer(?:\s*II)?|面试题)\s*", "", t, flags=re.I)
    t = re.sub(r"^\d+\.\s*", "", t)
    t = re.sub(r"^R\s*\d+\.\s*", "", t)  # LCR 被剥成 R 029
    t = re.sub(r"^\d{3,}(?=[\u4e00-\u9fa5])", "", t)  # 739每日温度；保留 24点游戏
    t = re.sub(r"\s*[-–—]\s*力扣.*$", "", t)
    t = re.sub(r"\s*[-–—]\s*LeetCode.*$", "", t, flags=re.I)
    t = re.sub(r"-?原题链接$", "", t)
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"leetcode\.cn\S*", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -–—|")
    if slug and (not t or not re.search(r"[\u4e00-\u9fa5]", t)):
        t = SLUG_CN_TITLE.get(slug, t)
    if len(t) < 2 or len(t) > 40:
        return SLUG_CN_TITLE.get(slug or "", "")
    if re.fullmatch(r"[a-z0-9\- ]+", t) and slug:
        return SLUG_CN_TITLE.get(slug, t)
    return t


def title_quality(title: str) -> int:
    """越高越好：优先中文正式题名。"""
    if not title:
        return 0
    score = 0
    if re.search(r"[\u4e00-\u9fa5]", title):
        score += 50
    if "http" in title.lower() or "leetcode" in title.lower():
        score -= 100
    if re.search(r"https?|problems", title, re.I):
        score -= 100
    score += min(len(title), 30)
    if title.islower() and " " in title and not re.search(r"[\u4e00-\u9fa5]", title):
        score -= 20  # english slug-ish
    return score


def decode_nowcoder_jump(url: str) -> str:
    if "gw-c.nowcoder.com/api/sparta/jump/link" in url:
        try:
            qs = parse_qs(urlparse(url).query)
            if "link" in qs:
                return unquote(qs["link"][0])
        except Exception:
            pass
    return url


def normalize_leetcode_url(url: str) -> str | None:
    if not url or "leetcode" not in url.lower():
        return None
    url = decode_nowcoder_jump(unquote(url)).split("]")[0].split("(")[0].rstrip("\\.,;")
    url = url.replace("leetcode.com", "leetcode.cn").replace("leetcode-cn.com", "leetcode.cn")
    m = re.search(r"leetcode\.cn/problems/([^/\s?#]+)", url, re.I)
    if not m:
        return None
    slug = m.group(1)
    if slug.isdigit():
        return None
    slug = CN_SLUG_ALIASES.get(slug, slug)
    return f"https://leetcode.cn/problems/{slug}/"


def is_negative_line(line: str) -> bool:
    for p in NEG_PATTERNS:
        if re.search(p, line, re.I):
            return True
    return False


def load_hot100_maps() -> dict:
    idx = json.loads((HOT100_DIR / "index.json").read_text(encoding="utf-8"))
    by_id = {p["id"]: p for p in idx["problems"]}
    by_num: dict[str, dict] = {}
    by_slug: dict[str, dict] = {}
    by_title: dict[str, dict] = {}

    for path in HOT100_DIR.rglob("题面.md"):
        pid = path.parent.name
        chapter = path.parent.parent.name
        meta = by_id.get(pid, {})
        text = path.read_text(encoding="utf-8", errors="ignore")
        first = text.splitlines()[0] if text else ""

        slug = None
        title = ""
        num = None

        m_link = re.search(
            r"\[([^\]]+)\]\((https?://leetcode\.cn/problems/([^/\s?#)]+)[^)]*)\)",
            first,
            re.I,
        )
        if m_link:
            title = clean_title(m_link.group(1))
            slug = CN_SLUG_ALIASES.get(m_link.group(3), m_link.group(3))
            m_num = re.search(r"(?:LeetCode|Leetcode|力扣|LC)\s*(\d+)", m_link.group(1), re.I)
            if m_num:
                num = m_num.group(1)

        if not slug:
            m = re.search(r"leetcode\.cn/problems/([^/\s\)?]+)", first, re.I)
            if m and not m.group(1).isdigit():
                slug = CN_SLUG_ALIASES.get(m.group(1), m.group(1))

        if not num:
            m2 = re.search(r"[Ll]eet[Cc]ode\s*(\d+)", first) or re.search(
                r"[Ll]eet[Cc]ode\s*(\d+)", meta.get("title", "")
            )
            if m2:
                num = m2.group(1)

        if not title:
            # 从 index 标题兜底
            title = clean_title(meta.get("title", ""), slug) or SLUG_CN_TITLE.get(slug or "", "") or (
                slug.replace("-", " ") if slug else ""
            )
        title = clean_title(title, slug)

        cat = CHAPTER_TO_CATEGORY.get(chapter, chapter)
        rec = {
            "pid": pid,
            "slug": slug,
            "num": num,
            "title": title,
            "chapter": chapter,
            "category": cat,
            "codefun_url": meta.get("source_url") or f"https://codefun2000.com/p/{pid}",
            "leetcode_url": f"https://leetcode.cn/problems/{slug}/" if slug else None,
        }
        if num:
            by_num[num] = rec
        if slug:
            by_slug[slug] = rec
        if title:
            by_title[title] = rec
            by_title[title.replace(" ", "")] = rec

    # 补录面经常见、Hot100 未覆盖的题
    for num, (slug, title, category) in EXTRA_NUM_MAP.items():
        rec = {
            "pid": None,
            "slug": slug,
            "num": num,
            "title": title,
            "chapter": None,
            "category": category,
            "codefun_url": None,
            "leetcode_url": f"https://leetcode.cn/problems/{slug}/",
        }
        by_num.setdefault(num, rec)
        by_slug.setdefault(slug, rec)
        by_title[title] = rec
        by_title[title.replace(" ", "")] = rec

    return {"by_num": by_num, "by_slug": by_slug, "by_title": by_title}


def strip_frontmatter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---"):
        return {}, raw
    end = raw.find("---", 3)
    if end < 0:
        return {}, raw
    meta = {}
    for line in raw[3:end].splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip("'\"")
    return meta, raw[end + 3 :]


def extract_title_candidates(line: str) -> list[str]:
    names: list[str] = []
    for m in re.finditer(r"\[([^\]]{2,50})\]\s*\(", line):
        n = clean_title(m.group(1))
        if n:
            names.append(n)
    m = re.search(
        r"手撕(?:代码|题|一道|了)?[:：]?\s*(.+)$",
        line,
        re.I,
    )
    if m:
        seg = m.group(1)
        # 去掉已解析的 markdown 链接，避免把 URL 当地名
        seg = re.sub(r"\[[^\]]*\]\([^)]*\)", "、", seg)
        seg = re.sub(r"https?://\S+", "", seg)
        for part in re.split(r"[,，、;/；]|以及|和|与", seg):
            part = clean_title(part)
            part = re.sub(r"^(?:leetcode|lc|力扣)\s*\d*[\.\s]*", "", part, flags=re.I)
            part = part.strip(" 。.（）()【】[]")
            if 2 <= len(part) <= 30 and not re.search(r"原题|变种|简单|中等|困难|写|秒", part):
                names.append(part)
    return names


def best_title_match(name: str, by_title: dict[str, dict], min_score: float = 0.86) -> dict | None:
    name = SYNONYMS.get(name, name)
    name = clean_title(name)
    if not name:
        return None
    key = name.replace(" ", "")
    if name in by_title:
        return by_title[name]
    if key in by_title:
        return by_title[key]
    best = None
    best_score = 0.0
    for t, rec in by_title.items():
        if not t:
            continue
        a, b = key.lower(), t.replace(" ", "").lower()
        if a == b:
            return rec
        if a in b or b in a:
            score = 0.88 + 0.1 * (min(len(a), len(b)) / max(len(a), len(b)))
        else:
            score = SequenceMatcher(None, a, b).ratio()
        if score > best_score:
            best_score = score
            best = rec
    if best and best_score >= min_score:
        return best
    return None


def categorize(title: str, chapter: str | None = None) -> str:
    if chapter and chapter in CHAPTER_TO_CATEGORY:
        return CHAPTER_TO_CATEGORY[chapter]
    fallback = [
        ("链表", "链表"), ("循环有序", "链表"), ("LRU", "链表"),
        ("二叉树", "二叉树"), ("二叉搜索树", "二叉树"),         ("路径总和", "二叉树"), ("路径之和", "二叉树"),
        ("BFS", "BFS / DFS"), ("DFS", "BFS / DFS"), ("岛屿", "BFS / DFS"),
        ("腐烂", "BFS / DFS"), ("杀掉进程", "BFS / DFS"), ("员工", "BFS / DFS"),
        ("倒数", "链表"), ("第k个节点", "链表"),
        ("三位偶数", "数组"), ("3 位偶数", "数组"), ("中心下标", "数组"),
        ("pivot", "数组"), ("高频单词", "堆"), ("森林中的兔子", "数学"),
        ("回文数", "数学"),
        ("全排列", "回溯"), ("组合总和", "回溯"), ("电话号码", "回溯"), ("回溯", "回溯"),
        ("动态规划", "动态规划"), ("爬楼梯", "动态规划"), ("路径和", "动态规划"),
        ("编辑距离", "动态规划"), ("单词拆分", "动态规划"), ("解码方法", "动态规划"),
        ("最长公共子序列", "动态规划"), ("分割等和", "动态规划"), ("最长回文", "动态规划"),
        ("最小路径", "动态规划"), ("打家劫舍", "动态规划"),
        ("贪心", "贪心"), ("加油站", "贪心"), ("跳跃", "贪心"),
        ("二分", "二分查找"),
        ("栈", "栈 / 队列"), ("队列", "栈 / 队列"), ("括号", "栈 / 队列"),
        ("温度", "栈 / 队列"), ("字符串解码", "栈 / 队列"), ("小行星", "栈 / 队列"),
        ("去除重复字母", "栈 / 队列"), ("堆", "堆"), ("前K", "堆"), ("第K", "堆"),
        ("排序", "排序"),
        ("字符串", "字符串"), ("回文", "字符串"), ("公共前缀", "字符串"),
        ("单词替换", "字符串"), ("有效数字", "字符串"),
        ("滑动窗口", "滑动窗口"), ("可获得", "滑动窗口"), ("无重复字符", "滑动窗口"),
        ("双指针", "双指针"), ("接雨水", "双指针"), ("盛最多水", "双指针"),
        ("三数之和", "双指针"), ("移动零", "双指针"),
        ("哈希", "哈希"), ("两数之和", "哈希"), ("异位词", "哈希"), ("存在重复", "哈希"),
        ("并查集", "并查集"), ("图", "图论"), ("拓扑", "图论"),
        ("位运算", "位运算"), ("矩阵", "数组"), ("数组", "数组"),
        ("合并区间", "数组"), ("螺旋", "数组"), ("置零", "数组"), ("中心下标", "数组"),
        ("质数", "数学"), ("24", "数学"), ("矩形面积", "数学"), ("兔子", "数学"),
        ("设计", "设计"),
    ]
    for k, v in fallback:
        if k.lower() in title.lower():
            return v
    return "其他"


def scan_experiences(maps: dict, exp_meta: dict[str, dict]) -> dict[str, dict]:
    problems: dict[str, dict] = {}

    def upsert(*, slug: str, title: str, leetcode_url: str, codefun_url: str | None,
               category: str, source_id: str, evidence: str):
        key = slug
        # 有标准中文名时优先使用
        title = SLUG_CN_TITLE.get(slug) or clean_title(title, slug) or slug.replace("-", " ")
        if key not in problems:
            problems[key] = {
                "title": title,
                "slug": slug,
                "leetcode_url": leetcode_url,
                "codefun_url": codefun_url or "",
                "category": category,
                "group": "传统工程岗",
                "sources": [],
                "evidence": [],
            }
        rec = problems[key]
        if title_quality(title) > title_quality(rec["title"]):
            rec["title"] = clean_title(title, slug)
        if codefun_url and not rec["codefun_url"]:
            rec["codefun_url"] = codefun_url
        if rec["category"] == "其他" and category != "其他":
            rec["category"] = category
        # 标题校正分类
        better = categorize(rec["title"])
        if rec["category"] == "其他" and better != "其他":
            rec["category"] = better
        sid_set = {s["id"] for s in rec["sources"]}
        if source_id not in sid_set and source_id in exp_meta:
            m = exp_meta[source_id]
            rec["sources"].append({
                "id": source_id,
                "title": m.get("title", source_id),
                "role": m.get("role", "software-development"),
            })
        if evidence and evidence not in rec["evidence"]:
            rec["evidence"].append(evidence[:160])

    files = sorted(
        p for p in EXP_DIR.rglob("hw-exp-*.md")
        if not any(x.startswith("_") for x in p.parts)
    )
    for path in files:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        meta, body = strip_frontmatter(raw)
        source_id = meta.get("id") or path.stem
        for line in body.splitlines():
            line = line.strip()
            if not line:
                continue
            lower = line.lower()
            # 面经正文里的「手撕/力扣」才收；纯刷题清单（无手撕字样）放宽要求：必须含 leetcode 链接或明确题号
            has_hand = "手撕" in line
            has_lc = any(k in lower for k in ("leetcode", "力扣", "lc "))
            if not has_hand and not has_lc:
                continue
            if is_negative_line(line):
                continue
            # 没有「手撕」时，要求真有链接/题号，避免把题单全文扫进来
            if not has_hand and "leetcode.cn" not in lower and "leetcode-cn.com" not in lower:
                if not re.search(r"(?:leetcode|力扣|lc)\s*[#.]?\s*\d{1,4}\b", line, re.I):
                    continue

            # 1) 链接
            urls = re.findall(r"https?://[^\s)\]\\]+", line)
            for _, u in re.findall(r"\[(.*?)\]\((.*?)\)", line):
                urls.append(u)
            seen_urls = set()
            for u in urls:
                lc = normalize_leetcode_url(u)
                if not lc or lc in seen_urls:
                    continue
                seen_urls.add(lc)
                slug = re.search(r"/problems/([^/]+)/", lc).group(1)
                hit = maps["by_slug"].get(slug)
                link_title = ""
                for t, link_u in re.findall(r"\[([^\]]+)\]\(([^)]+)\)", line):
                    m_src = re.search(r"/problems/([^/\s?#]+)", link_u)
                    if not m_src:
                        continue
                    src_slug = CN_SLUG_ALIASES.get(m_src.group(1), m_src.group(1))
                    if src_slug == slug or m_src.group(1) == slug:
                        link_title = clean_title(t)
                        break
                if hit:
                    upsert(
                        slug=slug,
                        title=link_title or hit["title"],
                        leetcode_url=hit["leetcode_url"] or lc,
                        codefun_url=hit.get("codefun_url"),
                        category=hit["category"],
                        source_id=source_id,
                        evidence=line,
                    )
                else:
                    title = link_title or slug.replace("-", " ")
                    upsert(
                        slug=slug,
                        title=title,
                        leetcode_url=lc,
                        codefun_url=None,
                        category=categorize(title),
                        source_id=source_id,
                        evidence=line,
                    )

            # 2) 题号（含 leecode 拼写错误）
            nums = set(re.findall(r"(?:leetcode|leecode|力扣|lc)\s*[#.]?\s*(\d{1,4})\b", line, re.I))
            nums.update(re.findall(r"\bLC\s*(\d{1,4})\b", line, re.I))
            for num in nums:
                hit = maps["by_num"].get(num)
                if hit and hit.get("slug"):
                    upsert(
                        slug=hit["slug"],
                        title=hit["title"] or f"LeetCode {num}",
                        leetcode_url=hit["leetcode_url"],
                        codefun_url=hit.get("codefun_url"),
                        category=hit["category"],
                        source_id=source_id,
                        evidence=line,
                    )
                    continue
                extra = EXTRA_NUM_MAP.get(num)
                if not extra:
                    continue
                slug, title, category = extra
                upsert(
                    slug=slug,
                    title=title,
                    leetcode_url=f"https://leetcode.cn/problems/{slug}/",
                    codefun_url=None,
                    category=category,
                    source_id=source_id,
                    evidence=line,
                )

            # 3) 手撕题名（无链接时）
            if has_hand:
                for name in extract_title_candidates(line):
                    hit = best_title_match(name, maps["by_title"])
                    if not hit or not hit.get("slug"):
                        continue
                    upsert(
                        slug=hit["slug"],
                        title=hit["title"],
                        leetcode_url=hit["leetcode_url"],
                        codefun_url=hit.get("codefun_url"),
                        category=hit["category"],
                        source_id=source_id,
                        evidence=line,
                    )

    return problems


def _clean_prompt(seg: str) -> str:
    s = seg.strip()
    s = re.sub(r"\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"https?://\S+", "", s)
    s = re.sub(r"[*#>`]+", "", s)
    s = re.sub(r"^目[:：]\s*", "", s)
    s = re.sub(r"\s+", " ", s).strip(" ，,。；;：:")
    # 截断叙事尾巴
    for sep in (
        "。面试官", "，面试官", "。然后", "，然后反问", "。反问",
        "（面试官", "（完全没", "（难以置信", "没做过", "我的输出还写错",
    ):
        if sep in s:
            s = s.split(sep)[0].strip()
    return s[:160]


def _prompt_key(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())[:48]


def scan_original_problems(exp_meta: dict[str, dict], known_slugs: set[str]) -> list[dict]:
    """抽取无法对齐力扣、但描述具体的原创/变种手撕。"""
    found: dict[str, dict] = {}

    def upsert(key: str, *, title: str, kind: str, category: str, prompt: str,
               related: str, source_id: str):
        if key not in found:
            found[key] = {
                "title": title,
                "kind": kind,
                "category": category,
                "prompt": prompt,
                "related_leetcode_url": (
                    f"https://leetcode.cn/problems/{related}/" if related else ""
                ),
                "codefun_url": "",
                "leetcode_url": "",
                "group": "传统工程岗",
                "sources": [],
            }
        rec = found[key]
        if len(prompt) > len(rec.get("prompt") or ""):
            rec["prompt"] = prompt
        sid_set = {s["id"] for s in rec["sources"]}
        if source_id not in sid_set and source_id in exp_meta:
            m = exp_meta[source_id]
            rec["sources"].append({
                "id": source_id,
                "title": m.get("title", source_id),
                "role": m.get("role", "software-development"),
            })

    files = sorted(
        p for p in EXP_DIR.rglob("hw-exp-*.md")
        if not any(x.startswith("_") for x in p.parts)
    )
    for path in files:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        meta, body = strip_frontmatter(raw)
        source_id = meta.get("id") or path.stem
        for line in body.splitlines():
            line = line.strip()
            if "手撕" not in line:
                continue
            if is_negative_line(line):
                continue
            # 已有可解析力扣链接/题号的，交给 LC 通道（策展命中除外，如「换题」叙事）
            has_lc_ref = (
                "leetcode.cn" in line.lower()
                or "leetcode-cn.com" in line.lower()
                or bool(re.search(r"(?:leetcode|leecode|力扣|lc)\s*[#.]?\s*\d{1,4}\b", line, re.I))
            )

            m = re.search(r"手撕(?:代码|题|一道|了)?[:：]?\s*(.+)$", line, re.I)
            # 也允许「第二个手撕是…」「手撕是…」
            if not m:
                m = re.search(r"(?:第二个)?手撕是(.+)$", line)
            if not m:
                # 纯描述行但命中策展（如单独一句「银行卡号前缀…」）
                prompt = _clean_prompt(line)
            else:
                prompt = _clean_prompt(m.group(1))
            if len(prompt) < 8 and "手撕" not in line:
                continue

            # 1) 策展规则优先（同一行可命中多题，如「换题」）
            curated_hit = False
            for cur in ORIGINAL_CURATED:
                if not any(re.search(pat, prompt, re.I) or re.search(pat, line, re.I) for pat in cur["match"]):
                    continue
                if "手撕" not in line and not cur.get("prompt_extract"):
                    continue
                use_prompt = prompt
                pe = cur.get("prompt_extract")
                if pe:
                    mm = re.search(pe, line, re.I)
                    if mm:
                        use_prompt = _clean_prompt(mm.group(0))
                elif cur["match"]:
                    # 尽量截取命中片段，避免整行叙事
                    mm = re.search(cur["match"][0], line, re.I)
                    if mm:
                        # 取命中附近一句
                        start = max(0, mm.start() - 4)
                        end = min(len(line), mm.end() + 36)
                        use_prompt = _clean_prompt(line[start:end])
                upsert(
                    cur["id"],
                    title=cur["title"],
                    kind=cur["kind"],
                    category=cur["category"],
                    prompt=use_prompt or cur["title"],
                    related=cur.get("related") or "",
                    source_id=source_id,
                )
                curated_hit = True
            if curated_hit:
                continue

            # 2) 自动收录：必须像题面，且不能太含糊
            if has_lc_ref:
                continue
            if "手撕" not in line or not m:
                continue
            if not PROMPT_SIGNAL.search(prompt):
                continue
            if REJECT_AUTO.search(prompt) or SKIP_IF_LC_COVERED.search(prompt):
                continue
            if VAGUE_ORIGINAL.search(prompt):
                head = prompt[:12]
                if re.search(r"简单|秒了|hot\s*100|leetcode|力扣原题|没写|环节|电路", head, re.I):
                    continue
            if re.search(r"电路|时序图|运放|MOS|PFC|原理图|占空比|分频", prompt, re.I):
                continue
            if re.search(r"K-?Means|softmax|attention|ViT|反向传播|机器学习", prompt, re.I):
                continue
            short = clean_title(re.split(r"[，,（(]", prompt)[0])
            if short in {
                "岛屿数量", "反转链表", "LRU缓存", "合并区间", "有效括号",
                "二叉树最大深度", "层序遍历", "单词拆分", "爬楼梯", "编辑距离",
                "全排列", "腐烂的橘子", "两数之和", "三数之和", "滑动窗口",
            }:
                continue
            # 标题过短/不像题名
            if len(re.sub(r"[\W_]+", "", short or "", flags=re.U)) < 4:
                continue

            title = short if short and 4 <= len(short) <= 24 else prompt[:24]
            kind = "variant" if re.search(r"变种|改编|改的|类似", prompt) else "original"
            cat = categorize(title + prompt)
            if cat == "其他":
                cat = "原创 / 变种"
            key = "auto-" + _prompt_key(title)
            upsert(
                key,
                title=title,
                kind=kind,
                category=cat,
                prompt=prompt,
                related="",
                source_id=source_id,
            )

    return [r for r in found.values() if r["sources"]]


def build() -> dict:
    maps = load_hot100_maps()
    OUT_MAP.parent.mkdir(parents=True, exist_ok=True)
    OUT_MAP.write_text(
        json.dumps(
            {
                "count_num": len(maps["by_num"]),
                "count_slug": len(maps["by_slug"]),
                "count_title": len(maps["by_title"]),
                "sample": {k: maps["by_num"][k] for k in list(maps["by_num"])[:5]},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    exp_data = json.loads(EXP_JSON.read_text(encoding="utf-8"))
    exp_meta = {e["id"]: e for e in exp_data.get("all", [])}

    problems = scan_experiences(maps, exp_meta)
    known_slugs = {re.search(r"/problems/([^/]+)/", r["leetcode_url"]).group(1)
                   for r in problems.values() if r.get("leetcode_url") and "/problems/" in r["leetcode_url"]}

    valid = []
    for rec in problems.values():
        if not rec["sources"]:
            continue
        if not rec["leetcode_url"] or "/problems/" not in rec["leetcode_url"]:
            continue
        slug_m = re.search(r"/problems/([^/]+)/", rec["leetcode_url"])
        if not slug_m or slug_m.group(1).isdigit():
            continue
        title = clean_title(rec["title"], rec["slug"]) or rec["title"]
        cat = rec["category"]
        if cat == "其他":
            cat = categorize(title)
        valid.append({
            "title": title,
            "kind": "leetcode",
            "prompt": "",
            "related_leetcode_url": "",
            "codefun_url": rec["codefun_url"] or "",
            "leetcode_url": rec["leetcode_url"],
            "category": cat,
            "group": "传统工程岗",
            "sources": rec["sources"],
        })

    originals = scan_original_problems(exp_meta, known_slugs)
    # 策展题若算法分类明确则进对应类；其余进「原创 / 变种」聚合也保留一份？
    # 策略：全部进各自 category；另把 kind!=leetcode 同步计入「原创 / 变种」分类页
    # → 为避免重复，分类页用 filter：category==X OR (X==原创/变种 && kind!=leetcode)
    # 数据层：原创题 category 用算法类；额外生成虚拟分类计数
    for rec in originals:
        valid.append({
            "title": rec["title"],
            "kind": rec["kind"],
            "prompt": rec["prompt"],
            "related_leetcode_url": rec.get("related_leetcode_url") or "",
            "codefun_url": "",
            "leetcode_url": "",
            "category": rec["category"] if rec["category"] != "其他" else "原创 / 变种",
            "group": "传统工程岗",
            "sources": rec["sources"],
        })

    order = [
        "数组", "链表", "二叉树", "BFS / DFS", "二分查找", "排序", "字符串",
        "栈 / 队列", "堆", "动态规划", "回溯", "贪心", "滑动窗口", "双指针",
        "哈希", "并查集", "图论", "数学", "位运算", "设计", "分治",
        "原创 / 变种", "其他",
    ]
    valid.sort(key=lambda x: (
        0 if x.get("kind") == "leetcode" else 1,
        order.index(x["category"]) if x["category"] in order else 999,
        x["title"],
    ))

    cats = defaultdict(int)
    for p in valid:
        cats[p["category"]] += 1
    # 「原创 / 变种」分类页展示所有非力扣题（含已归入算法类的）
    orig_count = sum(1 for p in valid if p.get("kind") in ("original", "variant"))
    if orig_count:
        cats["原创 / 变种"] = orig_count

    categories = [
        {
            "name": name,
            "count": cats[name],
            "slug": CATEGORY_SLUG.get(name, re.sub(r"\s+", "-", name.lower())),
            "group": "传统工程岗",
        }
        for name in order
        if cats.get(name)
    ]

    data = {"categories": categories, "problems": valid}
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lc_n = sum(1 for p in valid if p.get("kind") == "leetcode")
    lines = [
        "# 面经手撕题汇总\n",
        f"共收录 {len(valid)} 道面经手撕（力扣对齐 {lc_n}，原创/变种 {orig_count}）。\n",
        "> 由 `scripts/build_hand_tear_from_experiences.py` 从全量面经抽取生成。\n",
        "> 原创/变种不伪造完整题面，以「面经原述」为准。\n",
    ]
    for cat in categories:
        lines.append(f"\n## {cat['name']}\n")
        for p in valid:
            in_cat = p["category"] == cat["name"] or (
                cat["name"] == "原创 / 变种" and p.get("kind") in ("original", "variant")
            )
            if not in_cat:
                continue
            # 避免在「原创/变种」与算法类重复列出时：算法类只列本类；原创类列全部非 LC
            if cat["name"] != "原创 / 变种" and p["category"] != cat["name"]:
                continue
            if cat["name"] == "原创 / 变种" and p.get("kind") == "leetcode":
                continue
            badge = {"leetcode": "力扣", "original": "原创", "variant": "变种"}.get(p.get("kind"), "")
            lines.append(f"\n### {p['title']}" + (f" `{badge}`" if badge and badge != "力扣" else ""))
            if p.get("prompt"):
                lines.append(f"- **面经原述**: {p['prompt']}")
            if p.get("codefun_url"):
                lines.append(f"- **CodeFun2000**: {p['codefun_url']}")
            if p.get("leetcode_url"):
                lines.append(f"- **LeetCode**: {p['leetcode_url']}")
            if p.get("related_leetcode_url"):
                lines.append(f"- **可参考力扣**: {p['related_leetcode_url']}")
            src = "、".join(
                f"[{s['title']}](/experiences/{s['role']}/{s['id']})" for s in p["sources"]
            )
            lines.append(f"- **来源面经**: {src}\n")
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")

    with_cf = sum(1 for p in valid if p.get("codefun_url"))
    src_docs = {s["id"] for p in valid for s in p["sources"]}
    print(f"[build] problems={len(valid)} (leetcode={lc_n}, original/variant={orig_count})")
    print(f"[build] categories={len(categories)}")
    print(f"[build] with_codefun={with_cf} source_experiences={len(src_docs)}")
    print(f"[build] category counts: {dict(cats)}")
    print(f"[build] wrote {OUT_JSON}")
    print(f"[build] wrote {OUT_MD}")
    return data


if __name__ == "__main__":
    build()
    try:
        from merge_ai_hand_tear import main as merge_ai_main

        print("[build] merging AI hand-tear folder...")
        merge_ai_main()
    except Exception as e:
        print(f"[build] skip AI merge: {e}")
