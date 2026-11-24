"""Mô hình Baseline chấm điểm IELTS Writing Task 2: kết hợp TF-IDF + đặc trưng bề mặt/từ vựng/cú pháp + Ensemble Ridge & LightGBM.

Module này cũng xuất các hàm rút trích đặc trưng tất định (deterministic) và tính độ tương đồng
TF-IDF cosine dùng chung cho quá trình suy luận Hybrid và sinh phản hồi ở `infer.py`.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from lightgbm import LGBMRegressor, early_stopping, log_evaluation
from scipy.sparse import csr_matrix, hstack
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold, KFold
from sklearn.preprocessing import StandardScaler

from evaluate import (
    SUBCRITERIA_KEYS,
    evaluate_predictions,
    load_jsonl,
    print_evaluation_summary,
    round_to_half_band,
)

# 5 đầu điểm mục tiêu: band tổng thể và 4 tiêu chí thành phần
TARGETS = ("overall_band",) + SUBCRITERIA_KEYS

# Tập hư từ tiếng Anh và các từ phổ thông trong đề bài IELTS để lọc ra từ khóa nội dung
_STOPWORDS = frozenset(
    {
        "a", "an", "the", "and", "or", "but", "if", "while", "because", "although",
        "though", "since", "unless", "until", "when", "where", "which", "who", "whom",
        "whose", "that", "this", "these", "those", "is", "are", "was", "were", "be",
        "been", "being", "am", "do", "does", "did", "doing", "have", "has", "had",
        "having", "will", "would", "shall", "should", "can", "could", "may", "might",
        "must", "to", "of", "in", "on", "at", "by", "for", "with", "about", "against",
        "between", "into", "through", "during", "before", "after", "above", "below",
        "from", "up", "down", "out", "off", "over", "under", "again", "further", "then",
        "once", "here", "there", "all", "any", "both", "each", "few", "more", "most",
        "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
        "than", "too", "very", "s", "t", "just", "don", "now", "i", "me", "my",
        "myself", "we", "our", "ours", "you", "your", "yours", "he", "him", "his",
        "she", "her", "hers", "it", "its", "they", "them", "their", "theirs", "what",
        "as", "also", "many", "much", "people", "think", "believe", "agree", "disagree",
        "extent", "opinion", "essay", "discuss", "both", "views", "give", "reasons",
        "include", "relevant", "examples", "knowledge", "experience",
    }
)

# Các nhóm từ nối diễn ngôn (discourse markers) theo chức năng mạch lạc
_DM_CONTRAST = (
    "however", "nevertheless", "nonetheless", "although", "even though", "whereas",
    "conversely", "on the other hand", "in contrast", "despite", "in spite of",
    "yet", "still",
)
_DM_CAUSAL = (
    "therefore", "consequently", "thus", "hence", "as a result", "for this reason",
    "due to", "owing to", "because of", "lead to", "leads to", "result in",
)
_DM_ADDITIVE = (
    "furthermore", "moreover", "additionally", "in addition", "besides",
    "for instance", "for example", "specifically", "in particular", "similarly",
    "likewise", "not only",
)
_DM_CONCLUSION = (
    "in conclusion", "to conclude", "to summarize", "to sum up", "in summary",
    "overall", "ultimately", "all in all",
)
# Từ nối phụ thuộc, đại từ quan hệ và động từ khuyết thiếu để đo độ đa dạng cú pháp
_SUBORDINATORS = (
    "because", "although", "though", "since", "while", "whereas", "unless",
    "if", "provided", "whenever", "wherever", "even if", "so that", "in order that",
)
_REL_PRONOUNS = ("which", "who", "whom", "whose", "whereby", "wherein", "that")
_MODALS = ("can", "could", "may", "might", "should", "would", "must", "ought")

_VOWEL_GROUP_RE = re.compile(r"[aeiouy]+", re.IGNORECASE)
_WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")
_PASSIVE_RE = re.compile(r"\b(?:is|are|was|were|been|being|be)\s+\w+(?:ed|en)\b", re.IGNORECASE)
_ARTICLE_VOWEL_ERR_RE = re.compile(
    r"\ba\s+(?!(?:university|uniform|unique|useful|usual|unit|union|european|one|once|utensil|eulogy)\b)[aeiou]\w+",
    re.IGNORECASE,
)
_DOUBLE_WORD_RE = re.compile(r"\b([A-Za-z]+)\s+\1\b", re.IGNORECASE)


def _count_syllables(word: str) -> int:
    """Ước lượng số âm tiết của một từ tiếng Anh dựa trên nhóm nguyên âm."""
    w = word.lower().strip("'")
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    groups = _VOWEL_GROUP_RE.findall(w)
    return max(1, len(groups))


def _simple_stem(token: str) -> str:
    """Rút gọn hậu tố từ vựng đơn giản (lightweight stemming) phục vụ so khớp từ khóa đề bài."""
    t = token.lower()
    for suffix in ("ings", "ing", "ations", "ation", "ments", "ment", "ities", "ity", "ness", "ers", "ies", "ied", "ed", "es", "s", "ly"):
        if len(t) > len(suffix) + 3 and t.endswith(suffix):
            return t[: -len(suffix)]
    return t


def _content_tokens(text: str) -> list[str]:
    """Trích danh sách gốc từ nội dung (loại bỏ hư từ và từ ngắn dưới 3 ký tự)."""
    tokens = [w.lower() for w in _WORD_RE.findall(text)]
    return [_simple_stem(t) for t in tokens if len(t) >= 3 and t not in _STOPWORDS]


def _count_phrases(text_lower: str, phrases: tuple[str, ...]) -> tuple[int, int]:
    """Đếm tổng số lần xuất hiện và số loại cụm từ riêng biệt trong văn bản viết thường."""
    total = 0
    unique_used = 0
    for ph in phrases:
        c = len(re.findall(rf"\b{re.escape(ph)}\b", text_lower))
        if c > 0:
            total += c
            unique_used += 1
    return total, unique_used


def extract_surface_features(prompt: str, essay: str) -> dict[str, float]:
    """Rút trích 65 đặc trưng bề mặt tất định: độ dài, câu/đoạn, dấu câu, đa dạng từ vựng, độ lặp, từ nối, cú pháp và độ khớp đề bài."""
    prompt_str = (prompt or "").strip()
    essay_str = (essay or "").strip()
    essay_lower = essay_str.lower()

    raw_words = _WORD_RE.findall(essay_str)
    words_lower = [w.lower() for w in raw_words]
    wc = len(words_lower)
    wc_safe = max(1, wc)

    char_count = len(essay_str)
    word_lens = [len(w) for w in words_lower] or [0]
    avg_word_len = float(np.mean(word_lens))
    std_word_len = float(np.std(word_lens))

    # Nhóm 1: Đặc trưng phân tách câu và đoạn văn (Sentences & paragraphs)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\r\n\r\n", essay_str) if p.strip()]
    if len(paragraphs) <= 1 and "\n" in essay_str:
        paragraphs = [p.strip() for p in essay_str.splitlines() if p.strip()]
    para_count = max(1, len(paragraphs)) if essay_str else 0

    raw_sents = [s.strip() for s in _SENT_SPLIT_RE.split(essay_str) if s.strip() and _WORD_RE.search(s)]
    sent_count = max(1, len(raw_sents)) if wc > 0 else 0
    sent_lens = [len(_WORD_RE.findall(s)) for s in raw_sents] or [0]
    avg_sent_len = float(np.mean(sent_lens))
    std_sent_len = float(np.std(sent_lens))
    min_sent_len = float(np.min(sent_lens))
    max_sent_len = float(np.max(sent_lens))
    short_sent_ratio = float(np.mean([l < 8 for l in sent_lens])) if raw_sents else 0.0
    long_sent_ratio = float(np.mean([l > 22 for l in sent_lens])) if raw_sents else 0.0

    lowercase_sent_start = sum(1 for s in raw_sents if s and s[0].islower())
    missing_end_punct = sum(1 for s in raw_sents if s and s[-1] not in ".!?\"')")
    lowercase_sent_start_ratio = lowercase_sent_start / max(1, sent_count)
    missing_end_punct_ratio = missing_end_punct / max(1, sent_count)

    # Nhóm 2: Dấu câu, định dạng chữ hoa/thường và lỗi chính tả cơ học (Punctuation & formatting)
    comma_count = essay_str.count(",")
    period_count = essay_str.count(".")
    semicolon_count = essay_str.count(";")
    colon_count = essay_str.count(":")
    excl_count = essay_str.count("!")
    question_count = essay_str.count("?")
    quote_count = essay_str.count('"') + essay_str.count("'")
    paren_count = essay_str.count("(") + essay_str.count(")")
    lowercase_i_count = len(re.findall(r"(?<![A-Za-z])i(?![A-Za-z'])", essay_str))
    digit_count = len(re.findall(r"\d+", essay_str))
    all_caps_words = sum(1 for w in raw_words if len(w) >= 2 and w.isupper())

    # Nhóm 3: Độ đa dạng và mức độ học thuật của từ vựng (TTR, RTTR, hapax, từ dài, âm tiết)
    counts = Counter(words_lower)
    unique_wc = len(counts)
    ttr = unique_wc / wc_safe
    rttr = unique_wc / math.sqrt(wc_safe)
    hapax_ratio = sum(1 for _, c in counts.items() if c == 1) / wc_safe

    long_6_ratio = sum(1 for l in word_lens if l >= 6) / wc_safe
    long_8_ratio = sum(1 for l in word_lens if l >= 8) / wc_safe
    long_10_ratio = sum(1 for l in word_lens if l >= 10) / wc_safe

    syllables = [_count_syllables(w) for w in words_lower] if words_lower else [0]
    avg_syllables = float(np.mean(syllables))
    polysyllabic_ratio = sum(1 for s in syllables if s >= 3) / wc_safe

    # Nhóm 4: Mức độ lặp từ khóa và lặp cụm n-gram (Content repetition & n-gram repetition)
    content_words = [w for w in words_lower if len(w) >= 3 and w not in _STOPWORDS]
    content_counts = Counter(content_words)
    content_total = max(1, len(content_words))
    top1_content_ratio = (content_counts.most_common(1)[0][1] / content_total) if content_counts else 0.0
    top3_content_ratio = (
        sum(c for _, c in content_counts.most_common(3)) / content_total if content_counts else 0.0
    )

    bigrams = list(zip(words_lower, words_lower[1:]))
    trigrams = list(zip(words_lower, words_lower[1:], words_lower[2:]))
    repeated_bigram_ratio = 1.0 - (len(set(bigrams)) / max(1, len(bigrams))) if bigrams else 0.0
    repeated_trigram_ratio = 1.0 - (len(set(trigrams)) / max(1, len(trigrams))) if trigrams else 0.0
    adjacent_dup_count = len(_DOUBLE_WORD_RE.findall(essay_str))

    # Nhóm 5: Từ nối diễn ngôn theo 4 chức năng tương phản, nhân quả, bổ sung, kết luận
    dm_con_n, dm_con_u = _count_phrases(essay_lower, _DM_CONTRAST)
    dm_cau_n, dm_cau_u = _count_phrases(essay_lower, _DM_CAUSAL)
    dm_add_n, dm_add_u = _count_phrases(essay_lower, _DM_ADDITIVE)
    dm_end_n, dm_end_u = _count_phrases(essay_lower, _DM_CONCLUSION)
    dm_total = dm_con_n + dm_cau_n + dm_add_n + dm_end_n
    dm_unique = dm_con_u + dm_cau_u + dm_add_u + dm_end_u

    # Nhóm 6: Độ đa dạng cấu trúc ngữ pháp (câu phụ thuộc, mệnh đề quan hệ, modal, bị động, lỗi mạo từ)
    sub_n, _ = _count_phrases(essay_lower, _SUBORDINATORS)
    rel_n, _ = _count_phrases(essay_lower, _REL_PRONOUNS)
    mod_n, mod_u = _count_phrases(essay_lower, _MODALS)
    passive_n = len(_PASSIVE_RE.findall(essay_str))
    article_err_n = len(_ARTICLE_VOWEL_ERR_RE.findall(essay_str))

    # Nhóm 7: Độ giao thoa giữa đề bài và bài viết (tín hiệu Task Response & phát hiện lạc đề)
    p_tokens = _content_tokens(prompt_str)
    e_tokens = _content_tokens(essay_str)
    p_set = set(p_tokens)
    e_set = set(e_tokens)

    prompt_word_count = float(len(_WORD_RE.findall(prompt_str)))
    if p_set:
        prompt_content_coverage = len(p_set & e_set) / len(p_set)
        prompt_unigram_jaccard = len(p_set & e_set) / max(1, len(p_set | e_set))
    else:
        prompt_content_coverage = 0.0
        prompt_unigram_jaccard = 0.0

    p_bigrams = set(zip(p_tokens, p_tokens[1:]))
    e_bigrams = set(zip(e_tokens, e_tokens[1:]))
    prompt_bigram_overlap = (
        len(p_bigrams & e_bigrams) / len(p_bigrams) if p_bigrams else prompt_content_coverage
    )

    # Kiểm tra độ bám đề riêng ở đoạn Mở bài và đoạn Kết bài
    intro_text = paragraphs[0] if paragraphs else essay_str[: max(1, len(essay_str) // 4)]
    concl_text = paragraphs[-1] if len(paragraphs) > 1 else essay_str[-max(1, len(essay_str) // 4) :]
    intro_set = set(_content_tokens(intro_text))
    concl_set = set(_content_tokens(concl_text))
    intro_prompt_cov = len(p_set & intro_set) / len(p_set) if p_set else 0.0
    concl_prompt_cov = len(p_set & concl_set) / len(p_set) if p_set else 0.0

    # Chỉ số độ khó đọc Flesch-Kincaid Grade ước lượng mức học thuật câu chữ
    fk_grade = 0.39 * avg_sent_len + 11.8 * avg_syllables - 15.59 if wc > 0 else 0.0

    per_100 = 100.0 / wc_safe
    return {
        "word_count": float(wc),
        "log_word_count": math.log1p(wc),
        "char_count": float(char_count),
        "avg_word_len": avg_word_len,
        "std_word_len": std_word_len,
        "under_100": float(wc < 100),
        "under_150": float(wc < 150),
        "under_200": float(wc < 200),
        "under_250": float(wc < 250),
        "len_ratio_250": min(wc / 250.0, 2.5),
        "sent_count": float(sent_count),
        "avg_sent_len": avg_sent_len,
        "std_sent_len": std_sent_len,
        "min_sent_len": min_sent_len,
        "max_sent_len": max_sent_len,
        "short_sent_ratio": short_sent_ratio,
        "long_sent_ratio": long_sent_ratio,
        "para_count": float(para_count),
        "avg_para_words": wc / max(1, para_count),
        "has_multi_para": float(para_count >= 3),
        "comma_per_word": comma_count / wc_safe,
        "comma_per_sent": comma_count / max(1, sent_count),
        "period_per_word": period_count / wc_safe,
        "semicolon_per_sent": semicolon_count / max(1, sent_count),
        "colon_per_sent": colon_count / max(1, sent_count),
        "excl_per_100": excl_count * per_100,
        "question_per_100": question_count * per_100,
        "quote_per_100": quote_count * per_100,
        "paren_per_100": paren_count * per_100,
        "lowercase_i_per_100": lowercase_i_count * per_100,
        "lowercase_sent_start_ratio": lowercase_sent_start_ratio,
        "missing_end_punct_ratio": missing_end_punct_ratio,
        "digit_per_100": digit_count * per_100,
        "all_caps_ratio": all_caps_words / wc_safe,
        "ttr": ttr,
        "rttr": rttr,
        "hapax_ratio": hapax_ratio,
        "long_6_ratio": long_6_ratio,
        "long_8_ratio": long_8_ratio,
        "long_10_ratio": long_10_ratio,
        "avg_syllables": avg_syllables,
        "polysyllabic_ratio": polysyllabic_ratio,
        "fk_grade": fk_grade,
        "top1_content_ratio": top1_content_ratio,
        "top3_content_ratio": top3_content_ratio,
        "repeated_bigram_ratio": repeated_bigram_ratio,
        "repeated_trigram_ratio": repeated_trigram_ratio,
        "adjacent_dup_per_100": adjacent_dup_count * per_100,
        "dm_contrast_per_100": dm_con_n * per_100,
        "dm_causal_per_100": dm_cau_n * per_100,
        "dm_additive_per_100": dm_add_n * per_100,
        "dm_conclusion_per_100": dm_end_n * per_100,
        "dm_total_per_100": dm_total * per_100,
        "dm_unique_types": float(dm_unique),
        "subordinator_per_100": sub_n * per_100,
        "rel_pronoun_per_100": rel_n * per_100,
        "modal_per_100": mod_n * per_100,
        "modal_unique": float(mod_u),
        "passive_per_100": passive_n * per_100,
        "article_err_per_100": article_err_n * per_100,
        "prompt_word_count": prompt_word_count,
        "prompt_content_coverage": prompt_content_coverage,
        "prompt_unigram_jaccard": prompt_unigram_jaccard,
        "prompt_bigram_overlap": prompt_bigram_overlap,
        "intro_prompt_coverage": intro_prompt_cov,
        "concl_prompt_coverage": concl_prompt_cov,
    }


# Danh sách thứ tự cố định 65 tên đặc trưng bề mặt dùng khi dựng ma trận đặc trưng
FEATURE_NAMES: tuple[str, ...] = tuple(extract_surface_features("Sample topic", "Sample essay text.").keys())


def build_surface_matrix(records: list[dict[str, Any]]) -> np.ndarray:
    """Dựng ma trận đặc trưng bề mặt dày đặc (dense) kích thước (N, len(FEATURE_NAMES))."""
    rows = []
    for rec in records:
        feats = extract_surface_features(rec.get("prompt", ""), rec.get("essay", ""))
        rows.append([feats[k] for k in FEATURE_NAMES])
    return np.asarray(rows, dtype=np.float32)


def compute_prompt_essay_cosine(
    prompt_tfidf: TfidfVectorizer,
    prompts: list[str],
    essays: list[str],
) -> np.ndarray:
    """Tính độ tương đồng cosine TF-IDF từng cặp giữa đề bài (prompt) và bài viết (essay)."""
    p_mat = prompt_tfidf.transform(prompts)
    e_mat = prompt_tfidf.transform(essays)
    # TfidfVectorizer mặc định chuẩn hóa L2 từng hàng nên tích vô hướng chính là cosine similarity
    sim = np.asarray(p_mat.multiply(e_mat).sum(axis=1)).ravel().astype(np.float32)
    return sim


class BaselineScorer:
    """Bộ chấm điểm Baseline đã lưu gồm TF-IDF + đặc trưng bề mặt + Ensemble Ridge & LightGBM."""

    def __init__(
        self,
        word_tfidf: TfidfVectorizer,
        char_tfidf: TfidfVectorizer,
        prompt_tfidf: TfidfVectorizer,
        svd: TruncatedSVD,
        surface_scaler: StandardScaler,
        ridge_models: dict[str, Ridge],
        lgbm_models: dict[str, LGBMRegressor],
        blend_weights: dict[str, float],
        calibrators: dict[str, tuple[float, float]],
        overall_criteria_blend: float = 0.0,
    ) -> None:
        self.word_tfidf = word_tfidf
        self.char_tfidf = char_tfidf
        self.prompt_tfidf = prompt_tfidf
        self.svd = svd
        self.surface_scaler = surface_scaler
        self.ridge_models = ridge_models
        self.lgbm_models = lgbm_models
        self.blend_weights = blend_weights
        self.calibrators = calibrators
        self.overall_criteria_blend = overall_criteria_blend

    def _transform_inputs(
        self, records: list[dict[str, Any]]
    ) -> tuple[csr_matrix, np.ndarray, np.ndarray]:
        """Biến đổi danh sách bài viết thành ma trận đầu vào cho Ridge (sparse + 0.25*dense) và LightGBM (dense + SVD)."""
        prompts = [str(r.get("prompt") or "") for r in records]
        essays = [str(r.get("essay") or "") for r in records]
        w_mat = self.word_tfidf.transform(essays)
        c_mat = self.char_tfidf.transform(essays)
        surf_raw = build_surface_matrix(records)
        cos_sim = compute_prompt_essay_cosine(self.prompt_tfidf, prompts, essays).reshape(-1, 1)
        dense_raw = np.hstack([surf_raw, cos_sim]).astype(np.float32)
        dense_scaled = self.surface_scaler.transform(dense_raw).astype(np.float32)
        text_sparse = hstack([w_mat, c_mat]).tocsr()
        svd_feats = self.svd.transform(text_sparse).astype(np.float32)
        ridge_design = hstack([text_sparse, csr_matrix(dense_scaled * 0.25)]).tocsr()
        return ridge_design, dense_scaled, svd_feats

    def predict_batch(self, records: list[dict[str, Any]]) -> list[dict[str, float]]:
        """Dự đoán hàng loạt cho 5 đầu điểm (overall + 4 sub-criteria), pha trộn Ridge/LightGBM và hiệu chỉnh tuyến tính."""
        if not records:
            return []
        ridge_design, dense_scaled, svd_feats = self._transform_inputs(records)

        raw_preds: dict[str, np.ndarray] = {}
        for target in TARGETS:
            if target not in self.ridge_models and target not in self.lgbm_models:
                continue
            r_pred = (
                self.ridge_models[target].predict(ridge_design)
                if target in self.ridge_models
                else None
            )
            # LightGBM nhận đầu vào xếp chồng (stacking): đặc trưng bề mặt chuẩn hóa + SVD 80 chiều + dự đoán từ Ridge
            if target in self.lgbm_models:
                lgb_x = np.hstack(
                    [
                        dense_scaled,
                        svd_feats,
                        (r_pred.reshape(-1, 1) if r_pred is not None else np.zeros((len(records), 1))),
                    ]
                )
                l_pred = self.lgbm_models[target].predict(lgb_x)
            else:
                l_pred = r_pred

            # Trộn có trọng số giữa LightGBM (w) và Ridge (1 - w)
            if r_pred is not None and l_pred is not None:
                w = float(self.blend_weights.get(target, 0.6))
                pred = w * l_pred + (1.0 - w) * r_pred
            else:
                pred = l_pred if l_pred is not None else r_pred

            # Hiệu chỉnh tuyến tính (slope * pred + intercept) và chặn trong [1.0, 9.0]
            slope, intercept = self.calibrators.get(target, (1.0, 0.0))
            pred = np.clip(slope * pred + intercept, 1.0, 9.0)
            raw_preds[target] = pred

        # Tùy chọn đồng bộ điểm Overall với trung bình cộng 4 tiêu chí con theo hệ số alpha
        if (
            self.overall_criteria_blend > 0.0
            and "overall_band" in raw_preds
            and all(k in raw_preds for k in SUBCRITERIA_KEYS)
        ):
            crit_mean = np.mean([raw_preds[k] for k in SUBCRITERIA_KEYS], axis=0)
            alpha = self.overall_criteria_blend
            raw_preds["overall_band"] = np.clip(
                (1.0 - alpha) * raw_preds["overall_band"] + alpha * crit_mean, 1.0, 9.0
            )

        out: list[dict[str, float]] = []
        for i in range(len(records)):
            row: dict[str, float] = {}
            for target, arr in raw_preds.items():
                val = float(arr[i])
                row[f"{target}_raw"] = round(val, 4)
                row[target] = float(round_to_half_band(val))
            out.append(row)
        return out


def load_baseline_bundle(bundle_path: str | Path) -> BaselineScorer:
    """Nạp tệp `baseline_bundle.joblib` an toàn kể cả khi được pickle dưới tên `__main__.BaselineScorer`."""
    import sys

    main_mod = sys.modules.get("__main__")
    restore = False
    if main_mod is not None and not hasattr(main_mod, "BaselineScorer"):
        setattr(main_mod, "BaselineScorer", BaselineScorer)
        restore = True
    try:
        obj = joblib.load(bundle_path)
    finally:
        if restore and main_mod is not None and hasattr(main_mod, "BaselineScorer"):
            delattr(main_mod, "BaselineScorer")
    return obj


def _fit_ridge_oof(
    X_sparse: csr_matrix,
    y: np.ndarray,
    groups: np.ndarray | None,
    alpha: float,
) -> tuple[Ridge, np.ndarray]:
    """Huấn luyện mô hình Ridge toàn tập và tạo dự đoán Out-of-Fold (OOF) 5-fold theo GroupKFold/KFold chống rò rỉ cho tầng LightGBM."""
    n = len(y)
    oof = np.zeros(n, dtype=np.float32)
    if groups is not None and len(np.unique(groups)) >= 5:
        splitter = GroupKFold(n_splits=5)
        splits = splitter.split(X_sparse, y, groups)
    else:
        splitter = KFold(n_splits=5, shuffle=True, random_state=42)
        splits = splitter.split(X_sparse, y)

    for tr_idx, va_idx in splits:
        m = Ridge(alpha=alpha, solver="lsqr", tol=1e-4)
        m.fit(X_sparse[tr_idx], y[tr_idx])
        oof[va_idx] = m.predict(X_sparse[va_idx])

    full_model = Ridge(alpha=alpha, solver="lsqr", tol=1e-4)
    full_model.fit(X_sparse, y)
    return full_model, oof


def _fit_best_ridge_alpha(
    X_tr: csr_matrix,
    y_tr: np.ndarray,
    X_va: csr_matrix,
    y_va: np.ndarray,
    alphas: tuple[float, ...] = (3.0, 8.0, 20.0, 50.0, 100.0),
) -> tuple[float, np.ndarray]:
    """Tìm hệ số điều chuẩn alpha tối ưu cho hồi quy Ridge theo MSE trên tập validation."""
    best_alpha = alphas[0]
    best_mse = float("inf")
    best_val_pred = np.zeros(len(y_va), dtype=np.float32)
    for a in alphas:
        m = Ridge(alpha=a, solver="lsqr", tol=1e-4)
        m.fit(X_tr, y_tr)
        pred = m.predict(X_va)
        mse = float(np.mean((y_va - pred) ** 2))
        if mse < best_mse:
            best_mse = mse
            best_alpha = a
            best_val_pred = pred
    return best_alpha, best_val_pred


def _fit_linear_calibrator(y_true: np.ndarray, y_pred: np.ndarray) -> tuple[float, float]:
    """Khớp bộ hiệu chỉnh tuyến tính có chặn biên (slope, intercept) trên tập validation nếu giúp giảm MAE."""
    if len(y_true) < 20 or np.std(y_pred) < 1e-6:
        return (1.0, 0.0)
    slope, intercept = np.polyfit(y_pred, y_true, deg=1)
    # Giới hạn hệ số góc và hệ số chặn để tránh ngoại suy quá mức ở hai đầu thang điểm
    slope = float(np.clip(slope, 0.75, 1.35))
    intercept = float(np.clip(intercept, -1.5, 1.5))
    cal_pred = np.clip(slope * y_pred + intercept, 1.0, 9.0)
    base_mae = float(np.mean(np.abs(y_true - y_pred)))
    cal_mae = float(np.mean(np.abs(y_true - cal_pred)))
    if cal_mae < base_mae - 1e-4:
        return (slope, intercept)
    return (1.0, 0.0)


def train_baseline(
    data_dir: Path,
    out_dir: Path,
    max_word_features: int = 30000,
    max_char_features: int = 30000,
    svd_components: int = 80,
) -> dict[str, Any]:
    """Quy trình huấn luyện đầy đủ mô hình Baseline: trích TF-IDF/SVD/bề mặt, train Ridge + LightGBM, hiệu chỉnh trên val và xuất `baseline_bundle.joblib`."""
    t0 = time.time()
    train_recs = load_jsonl(data_dir / "train.jsonl")
    val_recs = load_jsonl(data_dir / "val.jsonl")
    test_recs = load_jsonl(data_dir / "test.jsonl")
    print(f"Loaded train={len(train_recs)}, val={len(val_recs)}, test={len(test_recs)}")

    tr_prompts = [str(r.get("prompt") or "") for r in train_recs]
    tr_essays = [str(r.get("essay") or "") for r in train_recs]
    va_prompts = [str(r.get("prompt") or "") for r in val_recs]
    va_essays = [str(r.get("essay") or "") for r in val_recs]

    print("Fitting TF-IDF + SVD + surface features on train split only...")
    # Chỉ fit các bộ biến đổi TF-IDF, SVD và StandardScaler trên tập train để tránh rò rỉ dữ liệu val/test
    word_tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=max_word_features,
        min_df=3,
        sublinear_tf=True,
        strip_accents="unicode",
    )
    char_tfidf = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        max_features=max_char_features,
        min_df=5,
        sublinear_tf=True,
    )
    prompt_tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=12000,
        min_df=2,
        sublinear_tf=True,
        stop_words="english",
    )

    tr_w = word_tfidf.fit_transform(tr_essays)
    tr_c = char_tfidf.fit_transform(tr_essays)
    prompt_tfidf.fit(tr_prompts + tr_essays)

    va_w = word_tfidf.transform(va_essays)
    va_c = char_tfidf.transform(va_essays)

    tr_text_sparse = hstack([tr_w, tr_c]).tocsr()
    va_text_sparse = hstack([va_w, va_c]).tocsr()

    # Giảm chiều ma trận TF-IDF từ+ký tự xuống 80 thành phần chính cho cây quyết định LightGBM
    svd = TruncatedSVD(n_components=svd_components, random_state=42)
    tr_svd = svd.fit_transform(tr_text_sparse).astype(np.float32)
    va_svd = svd.transform(va_text_sparse).astype(np.float32)

    # Ghép 65 đặc trưng bề mặt với 1 cột TF-IDF cosine đề-bài rồi chuẩn hóa Z-score
    tr_surf = build_surface_matrix(train_recs)
    va_surf = build_surface_matrix(val_recs)
    tr_cos = compute_prompt_essay_cosine(prompt_tfidf, tr_prompts, tr_essays).reshape(-1, 1)
    va_cos = compute_prompt_essay_cosine(prompt_tfidf, va_prompts, va_essays).reshape(-1, 1)

    tr_dense_raw = np.hstack([tr_surf, tr_cos]).astype(np.float32)
    va_dense_raw = np.hstack([va_surf, va_cos]).astype(np.float32)
    surface_scaler = StandardScaler()
    tr_dense = surface_scaler.fit_transform(tr_dense_raw).astype(np.float32)
    va_dense = surface_scaler.transform(va_dense_raw).astype(np.float32)

    tr_ridge_X = hstack([tr_text_sparse, csr_matrix(tr_dense * 0.25)]).tocsr()
    va_ridge_X = hstack([va_text_sparse, csr_matrix(va_dense * 0.25)]).tocsr()

    # Nhóm theo nội dung đề bài để chạy OOF Ridge 5-fold trong tập train mà không bị rò rỉ giữa các bài cùng đề
    prompt_groups = np.asarray(
        [re.sub(r"\W+", " ", p.lower()).strip()[:120] for p in tr_prompts]
    )

    ridge_models: dict[str, Ridge] = {}
    lgbm_models: dict[str, LGBMRegressor] = {}
    blend_weights: dict[str, float] = {}
    calibrators: dict[str, tuple[float, float]] = {}

    val_pred_per_target: dict[str, np.ndarray] = {}

    # Huấn luyện lần lượt bộ Ridge + LightGBM độc lập cho từng đầu điểm trong TARGETS
    for target in TARGETS:
        tr_idx = [i for i, r in enumerate(train_recs) if r.get(target) is not None]
        va_idx = [i for i, r in enumerate(val_recs) if r.get(target) is not None]
        if len(tr_idx) < 50 or len(va_idx) < 20:
            print(f"Skipping {target}: insufficient labeled rows (train={len(tr_idx)}, val={len(va_idx)})")
            continue

        y_tr = np.asarray([float(train_recs[i][target]) for i in tr_idx], dtype=np.float32)
        y_va = np.asarray([float(val_recs[i][target]) for i in va_idx], dtype=np.float32)

        # Tầng 1: Chọn alpha tối ưu và tạo đặc trưng dự đoán OOF từ Ridge
        best_alpha, va_ridge_pred = _fit_best_ridge_alpha(
            tr_ridge_X[tr_idx], y_tr, va_ridge_X[va_idx], y_va
        )
        ridge_model, tr_ridge_oof = _fit_ridge_oof(
            tr_ridge_X[tr_idx], y_tr, prompt_groups[tr_idx], alpha=best_alpha
        )
        ridge_models[target] = ridge_model

        # Tính dự đoán của mô hình Ridge toàn tập trên validation (khớp hoàn toàn với đường suy luận thật)
        va_ridge_pred_full = ridge_model.predict(va_ridge_X[va_idx])

        # Tầng 2: Huấn luyện LightGBM trên (đặc trưng bề mặt + SVD + đầu ra Ridge OOF) có early stopping trên val
        tr_lgb_X = np.hstack([tr_dense[tr_idx], tr_svd[tr_idx], tr_ridge_oof.reshape(-1, 1)])
        va_lgb_X = np.hstack([va_dense[va_idx], va_svd[va_idx], va_ridge_pred_full.reshape(-1, 1)])

        lgb = LGBMRegressor(
            n_estimators=1800,
            learning_rate=0.03,
            num_leaves=31,
            max_depth=-1,
            min_child_samples=25,
            subsample=0.8,
            subsample_freq=1,
            colsample_bytree=0.75,
            reg_alpha=0.5,
            reg_lambda=2.0,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        lgb.fit(
            tr_lgb_X,
            y_tr,
            eval_set=[(va_lgb_X, y_va)],
            eval_metric="l2",
            callbacks=[early_stopping(stopping_rounds=75, verbose=False), log_evaluation(0)],
        )
        lgbm_models[target] = lgb
        va_lgb_pred = lgb.predict(va_lgb_X)

        # Dò trọng số pha trộn tối ưu w giữa LightGBM và Ridge theo lưới bước 0.05 trên tập validation
        best_w = 0.6
        best_loss = float("inf")
        for w in np.linspace(0.0, 1.0, 21):
            p = w * va_lgb_pred + (1.0 - w) * va_ridge_pred_full
            loss = float(np.mean((y_va - p) ** 2))
            if loss < best_loss:
                best_loss = loss
                best_w = float(round(w, 2))

        blend_weights[target] = best_w
        va_blend = np.clip(best_w * va_lgb_pred + (1.0 - best_w) * va_ridge_pred_full, 1.0, 9.0)
        cal = _fit_linear_calibrator(y_va, va_blend)
        calibrators[target] = cal
        va_cal = np.clip(cal[0] * va_blend + cal[1], 1.0, 9.0)

        r_mae = float(np.mean(np.abs(y_va - va_ridge_pred_full)))
        l_mae = float(np.mean(np.abs(y_va - va_lgb_pred)))
        b_mae = float(np.mean(np.abs(y_va - va_cal)))
        print(
            f"[{target}] alpha={best_alpha} | val MAE: ridge={r_mae:.4f}, lgb={l_mae:.4f}, "
            f"blend(w={best_w:.2f})={b_mae:.4f}, cal={cal}"
        )

        # Lưu dự đoán validation của từng tiêu chí để kiểm tra độ nhất quán với điểm tổng thể
        if target == "overall_band":
            val_pred_per_target[target] = va_cal
        else:
            # Suy luận trên toàn bộ tập val (kể cả mẫu thiếu nhãn tiêu chí con) phục vụ trộn đồng nhất
            all_va_r = ridge_model.predict(va_ridge_X)
            all_va_l = lgb.predict(np.hstack([va_dense, va_svd, all_va_r.reshape(-1, 1)]))
            all_va_b = np.clip(best_w * all_va_l + (1.0 - best_w) * all_va_r, 1.0, 9.0)
            val_pred_per_target[target] = np.clip(cal[0] * all_va_b + cal[1], 1.0, 9.0)

    # Dò hệ số pha trộn alpha giữa overall_band và trung bình cộng 4 tiêu chí con trên tập val
    best_crit_blend = 0.0
    if "overall_band" in val_pred_per_target and all(k in val_pred_per_target for k in SUBCRITERIA_KEYS):
        y_va_all = np.asarray([float(r["overall_band"]) for r in val_recs], dtype=np.float32)
        crit_mean_va = np.mean([val_pred_per_target[k] for k in SUBCRITERIA_KEYS], axis=0)
        best_mse = float(np.mean((y_va_all - val_pred_per_target["overall_band"]) ** 2))
        for alpha in (0.0, 0.1, 0.2, 0.3):
            cand = np.clip(
                (1.0 - alpha) * val_pred_per_target["overall_band"] + alpha * crit_mean_va,
                1.0,
                9.0,
            )
            mse = float(np.mean((y_va_all - cand) ** 2))
            if mse < best_mse - 1e-5:
                best_mse = mse
                best_crit_blend = alpha
    print(f"Optimal overall-criteria consistency blend on val: {best_crit_blend}")

    # Đóng gói toàn bộ pipeline đã huấn luyện thành đối tượng BaselineScorer và xuất ra baseline_bundle.joblib
    scorer = BaselineScorer(
        word_tfidf=word_tfidf,
        char_tfidf=char_tfidf,
        prompt_tfidf=prompt_tfidf,
        svd=svd,
        surface_scaler=surface_scaler,
        ridge_models=ridge_models,
        lgbm_models=lgbm_models,
        blend_weights=blend_weights,
        calibrators=calibrators,
        overall_criteria_blend=best_crit_blend,
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    bundle_path = out_dir / "baseline_bundle.joblib"
    # Ép tên module thành 'train_baseline.BaselineScorer' khi pickle để infer.py unpickle không bị lỗi __main__
    BaselineScorer.__module__ = "train_baseline"
    scorer.__class__.__module__ = "train_baseline"
    joblib.dump(scorer, bundle_path, compress=3)

    val_preds = scorer.predict_batch(val_recs)
    test_preds = scorer.predict_batch(test_recs)
    val_report = evaluate_predictions(val_recs, val_preds)
    test_report = evaluate_predictions(test_recs, test_preds)

    print_evaluation_summary("baseline/val", val_report)
    print_evaluation_summary("baseline/test", test_report)

    elapsed = round(time.time() - t0, 2)
    meta = {
        "model_type": "baseline_ridge_lgbm_ensemble",
        "train_seconds": elapsed,
        "train_rows": len(train_recs),
        "val_rows": len(val_recs),
        "test_rows": len(test_recs),
        "num_surface_features": len(FEATURE_NAMES) + 1,
        "svd_components": svd_components,
        "blend_weights": blend_weights,
        "calibrators": {k: list(v) for k, v in calibrators.items()},
        "overall_criteria_blend": best_crit_blend,
        "val": val_report,
        "test": test_report,
    }
    (out_dir / "metrics.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # Chỉ khởi tạo best_manifest.json nếu chưa tồn tại (tránh ghi đè kết quả Transformer/Hybrid nếu đã train trước)
    manifest_path = out_dir.parent / "best_manifest.json"
    if not manifest_path.exists():
        manifest = {
            "selected_model": "baseline",
            "val_qwk": val_report["overall"]["qwk"],
            "val_mae": val_report["overall"]["mae"],
            "baseline_dir": str(out_dir),
        }
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\nSaved baseline model to {bundle_path} in {elapsed:.1f}s")
    return meta


def main() -> None:
    """Điểm vào CLI để huấn luyện và xuất mô hình Baseline."""
    base_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Train baseline IELTS Writing Task 2 scorer.")
    parser.add_argument("--data-dir", type=str, default=str(base_dir / "data"))
    parser.add_argument("--out-dir", type=str, default=str(base_dir / "models" / "baseline"))
    parser.add_argument("--max-word-features", type=int, default=30000)
    parser.add_argument("--max-char-features", type=int, default=30000)
    parser.add_argument("--svd-components", type=int, default=80)
    args = parser.parse_args()

    train_baseline(
        data_dir=Path(args.data_dir),
        out_dir=Path(args.out_dir),
        max_word_features=args.max_word_features,
        max_char_features=args.max_char_features,
        svd_components=args.svd_components,
    )


if __name__ == "__main__":
    main()
