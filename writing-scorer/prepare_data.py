"""Chuẩn bị bộ dữ liệu IELTS Writing Task 2 hợp nhất, đã khử trùng lặp và chống rò rỉ dữ liệu.

Kết hợp 2 nguồn dữ liệu HuggingFace:
1. chillies/IELTS-writing-task-2-evaluation (train + test)
2. Jackrong/IELTS-writing-feedback-reasoning (train)

Quy trình chính: lọc nhiễu/bài không hợp lệ -> tách (prompt, essay) của Jackrong -> trích xuất điểm
overall + 4 tiêu chí -> khử trùng lặp nội bộ & xuyên nguồn (ưu tiên Jackrong) -> gom nhóm chống rò rỉ
đề bài/bài viết -> chia train/val/test tỷ lệ 80/10/10 cân bằng phân bố band & nguồn.

Đầu ra lưu trong `writing-scorer/data/`:
- train.jsonl
- val.jsonl
- test.jsonl
- dataset_summary.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from datasets import load_dataset

CHILLIES_DATASET = "chillies/IELTS-writing-task-2-evaluation"
JACKRONG_DATASET = "Jackrong/IELTS-writing-feedback-reasoning"

# Ngưỡng lọc bài hợp lệ: tối thiểu 30 từ và điểm band nằm trong [1.0, 9.0]
MIN_ESSAY_WORDS = 30
VALID_MIN_BAND = 1.0
VALID_MAX_BAND = 9.0

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data"


def normalize_display_text(text: Any) -> str:
    """Chuẩn hóa ký tự xuống dòng và rút gọn dòng trống thừa nhưng vẫn giữ nguyên cấu trúc chia đoạn."""
    if not isinstance(text, str):
        return ""
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in cleaned.split("\n")]
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# Các mẫu nhận diện dữ liệu rác thu thập nhầm (bài tập trắc nghiệm, đáp án, phiếu luyện tập không phải bài luận)
_NON_ESSAY_PATTERNS = (
    re.compile(r"\bCâu\s+\d+\s*:", re.IGNORECASE),
    re.compile(r"\bTAKE\s+TEST\s+AGAIN\b"),
    re.compile(r"^\s*1\.\s+What\s+(?:do|does)\s+.*\b(?:Answer|Key)\s*:", re.DOTALL),
    re.compile(r"^\s*Main\s+Content\s*:", re.IGNORECASE),
    re.compile(r"\bPractice\s+2\s*:\s*Some\s+information\s+on\b", re.IGNORECASE),
    re.compile(r"^\s*a\)\s*a\s+game\s+played\b", re.IGNORECASE),
    re.compile(r"^\s*1\.\s+A\s+building\s+that\s+is\s+historically\s+important", re.IGNORECASE),
)


def is_non_essay_artifact(essay: str) -> bool:
    """Phát hiện văn bản rác (đề trắc nghiệm, đáp án, phiếu bài tập) không phải bài luận Task 2."""
    return any(pat.search(essay) for pat in _NON_ESSAY_PATTERNS)


def normalize_for_dedup(text: Any) -> str:
    """Chuẩn hóa chuỗi về chữ thường chỉ giữ chữ-số để so khớp khử trùng lặp và kiểm tra rò rỉ."""
    if not isinstance(text, str):
        return ""
    s = unicodedata.normalize("NFKC", text)
    s = (
        s.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def sha256_short(text: str, length: int = 16) -> str:
    """Băm SHA-256 rút gọn dùng tạo hậu tố ID duy nhất khi trùng ID gốc."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:length]


def round_to_half_band(val: float) -> float:
    """Làm tròn số thực về bước 0.5 gần nhất và kẹp trong khoảng [1.0, 9.0]."""
    rounded = round(val * 2.0) / 2.0
    return max(VALID_MIN_BAND, min(VALID_MAX_BAND, float(rounded)))


def parse_numeric_band(raw: Any) -> tuple[float | None, str | None]:
    """Phân tích nghiêm ngặt giá trị band thô về số thực bước 0.5 trong [1.0, 9.0].

    Trả về `(band_hoặc_None, lý_do)`.
    Các ký hiệu đặc biệt `<4` / `<4.5` trả về `(None, "lt4")` hoặc `(None, "lt4.5")` để hàm gọi
    tự suy ra điểm từ điểm thành phần trong evaluation hoặc gán mức mặc định.
    """
    if raw is None:
        return None, "null"
    if isinstance(raw, (int, float)):
        if math.isnan(float(raw)) or math.isinf(float(raw)):
            return None, "nan"
        val = float(raw)
        if not (VALID_MIN_BAND <= val <= VALID_MAX_BAND):
            return None, "out_of_range"
        return round_to_half_band(val), "numeric"

    s = normalize_display_text(str(raw))
    if not s:
        return None, "empty"

    low = s.lower().strip()
    if low in {"n/a", "na", "none", "null", "nan", "-"}:
        return None, "na_string"

    # Xử lý các nhãn dạng khoảng dưới ngưỡng như "<4" hoặc "<4.5"
    if re.fullmatch(r"<\s*4(?:\.0+)?", low):
        return None, "lt4"
    if re.fullmatch(r"<\s*4\.5", low):
        # Trả tín hiệu lt4.5 để ưu tiên đối chiếu thêm điểm trong phần đánh giá
        return None, "lt4.5"

    band_in_parens = re.search(r"\(\s*band\s*(\d+(?:\.\d+)?)\s*\)", low)
    if band_in_parens:
        val = float(band_in_parens.group(1))
        if VALID_MIN_BAND <= val <= VALID_MAX_BAND:
            return round_to_half_band(val), "parens_band"

    # Gỡ các ký tự định dạng markdown thường bọc quanh điểm số như "Band 6.5", "[7]", "**6.0**"
    cleaned = re.sub(r"[\[\]\*`_~]", " ", low)
    cleaned = re.sub(r"\b(?:overall|suggested|band|score)\b", " ", cleaned)
    cleaned = cleaned.replace(":", " ").strip()

    lt_match = re.match(r"^<\s*(\d+(?:\.\d+)?)$", cleaned)
    if lt_match:
        bound = float(lt_match.group(1))
        if abs(bound - 4.0) < 1e-6:
            return None, "lt4"
        if abs(bound - 4.5) < 1e-6:
            return None, "lt4.5"

    num_match = re.search(r"(?<!\d)(\d+(?:\.\d+)?)(?!\d)", cleaned)
    if not num_match:
        return None, "unparseable"

    val = float(num_match.group(1))
    if not (VALID_MIN_BAND <= val <= VALID_MAX_BAND):
        return None, "out_of_range"
    return round_to_half_band(val), "parsed"


def _extract_score_from_section(section_lines: list[str], inline_tail: str) -> float | None:
    """Trích xuất điểm số từ phần đuôi dòng tiêu đề tiêu chí hoặc từ nội dung bên trong mục đó."""
    if inline_tail:
        # Ví dụ: ": [7]", ": **6.0**", "(6.5)", " - **6.0**", " - 6.5"
        tail_clean = inline_tail.strip()
        if tail_clean and not re.search(r"\bn/?a\b", tail_clean, re.IGNORECASE):
            if re.match(r"^[:\-\s*\[\(]*[<\d]", tail_clean):
                val, note = parse_numeric_band(tail_clean)
                if val is not None:
                    return val
                if note == "lt4":
                    return 3.5
                if note == "lt4.5":
                    return 4.0

    for line in section_lines:
        s = line.strip()
        if not s:
            continue
        if re.search(r"\b(?:n/?a|not\s+applicable)\b", s, re.IGNORECASE):
            return None
        score_line = re.search(
            r"(?:suggested\s+(?:overall\s+)?band\s+score|overall\s+band\s+score|band\s+score|score)\s*(?:\([^)]*\))?\s*:?\s*\*?\s*(.+)$",
            s,
            re.IGNORECASE,
        )
        if score_line:
            candidate = score_line.group(1).strip()
            val, note = parse_numeric_band(candidate)
            if val is not None:
                return val
            if note == "lt4":
                return 3.5
            if note == "lt4.5":
                return 4.0
        # Xử lý dòng điểm in đậm đứng riêng ngay dưới tiêu đề trong Jackrong, ví dụ "**6.0**"
        bare_bold = re.fullmatch(r"\*{0,2}\[?\s*(<\s*4(?:\.5)?|\d+(?:\.\d+)?)\s*\]?\*{0,2}", s)
        if bare_bold:
            val, note = parse_numeric_band(bare_bold.group(1))
            if val is not None:
                return val
            if note == "lt4":
                return 3.5
            if note == "lt4.5":
                return 4.0
    return None


# Biểu thức nhận diện các tiêu đề mục điểm trong văn bản đánh giá markdown
_SECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "overall_eval",
        re.compile(
            r"^(?:#{1,4}\s*)?(?:[-*]\s+)?(?:[1-4]\.\s*)?(?:\*{2}\s*)?(?:[^\w\n]*\s*)?(?:overall\s+band\s+score|overall\s+score)(.*)$",
            re.IGNORECASE,
        ),
    ),
    (
        "task_response",
        re.compile(
            r"^(?:#{1,4}\s*)?(?:[-*]\s+)?(?:[1-4]\.\s*)?(?:\*{2}\s*)?(?:task\s+(?:response|achievement)(?:\s*\((?:tr|ta)\))?)(.*)$",
            re.IGNORECASE,
        ),
    ),
    (
        "coherence_cohesion",
        re.compile(
            r"^(?:#{1,4}\s*)?(?:[-*]\s+)?(?:[1-4]\.\s*)?(?:\*{2}\s*)?(?:coherence\s*(?:&|and)\s*cohesion(?:\s*\(cc\))?)(.*)$",
            re.IGNORECASE,
        ),
    ),
    (
        "lexical_resource",
        re.compile(
            r"^(?:#{1,4}\s*)?(?:[-*]\s+)?(?:[1-4]\.\s*)?(?:\*{2}\s*)?(?:lexical\s+resource(?:\s*\((?:lr|vocabulary)\))?)(.*)$",
            re.IGNORECASE,
        ),
    ),
    (
        "grammatical_range",
        re.compile(
            r"^(?:#{1,4}\s*)?(?:[-*]\s+)?(?:[1-4]\.\s*)?(?:\*{2}\s*)?(?:grammatical\s+range\s*(?:&|and)\s*accuracy(?:\s*\(gra\))?)(.*)$",
            re.IGNORECASE,
        ),
    ),
    (
        "other_section",
        re.compile(
            r"^(?:#{1,4}\s*)?(?:[-*]\s+)?(?:\*{2}\s*)?(?:feedback|additional\s+comments|evaluation\s+checklist|summary|collocation|synonym|next\s+steps)",
            re.IGNORECASE,
        ),
    ),
]

# Biểu thức bắt điểm từ các bảng tổng hợp markdown (| Criterion | Band |)
_TABLE_CRITERION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("task_response", re.compile(r"^\|\s*\*{0,2}task\s+(?:response|achievement)(?:\s*\((?:tr|ta)\))?\*{0,2}\s*\|\s*([^|]+)\|", re.IGNORECASE)),
    ("coherence_cohesion", re.compile(r"^\|\s*\*{0,2}coherence\s*(?:&|and)\s*cohesion(?:\s*\(cc\))?\*{0,2}\s*\|\s*([^|]+)\|", re.IGNORECASE)),
    ("lexical_resource", re.compile(r"^\|\s*\*{0,2}lexical\s+resource(?:\s*\((?:lr|vocabulary)\))?\*{0,2}\s*\|\s*([^|]+)\|", re.IGNORECASE)),
    ("grammatical_range", re.compile(r"^\|\s*\*{0,2}grammatical\s+range\s*(?:&|and)\s*accuracy(?:\s*\(gra\))?\*{0,2}\s*\|\s*([^|]+)\|", re.IGNORECASE)),
]


def extract_scores_from_evaluation(evaluation: str) -> dict[str, float | None]:
    """Trích xuất điểm overall và 4 tiêu chí thành phần IELTS từ văn bản đánh giá markdown."""
    results: dict[str, float | None] = {
        "overall_eval": None,
        "task_response": None,
        "coherence_cohesion": None,
        "lexical_resource": None,
        "grammatical_range": None,
    }
    if not isinstance(evaluation, str) or not evaluation.strip():
        return results

    lines = normalize_display_text(evaluation).split("\n")
    hits: list[tuple[int, str, str]] = []
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        # Kiểm tra trực tiếp các dòng dạng bảng markdown trước
        if stripped.startswith("|"):
            for key, tpat in _TABLE_CRITERION_PATTERNS:
                tm = tpat.match(stripped)
                if tm and results[key] is None:
                    cell = tm.group(1).strip()
                    val, note = parse_numeric_band(cell)
                    if val is not None:
                        results[key] = val
                    elif note == "lt4":
                        results[key] = 3.5
                    elif note == "lt4.5":
                        results[key] = 4.0
            continue

        for key, pat in _SECTION_PATTERNS:
            m = pat.match(stripped)
            if m:
                tail = m.group(1) if m.lastindex else ""
                hits.append((idx, key, tail))
                break

    for pos, (line_idx, key, tail) in enumerate(hits):
        if key == "other_section":
            continue
        next_idx = hits[pos + 1][0] if pos + 1 < len(hits) else len(lines)
        section_lines = lines[line_idx + 1 : next_idx]
        score = _extract_score_from_section(section_lines, tail)
        if score is not None and results[key] is None:
            results[key] = score

    return results


def resolve_overall_band(
    raw_band: Any,
    eval_scores: dict[str, float | None],
) -> tuple[float | None, str]:
    """Quy giải cột band thô kết hợp với điểm trích từ evaluation về giá trị chuẩn [1.0, 9.0] bước 0.5."""
    val, note = parse_numeric_band(raw_band)
    if val is not None:
        return val, f"raw_{note}"

    sub_vals = [
        eval_scores[k]
        for k in ("task_response", "coherence_cohesion", "lexical_resource", "grammatical_range")
        if eval_scores.get(k) is not None
    ]
    eval_overall = eval_scores.get("overall_eval")

    # Với các nhãn "<4" hoặc "<4.5", đối chiếu thêm điểm trong evaluation hoặc gán mốc mặc định (3.5 / 4.0)
    if note in {"lt4", "lt4.5"}:
        upper = 3.5 if note == "lt4" else 4.0
        if eval_overall is not None and eval_overall <= upper:
            return eval_overall, f"{note}_from_eval"
        if len(sub_vals) >= 2:
            avg = round_to_half_band(sum(sub_vals) / len(sub_vals))
            if avg <= upper:
                return avg, f"{note}_from_subscores"
        return upper, f"{note}_default_{upper}"

    # Dự phòng nếu cột band thô bị thiếu hoặc lỗi định dạng
    if eval_overall is not None:
        return eval_overall, "fallback_eval_overall"
    return None, f"invalid_band:{note}"


def extract_jackrong_topic_header(evaluation: str) -> str:
    """Trích xuất phần đề bài được trích lại trong mục `### Topic` của phần đánh giá Jackrong."""
    if not isinstance(evaluation, str):
        return ""
    m = re.search(
        r"###\s*Topic\s*\n+(.*?)(?:\n+###\s|\n+---|\Z)",
        normalize_display_text(evaluation),
        re.DOTALL | re.IGNORECASE,
    )
    if not m:
        return ""
    txt = m.group(1).strip()
    txt = re.sub(r"^\*\*Prompt:\*\*\s*", "", txt, flags=re.IGNORECASE)
    txt = txt.strip("* \n\t")
    txt = re.sub(r"^\*\*|\*\*$", "", txt).strip()
    return txt


_PROMPT_END_PATTERNS = [
    r"to what extent do you agree or disagree\??",
    r"do you agree or disagree\??",
    r"discuss both(?: these)? views and give your(?: own)? opinion\.?",
    r"discuss both sides and give your(?: own)? opinion\.?",
    r"do the advantages(?: of this)? outweigh the disadvantages\??",
    r"what are the causes(?: of this)? and what can be done(?: to solve this problem)?\??",
    r"give reasons for your answer and include any relevant examples from your own knowledge or experience\.?",
    r"write at least 250 words\.?",
]
_PROMPT_END_RE = re.compile(
    r"(?:" + "|".join(_PROMPT_END_PATTERNS) + r")\s*$",
    re.IGNORECASE,
)


def split_jackrong_topic(
    raw_topic: str,
    evaluation: str,
    chillies_by_topic_norm: dict[str, tuple[str, str]],
    known_prompts_norm: dict[str, str],
) -> tuple[str, str, str]:
    """Tách chuỗi `topic` gộp của Jackrong thành bộ ba `(prompt, essay, phương_pháp_tách)` qua 5 tầng ưu tiên."""
    text = normalize_display_text(raw_topic)
    if not text:
        return "", "", "empty"

    # 1. Khớp chính xác toàn bộ (prompt + essay) với dữ liệu từ nguồn chillies
    topic_norm = normalize_for_dedup(text)
    if topic_norm in chillies_by_topic_norm:
        c_prompt, c_essay = chillies_by_topic_norm[topic_norm]
        return c_prompt, c_essay, "chillies_exact_topic"

    # Thu thập các điểm ngắt dòng tiềm năng (ưu tiên ngắt đoạn `\n\n`, sau đó mới xét `\n`)
    split_candidates: list[int] = [m.start() for m in re.finditer(r"\n\n", text)]
    if not split_candidates:
        split_candidates = [m.start() for m in re.finditer(r"\n", text)]

    # 2. Khớp phần đầu (prefix) với danh sách đề bài đã biết từ chillies
    for idx in split_candidates:
        prefix = text[:idx].strip()
        prefix_norm = normalize_for_dedup(prefix)
        if prefix_norm in known_prompts_norm:
            suffix = text[idx:].strip()
            if len(suffix.split()) >= 10:
                return prefix, suffix, "chillies_known_prompt"

    # 3. Đối chiếu phần đầu với mục `### Topic` trong phần evaluation của chính Jackrong (khớp chính xác hoặc mờ >= 0.72)
    eval_prompt = extract_jackrong_topic_header(evaluation)
    eval_prompt_norm = normalize_for_dedup(eval_prompt)
    if eval_prompt_norm and split_candidates:
        best_idx = None
        best_score = 0.0
        for idx in split_candidates:
            prefix = text[:idx].strip()
            suffix = text[idx:].strip()
            if len(prefix) > 1500 or len(suffix.split()) < 10:
                continue
            prefix_norm = normalize_for_dedup(prefix)
            if not prefix_norm:
                continue
            if prefix_norm == eval_prompt_norm:
                return prefix, suffix, "eval_topic_exact"
            sim = SequenceMatcher(None, prefix_norm, eval_prompt_norm).ratio()
            if sim > best_score:
                best_score = sim
                best_idx = idx
        if best_idx is not None and best_score >= 0.72:
            return text[:best_idx].strip(), text[best_idx:].strip(), "eval_topic_fuzzy"

    # 4. Heuristic: tách tại điểm ngắt nếu phần đầu kết thúc bằng dấu `?` hoặc mẫu câu hỏi đề IELTS quen thuộc
    for idx in split_candidates:
        prefix = text[:idx].strip()
        suffix = text[idx:].strip()
        if 20 <= len(prefix) <= 1200 and len(suffix.split()) >= MIN_ESSAY_WORDS:
            if prefix.endswith("?") or _PROMPT_END_RE.search(prefix):
                return prefix, suffix, "prompt_end_heuristic"

    # 5. Phương án cuối: cắt tại dấu ngắt đầu tiên nếu độ dài phần đề nằm trong khoảng hợp lý
    if split_candidates:
        idx = split_candidates[0]
        prefix = text[:idx].strip()
        suffix = text[idx:].strip()
        if 15 <= len(prefix) <= 1200 and len(suffix.split()) >= 10:
            return prefix, suffix, "first_double_newline"

    return "", text, "unsplit"


def stratified_group_split(
    records: list[dict[str, Any]],
    group_field: str = "group_id",
    ratios: tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 42,
) -> dict[str, list[dict[str, Any]]]:
    """Chia tập dữ liệu theo nhóm (group_id) với thuật toán tham lam cân bằng kích thước, phân bố band điểm và nguồn dữ liệu."""
    rng = random.Random(seed)
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rec in records:
        groups[rec[group_field]].append(rec)

    split_names = ("train", "val", "test")
    total_records = len(records)
    target_totals = {
        name: total_records * ratio for name, ratio in zip(split_names, ratios)
    }

    band_counts: Counter[float] = Counter(rec["overall_band"] for rec in records)
    target_bands = {
        name: {k: v * ratio for k, v in band_counts.items()}
        for name, ratio in zip(split_names, ratios)
    }

    source_counts: Counter[str] = Counter(rec["source"] for rec in records)
    target_sources = {
        name: {k: v * ratio for k, v in source_counts.items()}
        for name, ratio in zip(split_names, ratios)
    }

    # Xếp các nhóm lớn hơn trước để phân bổ tham lam đạt độ cân bằng tốt nhất
    group_items = list(groups.items())
    rng.shuffle(group_items)
    group_items.sort(key=lambda kv: len(kv[1]), reverse=True)

    assigned: dict[str, list[dict[str, Any]]] = {name: [] for name in split_names}
    cur_totals: dict[str, int] = {name: 0 for name in split_names}
    cur_bands: dict[str, Counter[float]] = {name: Counter() for name in split_names}
    cur_sources: dict[str, Counter[str]] = {name: Counter() for name in split_names}

    def _sq_err_delta(cur: float, add: float, tgt: float, denom_floor: float = 0.25) -> float:
        denom = max(denom_floor, tgt)
        return ((cur + add - tgt) ** 2 - (cur - tgt) ** 2) / denom

    # Với mỗi nhóm liên thông (không thể tách lẻ), chọn tập train/val/test làm tăng sai lệch tổng hợp ít nhất
    for _, grp_records in group_items:
        grp_size = len(grp_records)
        grp_bands = Counter(r["overall_band"] for r in grp_records)
        grp_sources = Counter(r["source"] for r in grp_records)

        best_split = split_names[0]
        best_cost = float("inf")
        for name in split_names:
            total_delta = _sq_err_delta(cur_totals[name], grp_size, target_totals[name], denom_floor=1.0)
            band_delta = sum(
                _sq_err_delta(cur_bands[name][b], cnt, target_bands[name].get(b, 0.0))
                for b, cnt in grp_bands.items()
            )
            source_delta = sum(
                _sq_err_delta(cur_sources[name][s], cnt, target_sources[name].get(s, 0.0))
                for s, cnt in grp_sources.items()
            )
            cost = 2.0 * total_delta + band_delta + 0.5 * source_delta
            if cost < best_cost:
                best_cost = cost
                best_split = name

        assigned[best_split].extend(grp_records)
        cur_totals[best_split] += grp_size
        cur_bands[best_split].update(grp_bands)
        cur_sources[best_split].update(grp_sources)

    for name in split_names:
        rng.shuffle(assigned[name])
    return assigned


def _assign_leakage_groups(records: list[dict[str, Any]]) -> None:
    """Gán `group_id` bằng thuật toán Union-Find liên kết mọi bài có chung đề bài chuẩn hóa hoặc trùng 120 ký tự đầu."""
    n = len(records)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    # Gộp chung nhóm nếu hai bài chia sẻ cùng đề bài (chống rò rỉ đề) hoặc cùng phần mở bài 120 ký tự (chống rò rỉ bài viết gần giống)
    by_prompt: dict[str, int] = {}
    by_prefix: dict[str, int] = {}
    for idx, rec in enumerate(records):
        pn = rec["_prompt_norm"]
        if pn in by_prompt:
            union(by_prompt[pn], idx)
        else:
            by_prompt[pn] = idx
        px = rec["_essay_norm"][:120]
        if len(px) >= 60:
            if px in by_prefix:
                union(by_prefix[px], idx)
            else:
                by_prefix[px] = idx

    for idx, rec in enumerate(records):
        rec["group_id"] = f"grp_{find(idx)}"


def build_datasets(inspect_only: bool = False, output_dir: Path = DEFAULT_OUTPUT_DIR, seed: int = 42) -> dict[str, Any]:
    """Tải 2 bộ dữ liệu, lọc sạch, khử trùng lặp chillies + Jackrong, chia train/val/test chống rò rỉ và xuất JSONL."""
    print(f"Loading {CHILLIES_DATASET}...")
    chillies_ds = load_dataset(CHILLIES_DATASET)
    print(f"Loading {JACKRONG_DATASET}...")
    jackrong_ds = load_dataset(JACKRONG_DATASET)

    drop_reasons: Counter[str] = Counter()
    source_raw_counts: dict[str, int] = {
        CHILLIES_DATASET: sum(len(chillies_ds[s]) for s in chillies_ds.keys()),
        JACKRONG_DATASET: sum(len(jackrong_ds[s]) for s in jackrong_ds.keys()),
    }

    # Bước 1: Đọc và lọc dữ liệu nguồn chillies (đồng thời lập chỉ mục đề bài để hỗ trợ tách chuỗi Jackrong ở bước 2)
    chillies_records: list[dict[str, Any]] = []
    chillies_by_topic_norm: dict[str, tuple[str, str]] = {}
    known_prompts_norm: dict[str, str] = {}

    for split_name in chillies_ds.keys():
        ds_split = chillies_ds[split_name]
        for idx, row in enumerate(ds_split):
            prompt = normalize_display_text(row.get("prompt"))
            essay = normalize_display_text(row.get("essay"))
            evaluation = normalize_display_text(row.get("evaluation"))

            if prompt:
                p_norm = normalize_for_dedup(prompt)
                if p_norm and p_norm not in known_prompts_norm:
                    known_prompts_norm[p_norm] = prompt
            if prompt and essay:
                t_norm = normalize_for_dedup(prompt + " " + essay)
                if t_norm and t_norm not in chillies_by_topic_norm:
                    chillies_by_topic_norm[t_norm] = (prompt, essay)

            # Lọc bỏ các dòng thiếu bài viết, bài < 30 từ, văn bản trắc nghiệm rác hoặc thiếu đề bài
            if not essay:
                drop_reasons["chillies_empty_essay"] += 1
                continue
            word_count = len(essay.split())
            if word_count < MIN_ESSAY_WORDS:
                drop_reasons["chillies_short_essay_lt30"] += 1
                continue
            if is_non_essay_artifact(essay):
                drop_reasons["chillies_non_essay_artifact"] += 1
                continue
            if not prompt:
                drop_reasons["chillies_empty_prompt"] += 1
                continue

            eval_scores = extract_scores_from_evaluation(evaluation)
            overall_band, band_note = resolve_overall_band(row.get("band"), eval_scores)
            if overall_band is None:
                drop_reasons[f"chillies_{band_note}"] += 1
                continue

            essay_norm = normalize_for_dedup(essay)
            if not essay_norm:
                drop_reasons["chillies_empty_norm_essay"] += 1
                continue

            chillies_records.append(
                {
                    "id": f"chillies_{split_name}_{idx}",
                    "source": CHILLIES_DATASET,
                    "prompt": prompt,
                    "essay": essay,
                    "overall_band": overall_band,
                    "task_response": eval_scores["task_response"],
                    "coherence_cohesion": eval_scores["coherence_cohesion"],
                    "lexical_resource": eval_scores["lexical_resource"],
                    "grammatical_range": eval_scores["grammatical_range"],
                    "reasoning": None,
                    "feedback": evaluation if evaluation else None,
                    "_essay_norm": essay_norm,
                    "_prompt_norm": normalize_for_dedup(prompt),
                    "_band_note": band_note,
                    "_eval_overall": eval_scores["overall_eval"],
                }
            )

    # Bước 2: Đọc, tách (prompt, essay) và lọc dữ liệu nguồn Jackrong
    jackrong_records: list[dict[str, Any]] = []
    split_method_counts: Counter[str] = Counter()

    for split_name in jackrong_ds.keys():
        ds_split = jackrong_ds[split_name]
        for idx, row in enumerate(ds_split):
            evaluation = normalize_display_text(row.get("evaluation"))
            reasoning = normalize_display_text(row.get("reasoning"))
            raw_topic = row.get("topic") or ""
            if not raw_topic and isinstance(row.get("conversation"), list) and row["conversation"]:
                raw_topic = row["conversation"][0].get("value", "")

            prompt, essay, split_method = split_jackrong_topic(
                raw_topic, evaluation, chillies_by_topic_norm, known_prompts_norm
            )
            split_method_counts[split_method] += 1

            if not essay:
                drop_reasons["jackrong_empty_essay"] += 1
                continue
            if len(essay.split()) < MIN_ESSAY_WORDS:
                drop_reasons["jackrong_short_essay_lt30"] += 1
                continue
            if is_non_essay_artifact(essay):
                drop_reasons["jackrong_non_essay_artifact"] += 1
                continue
            if not prompt:
                drop_reasons["jackrong_unsplit_prompt"] += 1
                continue

            eval_scores = extract_scores_from_evaluation(evaluation)
            overall_band, band_note = resolve_overall_band(row.get("band"), eval_scores)
            if overall_band is None:
                drop_reasons[f"jackrong_{band_note}"] += 1
                continue

            essay_norm = normalize_for_dedup(essay)
            if not essay_norm:
                drop_reasons["jackrong_empty_norm_essay"] += 1
                continue

            orig_id = str(row.get("id") or f"{split_name}_{idx}")
            jackrong_records.append(
                {
                    "id": f"jackrong_{orig_id}",
                    "source": JACKRONG_DATASET,
                    "prompt": prompt,
                    "essay": essay,
                    "overall_band": overall_band,
                    "task_response": eval_scores["task_response"],
                    "coherence_cohesion": eval_scores["coherence_cohesion"],
                    "lexical_resource": eval_scores["lexical_resource"],
                    "grammatical_range": eval_scores["grammatical_range"],
                    "reasoning": reasoning if reasoning else None,
                    "feedback": evaluation if evaluation else None,
                    "_essay_norm": essay_norm,
                    "_prompt_norm": normalize_for_dedup(prompt),
                    "_band_note": band_note,
                    "_eval_overall": eval_scores["overall_eval"],
                }
            )

    # Bước 3: Thống kê độ giao thoa và chênh lệch điểm giữa chillies và Jackrong (phục vụ chế độ --inspect-only)
    chillies_by_essay: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in chillies_records:
        chillies_by_essay[r["_essay_norm"]].append(r)

    jackrong_by_essay: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in jackrong_records:
        jackrong_by_essay[r["_essay_norm"]].append(r)

    chillies_unique_keys = set(chillies_by_essay.keys())
    jackrong_unique_keys = set(jackrong_by_essay.keys())
    overlap_keys = chillies_unique_keys & jackrong_unique_keys
    chillies_only_keys = chillies_unique_keys - jackrong_unique_keys
    jackrong_only_keys = jackrong_unique_keys - chillies_unique_keys

    # Đối chiếu chênh lệch điểm band trên các bài xuất hiện ở cả hai bộ dữ liệu
    band_diffs = []
    chillies_band_vs_eval_diffs = []
    for k in overlap_keys:
        cr = chillies_by_essay[k][0]
        jr = jackrong_by_essay[k][0]
        band_diffs.append(abs(cr["overall_band"] - jr["overall_band"]))
        if cr["_eval_overall"] is not None:
            chillies_band_vs_eval_diffs.append(abs(cr["overall_band"] - cr["_eval_overall"]))

    chillies_only_eval_diffs = [
        abs(chillies_by_essay[k][0]["overall_band"] - chillies_by_essay[k][0]["_eval_overall"])
        for k in chillies_only_keys
        if chillies_by_essay[k][0]["_eval_overall"] is not None
    ]

    if inspect_only:
        all_prompts = {r["_prompt_norm"] for r in chillies_records + jackrong_records}
        prompt_sizes = Counter(
            r["_prompt_norm"] for r in list({r["_essay_norm"]: r for r in chillies_records + jackrong_records}.values())
        )
        diag = {
            "source_raw_counts": source_raw_counts,
            "chillies_valid_rows": len(chillies_records),
            "chillies_unique_essays": len(chillies_unique_keys),
            "jackrong_valid_rows": len(jackrong_records),
            "jackrong_unique_essays": len(jackrong_unique_keys),
            "overlap_unique_essays": len(overlap_keys),
            "chillies_only_unique_essays": len(chillies_only_keys),
            "jackrong_only_unique_essays": len(jackrong_only_keys),
            "drop_reasons": dict(drop_reasons),
            "jackrong_split_methods": dict(split_method_counts),
            "overlap_mean_abs_band_diff_chillies_vs_jackrong": (
                round(sum(band_diffs) / len(band_diffs), 3) if band_diffs else None
            ),
            "overlap_chillies_band_vs_own_eval_gt2": sum(1 for d in chillies_band_vs_eval_diffs if d >= 2.0),
            "chillies_only_band_vs_own_eval_gt2": sum(1 for d in chillies_only_eval_diffs if d >= 2.0),
            "unique_prompts": len(all_prompts),
            "top_10_prompt_cluster_sizes": prompt_sizes.most_common(10),
            "jackrong_band_dist": dict(sorted(Counter(jackrong_by_essay[k][0]["overall_band"] for k in jackrong_unique_keys).items())),
            "chillies_only_band_dist": dict(sorted(Counter(chillies_by_essay[k][0]["overall_band"] for k in chillies_only_keys).items())),
            "jackrong_subcriteria_coverage": {
                c: sum(1 for k in jackrong_unique_keys if jackrong_by_essay[k][0][c] is not None)
                for c in ("task_response", "coherence_cohesion", "lexical_resource", "grammatical_range")
            },
            "chillies_only_subcriteria_coverage": {
                c: sum(1 for k in chillies_only_keys if chillies_by_essay[k][0][c] is not None)
                for c in ("task_response", "coherence_cohesion", "lexical_resource", "grammatical_range")
            },
        }
        print(json.dumps(diag, indent=2))
        return diag

    # Bước 4: Khử trùng lặp cả trong từng nguồn và xuyên giữa 2 nguồn (chillies + Jackrong):
    # - Khi một bài xuất hiện ở cả 2 nguồn, ưu tiên giữ bản ghi Jackrong (có CoT reasoning, rubric 4 tiêu chí đồng nhất, nhãn sạch hơn).
    # - Khi trùng lặp trong cùng một nguồn, giữ bản ghi có độ đầy đủ thông tin cao nhất (có reasoning, nhiều tiêu chí con nhất).
    def _completeness(rec: dict[str, Any]) -> tuple[int, int]:
        sub_cnt = sum(
            1
            for c in ("task_response", "coherence_cohesion", "lexical_resource", "grammatical_range")
            if rec[c] is not None
        )
        has_reasoning = 1 if rec["reasoning"] else 0
        return (has_reasoning, sub_cnt)

    deduped_by_essay: dict[str, dict[str, Any]] = {}
    within_source_dups: Counter[str] = Counter()
    cross_source_dups = 0

    # Đưa toàn bộ bản ghi Jackrong vào bảng băm trước để tự động ưu tiên Jackrong khi trùng bài
    for rec in jackrong_records:
        key = rec["_essay_norm"]
        if key not in deduped_by_essay:
            deduped_by_essay[key] = rec
        else:
            within_source_dups[JACKRONG_DATASET] += 1
            if _completeness(rec) > _completeness(deduped_by_essay[key]):
                deduped_by_essay[key] = rec

    # Duyệt chillies: nếu trùng với Jackrong thì loại chillies (tăng cross_source_dups); nếu trùng nội bộ chillies thì chọn bản đầy đủ hơn
    for rec in chillies_records:
        key = rec["_essay_norm"]
        if key in deduped_by_essay:
            if deduped_by_essay[key]["source"] == JACKRONG_DATASET:
                cross_source_dups += 1
            else:
                within_source_dups[CHILLIES_DATASET] += 1
                if _completeness(rec) > _completeness(deduped_by_essay[key]):
                    deduped_by_essay[key] = rec
        else:
            deduped_by_essay[key] = rec

    combined_records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for essay_norm, rec in deduped_by_essay.items():
        essay_hash = sha256_short(essay_norm)
        rec_id = rec["id"]
        if rec_id in seen_ids:
            rec_id = f"{rec_id}_{essay_hash[:6]}"
        seen_ids.add(rec_id)
        rec["id"] = rec_id
        combined_records.append(rec)

    # Bước 5: Gom nhóm liên thông chống rò rỉ đề bài / tiền tố bài viết rồi chia train/val/test (80/10/10)
    _assign_leakage_groups(combined_records)
    splits = stratified_group_split(combined_records, group_field="group_id", ratios=(0.8, 0.1, 0.1), seed=seed)

    # Kiểm chứng bắt buộc trước khi ghi tệp: tuyệt đối không được trùng lặp bài luận hoặc đề bài giữa train, val và test
    split_essay_sets = {
        name: {r["_essay_norm"] for r in recs} for name, recs in splits.items()
    }
    assert not (split_essay_sets["train"] & split_essay_sets["val"]), "Essay leakage train/val!"
    assert not (split_essay_sets["train"] & split_essay_sets["test"]), "Essay leakage train/test!"
    assert not (split_essay_sets["val"] & split_essay_sets["test"]), "Essay leakage val/test!"

    split_prompt_sets = {
        name: {r["_prompt_norm"] for r in recs} for name, recs in splits.items()
    }
    assert not (split_prompt_sets["train"] & split_prompt_sets["val"]), "Prompt leakage train/val!"
    assert not (split_prompt_sets["train"] & split_prompt_sets["test"]), "Prompt leakage train/test!"
    assert not (split_prompt_sets["val"] & split_prompt_sets["test"]), "Prompt leakage val/test!"

    output_dir.mkdir(parents=True, exist_ok=True)
    schema_fields = (
        "id",
        "source",
        "prompt",
        "essay",
        "overall_band",
        "task_response",
        "coherence_cohesion",
        "lexical_resource",
        "grammatical_range",
        "reasoning",
        "feedback",
    )

    for split_name, recs in splits.items():
        out_path = output_dir / f"{split_name}.jsonl"
        with out_path.open("w", encoding="utf-8") as f:
            for rec in recs:
                clean_rec = {k: rec[k] for k in schema_fields}
                f.write(json.dumps(clean_rec, ensure_ascii=False) + "\n")

    def _split_stats(recs: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "count": len(recs),
            "by_source": dict(Counter(r["source"] for r in recs)),
            "band_distribution": {
                str(k): v for k, v in sorted(Counter(r["overall_band"] for r in recs).items())
            },
            "subcriteria_coverage": {
                c: sum(1 for r in recs if r[c] is not None)
                for c in ("task_response", "coherence_cohesion", "lexical_resource", "grammatical_range")
            },
            "reasoning_coverage": sum(1 for r in recs if r["reasoning"]),
            "feedback_coverage": sum(1 for r in recs if r["feedback"]),
        }

    summary = {
        "schema_fields": list(schema_fields),
        "raw_counts_by_source": source_raw_counts,
        "drop_reasons": dict(drop_reasons),
        "deduplication": {
            "within_source_duplicates_dropped": dict(within_source_dups),
            "cross_source_overlap_chillies_replaced_by_jackrong": cross_source_dups,
            "total_unique_records": len(combined_records),
            "jackrong_topic_split_methods": dict(split_method_counts),
        },
        "final_counts_by_source": dict(Counter(r["source"] for r in combined_records)),
        "final_band_distribution": {
            str(k): v for k, v in sorted(Counter(r["overall_band"] for r in combined_records).items())
        },
        "final_subcriteria_coverage": {
            c: {
                "count": sum(1 for r in combined_records if r[c] is not None),
                "ratio": round(
                    sum(1 for r in combined_records if r[c] is not None) / max(1, len(combined_records)),
                    4,
                ),
            }
            for c in ("task_response", "coherence_cohesion", "lexical_resource", "grammatical_range")
        },
        "splits": {name: _split_stats(recs) for name, recs in splits.items()},
        "zero_essay_leakage_verified": True,
        "zero_prompt_leakage_verified": True,
        "num_leakage_groups": len({r["group_id"] for r in combined_records}),
        "seed": seed,
    }

    summary_path = output_dir / "dataset_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return summary


def main() -> None:
    """Điểm vào CLI để kiểm tra hoặc tạo bộ dữ liệu train/val/test JSONL."""
    parser = argparse.ArgumentParser(description="Prepare IELTS Writing Task 2 combined dataset.")
    parser.add_argument("--inspect-only", action="store_true", help="Inspect counts and overlap without writing files.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Output directory for JSONL files.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic splitting.")
    args = parser.parse_args()
    build_datasets(inspect_only=args.inspect_only, output_dir=args.output_dir, seed=args.seed)


if __name__ == "__main__":
    main()
