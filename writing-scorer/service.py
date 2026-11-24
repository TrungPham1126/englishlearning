"""Dịch vụ microservice FastAPI chấm điểm IELTS & Academic Writing cục bộ và sinh phản hồi sư phạm tiếng Việt ngoại tuyến.

Hỗ trợ phân loại và chấm 3 nhóm bài viết (`TASK_1`, `TASK_2`, `PARAGRAPH`), bọc mô hình
`WritingScorer` qua endpoint `POST /api/v1/writing/evaluate` và chuẩn hóa JSON đầu ra
tương thích với dịch vụ Spring Boot (`PythonIntegrationService`).
"""

from __future__ import annotations

import argparse
from collections import Counter
from contextlib import asynccontextmanager
from dataclasses import dataclass
import logging
import math
import os
from pathlib import Path
import re
import sys
import threading
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.concurrency import run_in_threadpool

# Cấu hình ghi log có cấu trúc thống nhất với quy ước của phonetics-service
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("writing-scorer")

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = BASE_DIR / "models"
DEFAULT_PORT = 8001
MAX_ESSAY_CHARS = 30000
# 3 nhóm dạng bài viết được service hỗ trợ chấm điểm
SUPPORTED_WRITING_TASKS: tuple[str, ...] = ("TASK_2", "TASK_1", "PARAGRAPH")

# Tập bí danh chuẩn hóa đầu vào về TASK_1 (IELTS Writing Task 1: biểu đồ, quy trình, bản đồ)
_TASK_1_ALIASES = frozenset(
    {
        "TASK_1",
        "TASK1",
        "WRITING_IELTS_TASK1",
        "WRITING_IELTS_TASK_1",
        "IELTS_TASK_1",
        "IELTS_TASK1",
        "IELTS_WRITING_TASK_1",
        "IELTS_WRITING_TASK1",
        "WRITING_TASK_1",
        "WRITING_TASK1",
        "TASK_1_ACADEMIC",
        "TASK1_DATA",
        "TASK1_PROCESS",
        "TASK1_MAP",
    }
)
# Tập bí danh chuẩn hóa đầu vào về TASK_2 (bài luận IELTS Task 2 / Discursive Essay)
_TASK_2_ALIASES = frozenset(
    {
        "TASK_2",
        "TASK2",
        "WRITING_IELTS_TASK2",
        "WRITING_IELTS_TASK_2",
        "IELTS_TASK_2",
        "IELTS_TASK2",
        "IELTS_WRITING_TASK_2",
        "IELTS_WRITING_TASK2",
        "WRITING_TASK_2",
        "WRITING_TASK2",
        "ESSAY",
        "WRITING_ESSAY",
        "WRITING_DISCURSIVE_ESSAY",
        "DISCURSIVE_ESSAY",
        "DISCURSIVE_ACADEMIC_ESSAY",
        "TASK2_OPINION",
        "TASK2_DISCUSSION",
        "TASK2_ADV_DISADV",
        "TASK2_PROBLEM_SOLUTION",
        "TASK2_TWO_PART",
        "TASK2_DISCURSIVE_C1",
    }
)
# Tập bí danh chuẩn hóa đầu vào về PARAGRAPH (đoạn văn ngắn, email, đoạn văn có hướng dẫn)
_PARAGRAPH_ALIASES = frozenset(
    {
        "PARAGRAPH",
        "WRITING_PARAGRAPH",
        "WRITING_DESCRIPTIVE_PARAGRAPH",
        "DESCRIPTIVE_PARAGRAPH",
        "WRITING_SHORT_EMAIL",
        "SHORT_EMAIL",
        "WRITING_EMAIL",
        "EMAIL",
        "WRITING_OPINION",
        "WRITING_ADV_DISADV",
        "WRITING_CAUSE_EFFECT",
        "WRITING_PROBLEM_SOLUTION",
        "WRITING_SENTENCE",
        "WRITING_WORD_ARRANGEMENT",
        "WRITING_KEYWORD",
        "SENTENCE",
        "SHORT_PARAGRAPH",
        "PARAGRAPH_WRITING",
        "PARAGRAPH_DESCRIPTIVE",
        "PARAGRAPH_EMAIL",
        "PARAGRAPH_OPINION",
        "PARAGRAPH_ADV_DISADV",
        "PARAGRAPH_CAUSE_EFFECT",
        "PARAGRAPH_PROBLEM_SOLUTION",
        "PARAGRAPH_GUIDED",
    }
)

# Hư từ tiếng Anh và các từ đề bài chung loại trừ khi trích xuất từ khóa nội dung
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
        "extent", "opinion", "essay", "discuss", "views", "give", "reasons",
        "include", "relevant", "examples", "knowledge", "experience", "write", "least",
        "words", "some", "advantages", "disadvantages", "causes", "solutions", "problem",
    }
)

# Các cụm từ nối, kết luận, liên từ phụ thuộc và tín hiệu riêng cho Task 1 / Email
_DISCOURSE_MARKERS = (
    "however", "nevertheless", "nonetheless", "although", "even though", "whereas",
    "on the other hand", "in contrast", "despite", "in spite of", "therefore",
    "consequently", "thus", "hence", "as a result", "furthermore", "moreover",
    "additionally", "in addition", "for instance", "for example", "specifically",
    "in conclusion", "to conclude", "to summarize", "to sum up", "overall",
)

_CONCLUSION_MARKERS = (
    "in conclusion", "to conclude", "to summarize", "to sum up", "in summary",
    "overall", "all in all", "ultimately",
)

_SUBORDINATORS = (
    "because", "although", "though", "since", "while", "whereas", "unless",
    "if", "provided", "whenever", "wherever", "even if", "so that", "which", "who",
)

_OVERVIEW_MARKERS = (
    "overall", "in general", "broadly speaking", "at first glance",
    "it is clear that", "it is evident that", "in overview",
    "generally speaking", "the most noticeable", "the main trend",
    "overall trend", "key feature", "key features",
)

_SEQUENCE_MARKERS = (
    "first", "firstly", "initially", "to begin with", "next", "then",
    "subsequently", "afterwards", "after that", "following this", "finally",
    "in the final stage", "stage", "phase", "step",
)

_SPATIAL_MARKERS = (
    "north", "south", "east", "west", "northeast", "northwest",
    "southeast", "southwest", "located", "situated", "replaced", "converted",
    "demolished", "constructed", "expanded", "removed", "adjacent", "opposite",
    "corner", "center", "centre", "redeveloped", "transformed",
)

# Biểu thức chính quy kiểm tra số liệu/xu hướng Task 1, lời chào/kết Email, khung số từ và phát hiện tiếng Việt
_DATA_TREND_RE = re.compile(
    r"(?:\b\d+(?:[.,]\d+)?%?\b|\b(?:increased|decreased|rose|fell|dropped|peaked|fluctuated|remained|surged|declined|grew|accounted\s+for|respectively)\b)",
    re.IGNORECASE,
)
_EMAIL_GREETING_RE = re.compile(r"^\s*(?:dear|hi|hello|hey)\b", re.IGNORECASE | re.MULTILINE)
_EMAIL_SIGNOFF_RE = re.compile(
    r"\b(?:best regards|kind regards|regards|sincerely|best wishes|warm wishes|see you|talk soon|yours truly|yours faithfully|cheers|love)\b",
    re.IGNORECASE,
)
_EXPLICIT_RANGE_RE = re.compile(
    r"(?:write\s+(?:between\s+)?)?(\d{2,3})\s*(?:[-–~]+|to|and)\s*(\d{2,3})\s*(?:words?|từ)\b",
    re.IGNORECASE,
)
_AT_LEAST_WORDS_RE = re.compile(
    r"(?:at\s+least|minimum(?:\s+of)?|tối\s+thiểu)\s*(\d{2,3})\s*(?:words?|từ)\b",
    re.IGNORECASE,
)

_VIETNAMESE_DIACRITIC_RE = re.compile(
    r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
    r"ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]"
)
_WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")

# Bộ luật chính quy phát hiện lỗi mạo từ, đại từ 'i', lặp từ liền kề, khoảng trắng và chia số nhiều
_ARTICLE_A_BEFORE_VOWEL_RE = re.compile(
    r"\b(a)\s+(?!(?:university|universities|uniform|uniforms|unique|useful|usual|usually|unit|units|union|unions|european|one|once|utensil|utensils|eulogy|uk|usa|user|users|ubiquitous)\b)([aeiou][a-z]{2,})\b",
    re.IGNORECASE,
)
_ARTICLE_AN_BEFORE_CONSONANT_RE = re.compile(
    r"\b(an)\s+(?!(?:hour|hours|hourly|honest|honestly|honesty|honor|honour|honors|honours|honorary|heir|heirs|heiress|herb|herbs)\b)([bcdfghjklmnpqrstvwxyz][a-z]{2,})\b"
)
_LOWERCASE_I_RE = re.compile(r"(?<![A-Za-z'])i(?![A-Za-z'])")
_ADJ_DUP_RE = re.compile(r"\b([A-Za-z]{2,})\s+\1\b", re.IGNORECASE)
_SPACE_AFTER_PUNCT_RE = re.compile(r"([,;:])([A-Za-z])")
_THERE_IS_PLURAL_RE = re.compile(
    r"\b(there\s+(?:is|was))\s+((?:many|several|numerous|various|multiple|few|two|three|four|five)\s+[a-z]{3,}s)\b",
    re.IGNORECASE,
)
_ONE_OF_SINGULAR_RE = re.compile(
    r"\b(one\s+of\s+the\s+(?:[a-z]+\s+){0,2}?)(reason|problem|issue|factor|benefit|advantage|disadvantage|solution|cause|effect|challenge|way)(?=\s+(?:is|are|was|were|that|which|why|for|in|of|to)\b|[.,;])",
    re.IGNORECASE,
)
_SENT_ABBREV_RE = re.compile(r"(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof)\.$", re.IGNORECASE)

# Từ điển bắt lỗi chính tả và hình thức học thuật độ chính xác cao: từ sai -> (từ sửa, loại lỗi, giải thích tiếng Việt)
_TYPO_CORRECTIONS: dict[str, tuple[str, str, str]] = {
    "recieve": ("receive", "spelling", "Lỗi chính tả: quy tắc 'i trước e ngoại trừ sau c' -> viết đúng là 'receive'."),
    "beleive": ("believe", "spelling", "Lỗi chính tả: viết đúng là 'believe'."),
    "acheive": ("achieve", "spelling", "Lỗi chính tả: viết đúng là 'achieve'."),
    "enviroment": ("environment", "spelling", "Lỗi chính tả: thiếu chữ 'n' trước 'm' -> viết đúng là 'environment'."),
    "goverment": ("government", "spelling", "Lỗi chính tả: thiếu chữ 'n' giữa từ -> viết đúng là 'government'."),
    "tecnology": ("technology", "spelling", "Lỗi chính tả: viết đúng là 'technology'."),
    "techonology": ("technology", "spelling", "Lỗi chính tả: viết đúng là 'technology'."),
    "beacuse": ("because", "spelling", "Lỗi chính tả: viết đúng là 'because'."),
    "becuase": ("because", "spelling", "Lỗi chính tả: viết đúng là 'because'."),
    "definately": ("definitely", "spelling", "Lỗi chính tả: viết đúng là 'definitely' (gốc từ 'finite')."),
    "seperate": ("separate", "spelling", "Lỗi chính tả: dùng 'a' sau 'p' -> viết đúng là 'separate'."),
    "occured": ("occurred", "spelling", "Lỗi chính tả: gấp đôi phụ âm 'r' trước '-ed' -> 'occurred'."),
    "untill": ("until", "spelling", "Lỗi chính tả: 'until' chỉ có một chữ 'l' ở cuối."),
    "wich": ("which", "spelling", "Lỗi chính tả: viết đúng là 'which'."),
    "thier": ("their", "spelling", "Lỗi chính tả: viết đúng là 'their'."),
    "improtant": ("important", "spelling", "Lỗi chính tả: viết đúng là 'important'."),
    "develope": ("develop", "spelling", "Lỗi chính tả: động từ 'develop' không có chữ 'e' ở cuối."),
    "developement": ("development", "spelling", "Lỗi chính tả: viết đúng là 'development' (không có 'e' trước '-ment')."),
    "knowlege": ("knowledge", "spelling", "Lỗi chính tả: thiếu chữ 'd' -> viết đúng là 'knowledge'."),
    "necesary": ("necessary", "spelling", "Lỗi chính tả: một chữ 'c' và hai chữ 's' -> 'necessary'."),
    "neccessary": ("necessary", "spelling", "Lỗi chính tả: một chữ 'c' và hai chữ 's' -> 'necessary'."),
    "opportinity": ("opportunity", "spelling", "Lỗi chính tả: viết đúng là 'opportunity'."),
    "oppotunity": ("opportunity", "spelling", "Lỗi chính tả: thiếu chữ 'r' -> viết đúng là 'opportunity'."),
    "pollusion": ("pollution", "spelling", "Lỗi chính tả: viết đúng là 'pollution'."),
    "benifit": ("benefit", "spelling", "Lỗi chính tả: viết đúng là 'benefit'."),
    "benificial": ("beneficial", "spelling", "Lỗi chính tả: viết đúng là 'beneficial'."),
    "diffrent": ("different", "spelling", "Lỗi chính tả: viết đúng là 'different'."),
    "expereince": ("experience", "spelling", "Lỗi chính tả: viết đúng là 'experience'."),
    "experiance": ("experience", "spelling", "Lỗi chính tả: viết đúng là 'experience'."),
    "freind": ("friend", "spelling", "Lỗi chính tả: viết đúng là 'friend'."),
    "independant": ("independent", "spelling", "Lỗi chính tả: dùng '-ent' ở cuối -> 'independent'."),
    "langauge": ("language", "spelling", "Lỗi chính tả: viết đúng là 'language'."),
    "languge": ("language", "spelling", "Lỗi chính tả: viết đúng là 'language'."),
    "maintenence": ("maintenance", "spelling", "Lỗi chính tả: viết đúng là 'maintenance'."),
    "nowdays": ("nowadays", "spelling", "Lỗi chính tả: viết đúng là 'nowadays'."),
    "nowaday": ("nowadays", "spelling", "Lỗi chính tả: trạng từ chuẩn là 'nowadays' (có '-s')."),
    "persue": ("pursue", "spelling", "Lỗi chính tả: viết đúng là 'pursue'."),
    "posible": ("possible", "spelling", "Lỗi chính tả: gấp đôi chữ 's' -> 'possible'."),
    "probabaly": ("probably", "spelling", "Lỗi chính tả: viết đúng là 'probably'."),
    "realy": ("really", "spelling", "Lỗi chính tả: gấp đôi chữ 'l' -> 'really'."),
    "resposibility": ("responsibility", "spelling", "Lỗi chính tả: viết đúng là 'responsibility'."),
    "responsability": ("responsibility", "spelling", "Lỗi chính tả: dùng '-ibility' -> 'responsibility'."),
    "soceity": ("society", "spelling", "Lỗi chính tả: viết đúng là 'society'."),
    "socitey": ("society", "spelling", "Lỗi chính tả: viết đúng là 'society'."),
    "studing": ("studying", "spelling", "Lỗi chính tả: giữ 'y' trước '-ing' -> 'studying'."),
    "succesful": ("successful", "spelling", "Lỗi chính tả: gấp đôi 'c' và 's' -> 'successful'."),
    "sucessful": ("successful", "spelling", "Lỗi chính tả: gấp đôi 'c' và 's' -> 'successful'."),
    "tommorow": ("tomorrow", "spelling", "Lỗi chính tả: một chữ 'm' và hai chữ 'r' -> 'tomorrow'."),
    "traditonal": ("traditional", "spelling", "Lỗi chính tả: viết đúng là 'traditional'."),
    "unfortunatly": ("unfortunately", "spelling", "Lỗi chính tả: giữ 'e' trước '-ly' -> 'unfortunately'."),
    "wether": ("whether", "spelling", "Lỗi chính tả: liên từ lựa chọn viết là 'whether'."),
    "alot": ("a lot", "spelling", "'alot' không phải từ chuẩn; tách thành hai từ 'a lot' (hoặc dùng 'many/much' trong văn học thuật)."),
    "informations": ("information", "grammar", "Danh từ không đếm được 'information' không chia số nhiều thêm '-s'."),
    "advices": ("advice", "grammar", "Danh từ không đếm được 'advice' không chia số nhiều thêm '-s'."),
    "knowledges": ("knowledge", "grammar", "Danh từ không đếm được 'knowledge' không chia số nhiều thêm '-s'."),
    "equipments": ("equipment", "grammar", "Danh từ không đếm được 'equipment' không chia số nhiều thêm '-s'."),
    "homeworks": ("homework", "grammar", "Danh từ không đếm được 'homework' không chia số nhiều thêm '-s'."),
    "furnitures": ("furniture", "grammar", "Danh từ không đếm được 'furniture' không chia số nhiều thêm '-s'."),
    "researches": ("research", "grammar", "Danh từ 'research' thường dùng ở dạng không đếm được trong văn học thuật."),
    "cant": ("cannot", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'cannot'."),
    "dont": ("do not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'do not'."),
    "wont": ("will not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'will not'."),
    "doesnt": ("does not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'does not'."),
    "didnt": ("did not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'did not'."),
    "isnt": ("is not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'is not'."),
    "arent": ("are not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'are not'."),
    "wasnt": ("was not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'was not'."),
    "werent": ("were not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'were not'."),
    "havent": ("have not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'have not'."),
    "hasnt": ("has not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'has not'."),
    "shouldnt": ("should not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'should not'."),
    "wouldnt": ("would not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'would not'."),
    "couldnt": ("could not", "grammar", "Thiếu dấu lược âm và trong IELTS Writing Task 2 nên viết đầy đủ 'could not'."),
}

_TYPO_WORD_RE = re.compile(r"\b(" + "|".join(re.escape(k) for k in sorted(_TYPO_CORRECTIONS, key=len, reverse=True)) + r")\b", re.IGNORECASE)

_INFORMAL_CONTRACTIONS: dict[str, str] = {
    "can't": "cannot",
    "don't": "do not",
    "won't": "will not",
    "doesn't": "does not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "it's": "it is",
    "i'm": "I am",
    "they're": "they are",
    "we're": "we are",
    "you're": "you are",
}


class ServiceConfig(BaseModel):
    """Cấu hình chạy dịch vụ nạp từ biến môi trường (`WRITING_SCORER_*`)."""

    host: str = Field(default_factory=lambda: os.getenv("WRITING_SCORER_HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.getenv("WRITING_SCORER_PORT", str(DEFAULT_PORT))))
    model_dir: Path = Field(
        default_factory=lambda: Path(os.getenv("WRITING_SCORER_MODEL_DIR", str(DEFAULT_MODEL_DIR)))
    )
    model_type: str = Field(default_factory=lambda: os.getenv("WRITING_SCORER_MODEL_TYPE", "best"))
    device: Optional[str] = Field(default_factory=lambda: os.getenv("WRITING_SCORER_DEVICE") or None)


class ServiceDomainError(Exception):
    """Lỗi nghiệp vụ có cấu trúc khớp với định dạng trả lỗi của phonetics-service."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        suggestion: str,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.suggestion = suggestion


class WritingEvaluateRequest(BaseModel):
    """Schema JSON đầu vào được gửi từ dịch vụ Spring Boot (`PythonIntegrationService`)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    topic: str = Field(default="", description="Essay prompt or topic text.")
    prompt: Optional[str] = Field(default=None, description="Optional alias for topic.")
    essay_text: str = Field(default="", alias="essayText", description="Student essay text.")
    essay: Optional[str] = Field(default=None, description="Optional alias for essayText.")
    assignment_title: Optional[str] = Field(default=None, alias="assignmentTitle")
    key_points: Optional[str] = Field(default=None, alias="keyPoints")
    rubrics: Optional[str] = Field(default=None, alias="rubrics")
    model_type: Optional[str] = Field(default=None, alias="modelType")
    writing_task: Optional[str] = Field(
        default="AUTO",
        alias="writingTask",
        description="Target writing task mode (TASK_2, TASK_1, PARAGRAPH, or AUTO).",
    )
    task_type: Optional[str] = Field(
        default=None,
        alias="taskType",
        description="Optional alias for writingTask.",
    )

    @model_validator(mode="before")
    @classmethod
    def _normalize_aliases(cls, data: Any) -> Any:
        """Chuẩn hóa các tên trường thay thế (`prompt` -> `topic`, `essay` -> `essayText`, `taskType` -> `writingTask`)."""
        if not isinstance(data, dict):
            return data
        out = dict(data)
        if not out.get("topic") and out.get("prompt"):
            out["topic"] = out["prompt"]
        if not out.get("essayText") and not out.get("essay_text") and out.get("essay"):
            out["essayText"] = out["essay"]
        raw_task = out.get("writingTask")
        if raw_task is None or str(raw_task).strip() == "":
            for alias_key in ("writing_task", "taskType", "task_type"):
                alias_val = out.get(alias_key)
                if alias_val is not None and str(alias_val).strip() != "":
                    out["writingTask"] = alias_val
                    break
        return out


EvaluateWritingRequest = WritingEvaluateRequest


class TaskAchievementSchema(BaseModel):
    """Mức độ hoàn thành yêu cầu đề bài: điểm số, ý đã đạt và ý còn thiếu."""

    score: float
    addressedPoints: list[str]
    missingPoints: list[str]


class WritingMistakeSchema(BaseModel):
    """Thông tin một lỗi chính tả/ngữ pháp/dấu câu/từ vựng được phát hiện trong bài."""

    original: str
    correction: str
    type: str
    explanation: str


class WritingSuggestionSchema(BaseModel):
    """Một gợi ý cải thiện theo từng khía cạnh bài viết."""

    area: str
    recommendation: str


class CriterionHighlightSchema(BaseModel):
    """Đoạn trích dẫn minh họa cụ thể trong bài kèm bản viết lại và cách sửa."""

    inEssay: str
    rewritten: str
    critique: str
    howToFix: str


class CriterionDetailSchema(BaseModel):
    """Đánh giá chi tiết từng tiêu chí (TR/TA, CC, LR, GRA) kèm lời khuyên lên band kế tiếp."""

    code: str
    name: str
    band: float
    summary: str
    nextBand: int
    nextBandAdvice: str
    highlights: list[CriterionHighlightSchema] = Field(default_factory=list)


class SuggestedVocabSchema(BaseModel):
    """Từ vựng hoặc collocation học thuật gợi ý theo chủ đề kèm phiên âm IPA và ví dụ."""

    word: str
    ipa: str
    meaning: str
    example: str
    usageContext: str


class SubcriteriaSchema(BaseModel):
    """Điểm chi tiết 4 tiêu chí IELTS (cả dạng làm tròn và dạng thô liên tục)."""

    taskResponse: float
    taskResponseRaw: float
    coherenceCohesion: float
    coherenceCohesionRaw: float
    lexicalResource: float
    lexicalResourceRaw: float
    grammaticalRange: float
    grammaticalRangeRaw: float
    overallBandRaw: float


class WritingEvaluateResponse(BaseModel):
    """Cấu trúc JSON đầu ra chuẩn hóa khớp hoàn toàn với Spring Boot & frontend `WritingAiEvaluationResult`."""

    writingTask: str = "TASK_2"
    writingSubType: str = "TASK2_OPINION"
    wordCount: int
    correctedWordCount: int = 0
    isOffTopic: bool
    taskAchievement: TaskAchievementSchema
    taskResponseScore: float
    overallBand: float
    overallScore: int
    isPassed: bool
    estimatedCefr: str
    grammarScore: float
    vocabularyScore: float
    coherenceScore: float
    correctedText: str
    generalFeedback: str
    mistakes: list[WritingMistakeSchema]
    suggestions: list[WritingSuggestionSchema]
    criteriaDetails: dict[str, CriterionDetailSchema] = Field(default_factory=dict)
    suggestedVocabulary: list[SuggestedVocabSchema] = Field(default_factory=list)
    evaluatedBy: str
    modelType: str
    subcriteria: SubcriteriaSchema
    diagnostics: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class _SpanEdit:
    """Biểu diễn một chỉnh sửa tại vị trí ký tự [start, end) dùng khi tự động sửa bài và xuất danh sách lỗi."""

    start: int
    end: int
    replacement: str
    original: str
    correction: str
    mistake_type: str
    explanation: str


def round_to_half_band(val: float) -> float:
    """Giới hạn điểm trong [1.0, 9.0] và làm tròn nửa lên (half-up) về bước 0.5 gần nhất."""
    clipped = max(1.0, min(9.0, float(val)))
    rounded = int(clipped * 2.0 + 0.5) / 2.0
    return max(1.0, min(9.0, rounded))


def round_to_whole_band(val: float) -> float:
    """Giới hạn điểm trong [1.0, 9.0] và làm tròn nửa lên về số nguyên band chuẩn cho từng tiêu chí IELTS."""
    clipped = max(1.0, min(9.0, float(val)))
    rounded = float(int(clipped + 0.5))
    return max(1.0, min(9.0, rounded))


def floor_to_half_band(val: float) -> float:
    """Giới hạn điểm trung bình trong [1.0, 9.0] và làm tròn XUỐNG về bước 0.5 theo quy tắc tính Overall IELTS."""
    clipped = max(1.0, min(9.0, float(val)))
    floored = math.floor(clipped * 2.0 + 1e-9) / 2.0
    return max(1.0, min(9.0, floored))


_ALNUM_TOKEN_RE = re.compile(r"[A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF]")


def count_ielts_words(text: str) -> int:
    """Đếm số từ theo quy ước chính thức của IELTS (từ ghép nối bằng dấu gạch ngang tính là 1 từ)."""
    cleaned = (text or "").strip()
    if not cleaned:
        return 0
    return sum(1 for tok in cleaned.split() if _ALNUM_TOKEN_RE.search(tok))


def normalize_writing_task(raw_task: Optional[str]) -> str:
    """Chuẩn hóa chuỗi `writingTask`/`taskType` đầu vào về `TASK_1`, `TASK_2` hoặc `PARAGRAPH` (mặc định/AUTO -> `TASK_2`)."""
    if raw_task is None:
        return "TASK_2"
    cleaned = str(raw_task).strip()
    if not cleaned:
        return "TASK_2"
    canonical = re.sub(r"[\s\-]+", "_", cleaned.upper())
    if canonical == "AUTO" or canonical in _TASK_2_ALIASES:
        return "TASK_2"
    if canonical in _TASK_1_ALIASES:
        return "TASK_1"
    if canonical in _PARAGRAPH_ALIASES:
        return "PARAGRAPH"
    return canonical


_WRITING_SUBTYPE_LABELS_VI: dict[str, str] = {
    "TASK1_DATA": "IELTS Task 1 (Biểu đồ / Bảng số liệu)",
    "TASK1_PROCESS": "IELTS Task 1 (Quy trình / Sơ đồ)",
    "TASK1_MAP": "IELTS Task 1 (Bản đồ / Mặt bằng)",
    "TASK2_OPINION": "IELTS Task 2 (Opinion / Agree–Disagree)",
    "TASK2_DISCUSSION": "IELTS Task 2 (Discussion Both Views)",
    "TASK2_ADV_DISADV": "IELTS Task 2 (Advantages & Disadvantages)",
    "TASK2_PROBLEM_SOLUTION": "IELTS Task 2 (Problem & Solution)",
    "TASK2_TWO_PART": "IELTS Task 2 (Two-part / Direct Questions)",
    "TASK2_DISCURSIVE_C1": "Discursive Academic Essay (C1)",
    "PARAGRAPH_DESCRIPTIVE": "Đoạn văn miêu tả / kể chuyện (A1–A2)",
    "PARAGRAPH_EMAIL": "Email / Tin nhắn ngắn (A1–A2)",
    "PARAGRAPH_OPINION": "Đoạn văn nêu quan điểm (Opinion Paragraph)",
    "PARAGRAPH_ADV_DISADV": "Đoạn văn Ưu & Nhược điểm",
    "PARAGRAPH_CAUSE_EFFECT": "Đoạn văn Nguyên nhân & Kết quả",
    "PARAGRAPH_PROBLEM_SOLUTION": "Đoạn văn Vấn đề & Giải pháp",
    "PARAGRAPH_GUIDED": "Đoạn văn học thuật có hướng dẫn",
}


def detect_writing_subtype(
    writing_task: str,
    raw_task: str = "",
    prompt: str = "",
    assignment_title: str = "",
    rubrics: str = "",
) -> str:
    """Phân loại chi tiết tiểu thể loại (subtype) của bài viết từ mã định dạng, tiêu đề, rubrics và đề bài."""
    norm_task = normalize_writing_task(writing_task)
    raw_upper = re.sub(r"[\s\-]+", "_", (raw_task or "").strip().upper())
    combined = " ".join(
        p.strip().lower()
        for p in (raw_task or "", assignment_title or "", rubrics or "", prompt or "")
        if p and str(p).strip()
    )

    # Nhánh 1: IELTS Task 1 chia thành Quy trình (Process), Bản đồ (Map) hoặc Biểu đồ/Số liệu (Data)
    if norm_task == "TASK_1":
        if raw_upper == "TASK1_PROCESS" or any(
            kw in combined
            for kw in (
                "process diagram", "flow chart", "flowchart", "process",
                "manufacturing", "production cycle", "life cycle",
                "how ", "stages", "biểu đồ quy trình", "sơ đồ quy trình",
            )
        ):
            if raw_upper == "TASK1_PROCESS" or any(
                k in combined
                for k in (
                    "process", "flowchart", "flow chart", "cycle",
                    "manufactur", "is made", "are produced", "stages", "quy trình",
                )
            ):
                return "TASK1_PROCESS"
        if raw_upper == "TASK1_MAP" or any(
            kw in combined
            for kw in (
                "map", "maps", "floor plan", "layout", "redevelopment",
                "village", "town centre", "town center", "island", "campus", "bản đồ",
            )
        ):
            return "TASK1_MAP"
        return "TASK1_DATA"

    # Nhánh 2: Đoạn văn (Paragraph) chia thành Email ngắn, Miêu tả, Quan điểm, Ưu/Nhược, Nguyên nhân/Kết quả, Vấn đề/Giải pháp hoặc Có hướng dẫn
    if norm_task == "PARAGRAPH":
        if raw_upper in ("WRITING_SHORT_EMAIL", "SHORT_EMAIL", "WRITING_EMAIL", "EMAIL", "PARAGRAPH_EMAIL") or any(
            kw in combined
            for kw in ("email", "e-mail", "short letter", "informal letter", "friendly message", "tin nhắn ngắn", "viết thư")
        ):
            return "PARAGRAPH_EMAIL"
        if raw_upper in ("WRITING_DESCRIPTIVE_PARAGRAPH", "DESCRIPTIVE_PARAGRAPH", "PARAGRAPH_DESCRIPTIVE") or any(
            kw in combined
            for kw in ("descriptive", "narrative", "miêu tả", "kể chuyện", "daily routine", "favorite hobby", "my best friend")
        ):
            return "PARAGRAPH_DESCRIPTIVE"
        if raw_upper in ("WRITING_OPINION", "PARAGRAPH_OPINION") or "opinion paragraph" in combined or (
            "opinion" in combined and ("agree" in combined or "quant điểm" in combined or "quan điểm" in combined)
        ):
            return "PARAGRAPH_OPINION"
        if raw_upper in ("WRITING_ADV_DISADV", "PARAGRAPH_ADV_DISADV") or (
            "advantage" in combined and "disadvantage" in combined
        ) or ("benefit" in combined and "drawback" in combined):
            return "PARAGRAPH_ADV_DISADV"
        if raw_upper in ("WRITING_CAUSE_EFFECT", "PARAGRAPH_CAUSE_EFFECT") or (
            "cause" in combined and "effect" in combined
        ) or ("nguyên nhân" in combined and ("kết quả" in combined or "hệ quả" in combined)):
            return "PARAGRAPH_CAUSE_EFFECT"
        if raw_upper in ("WRITING_PROBLEM_SOLUTION", "PARAGRAPH_PROBLEM_SOLUTION") or (
            "problem" in combined and "solution" in combined
        ) or ("vấn đề" in combined and "giải pháp" in combined):
            return "PARAGRAPH_PROBLEM_SOLUTION"
        return "PARAGRAPH_GUIDED"

    # Nhánh 3: IELTS Task 2 / Bài luận học thuật đa chiều (Discursive C1, Discussion, Adv/Disadv, Problem/Solution, Two-part, Opinion)
    if raw_upper in ("WRITING_DISCURSIVE_ESSAY", "DISCURSIVE_ESSAY", "DISCURSIVE_ACADEMIC_ESSAY", "TASK2_DISCURSIVE_C1") or "discursive" in combined or "phản biện đa chiều" in combined:
        return "TASK2_DISCURSIVE_C1"
    if raw_upper == "TASK2_DISCUSSION" or "discuss both" in combined or "both views" in combined or "both sides" in combined:
        return "TASK2_DISCUSSION"
    if raw_upper == "TASK2_ADV_DISADV" or "outweigh" in combined or (
        "advantage" in combined and "disadvantage" in combined
    ):
        return "TASK2_ADV_DISADV"
    if raw_upper == "TASK2_PROBLEM_SOLUTION" or (
        ("problem" in combined or "cause" in combined) and ("solution" in combined or "measure" in combined)
    ):
        return "TASK2_PROBLEM_SOLUTION"
    if raw_upper == "TASK2_TWO_PART" or (prompt or "").count("?") >= 2 or "why is this" in combined or "two-part" in combined:
        return "TASK2_TWO_PART"
    return "TASK2_OPINION"


def _extract_target_word_range(
    writing_task: str,
    writing_subtype: str,
    prompt: str = "",
    assignment_title: str = "",
    rubrics: str = "",
) -> tuple[int, int]:
    """Suy luận khung số từ kỳ vọng `(min_words, ideal_max_words)` từ mô tả đề/rubrics hoặc theo chuẩn từng dạng bài."""
    meta = " ".join(p for p in (rubrics or "", assignment_title or "", prompt or "") if p)
    range_match = _EXPLICIT_RANGE_RE.search(meta)
    if range_match:
        low, high = int(range_match.group(1)), int(range_match.group(2))
        if 20 <= low <= high <= 500:
            return (low, high)
    min_match = _AT_LEAST_WORDS_RE.search(meta)
    if min_match:
        low = int(min_match.group(1))
        if 20 <= low <= 400:
            return (low, low + 60)

    # Nếu đề không ghi rõ khoảng số từ, áp dụng khung mặc định theo TASK_1 (150-210), PARAGRAPH (40-180) hoặc TASK_2 (250-320)
    norm_task = normalize_writing_task(writing_task)
    if norm_task == "TASK_1":
        return (150, 210)
    if norm_task == "PARAGRAPH":
        if writing_subtype in ("PARAGRAPH_DESCRIPTIVE", "PARAGRAPH_EMAIL"):
            return (40, 80)
        upper_meta = meta.upper()
        if any(k in upper_meta for k in ("A1", "A2", "BEGINNER")):
            return (40, 80)
        if writing_subtype == "PARAGRAPH_GUIDED" and ("120" in meta or "180" in meta or "B2" in upper_meta):
            return (120, 180)
        return (100, 150)
    return (250, 320)


def band_to_cefr(band: float) -> str:
    """Quy đổi điểm tổng thể (Overall Band) IELTS sang khung trình độ CEFR."""
    if band >= 8.5:
        return "C2"
    if band >= 7.0:
        return "C1"
    if band >= 5.5:
        return "B2"
    if band >= 4.0:
        return "B1"
    return "A2"


def _simple_stem(token: str) -> str:
    """Rút gọn hậu tố từ vựng đơn giản để so khớp từ khóa giữa đề bài và bài làm."""
    t = token.lower()
    for suffix in (
        "ings", "ing", "ations", "ation", "ments", "ment",
        "ities", "ity", "ness", "ers", "ies", "ied", "ed", "es", "s", "ly",
    ):
        if len(t) > len(suffix) + 3 and t.endswith(suffix):
            return t[: -len(suffix)]
    return t


def _extract_content_keywords(text: str) -> list[tuple[str, str]]:
    """Trích xuất danh sách duy nhất các cặp `(từ_hiển_thị, gốc_từ)` cho từ khóa nội dung trong đề bài."""
    seen: set[str] = set()
    items: list[tuple[str, str]] = []
    for raw in _WORD_RE.findall(text or ""):
        low = raw.lower()
        if len(low) < 3 or low in _STOPWORDS:
            continue
        stem = _simple_stem(low)
        if stem not in seen:
            seen.add(stem)
            items.append((low, stem))
    return items


def _match_case(source: str, target: str) -> str:
    """Giữ nguyên kiểu viết hoa (toàn hoa, hoa chữ cái đầu hoặc thường) của từ gốc khi thay thế sửa lỗi."""
    if source.isupper():
        return target.upper()
    if source and source[0].isupper():
        return target[0].upper() + target[1:]
    return target


def _analyze_essay_surface_and_mechanics(
    prompt: str,
    essay: str,
    writing_task: str = "TASK_2",
    writing_subtype: str = "TASK2_OPINION",
) -> dict[str, Any]:
    """Chạy chẩn đoán bề mặt, kiểm tra độ bám đề, phát hiện viết tiếng Việt/chép đề và tự sửa lỗi chính tả/ngữ pháp ngoại tuyến."""
    essay_str = essay.strip()
    prompt_str = (prompt or "").strip()
    raw_words = _WORD_RE.findall(essay_str)
    words_lower = [w.lower() for w in raw_words]
    whitespace_tokens = [t for t in essay_str.split() if t]
    ielts_wc = count_ielts_words(essay_str)
    word_count = ielts_wc if ielts_wc > 0 else len(raw_words)

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\r\n\r\n", essay_str) if p.strip()]
    if len(paragraphs) <= 1 and "\n" in essay_str:
        paragraphs = [p.strip() for p in essay_str.splitlines() if p.strip()]
    para_count = max(1, len(paragraphs)) if essay_str else 0

    raw_sents = [s.strip() for s in _SENT_SPLIT_RE.split(essay_str) if s.strip() and _WORD_RE.search(s)]
    sent_count = max(1, len(raw_sents)) if word_count > 0 else 0
    sent_lens = [len(_WORD_RE.findall(s)) for s in raw_sents] or [0]
    avg_sent_len = round(sum(sent_lens) / max(1, len(sent_lens)), 1)

    # Đếm các tín hiệu đặc trưng theo dạng bài: từ nối, kết luận, Overview/số liệu (Task 1), chào/kết (Email)
    essay_lower = essay_str.lower()
    dm_unique = sum(
        1 for ph in _DISCOURSE_MARKERS if re.search(rf"\b{re.escape(ph)}\b", essay_lower)
    )
    has_conclusion_marker = any(
        re.search(rf"\b{re.escape(ph)}\b", essay_lower) for ph in _CONCLUSION_MARKERS
    )
    has_overview_signal = any(
        re.search(rf"\b{re.escape(ph)}\b", essay_lower) for ph in _OVERVIEW_MARKERS
    )
    data_figure_count = len(_DATA_TREND_RE.findall(essay_str))
    sequence_marker_count = sum(
        1 for ph in _SEQUENCE_MARKERS if re.search(rf"\b{re.escape(ph)}\b", essay_lower)
    )
    spatial_marker_count = sum(
        1 for ph in _SPATIAL_MARKERS if re.search(rf"\b{re.escape(ph)}\b", essay_lower)
    )
    has_email_greeting = bool(_EMAIL_GREETING_RE.search(essay_str))
    has_email_signoff = bool(_EMAIL_SIGNOFF_RE.search(essay_str))
    subordinator_count = sum(
        len(re.findall(rf"\b{re.escape(ph)}\b", essay_lower)) for ph in _SUBORDINATORS
    )
    subordinator_per_100 = round(subordinator_count * 100.0 / max(1, word_count), 2)

    unique_words = len(set(words_lower))
    ttr = round(unique_words / max(1, len(words_lower)), 3) if words_lower else 0.0

    trigrams = list(zip(words_lower, words_lower[1:], words_lower[2:]))
    repeated_trigram_ratio = (
        round(1.0 - (len(set(trigrams)) / max(1, len(trigrams))), 3) if trigrams else 0.0
    )

    content_words = [w for w in words_lower if len(w) >= 4 and w not in _STOPWORDS]
    content_counts = Counter(content_words)
    top_repeated_word: Optional[tuple[str, int]] = (
        content_counts.most_common(1)[0] if content_counts else None
    )
    top1_content_ratio = (
        round(top_repeated_word[1] / max(1, len(content_words)), 3) if top_repeated_word else 0.0
    )
    is_repetitive = bool(
        (word_count >= 40 and repeated_trigram_ratio > 0.32)
        or (word_count >= 60 and ttr < 0.22)
        or (word_count >= 40 and top1_content_ratio > 0.22)
    )

    # Kiểm tra bài viết pha nhiều tiếng Việt (>=25% từ có dấu tiếng Việt) hoặc chép lại nguyên đề bài (parroting)
    vi_tokens = sum(1 for tok in whitespace_tokens if _VIETNAMESE_DIACRITIC_RE.search(tok))
    is_vietnamese_heavy = bool(whitespace_tokens and (vi_tokens / len(whitespace_tokens)) >= 0.25)

    prompt_words_set = {w.lower() for w in _WORD_RE.findall(prompt_str)}
    essay_words_set = set(words_lower)
    has_prompt = len(prompt_words_set) >= 4
    is_parroting = False
    if has_prompt and essay_words_set and word_count <= len(prompt_words_set) + 8 and word_count < 65:
        overlap_ratio = len(essay_words_set & prompt_words_set) / max(1, len(essay_words_set))
        if overlap_ratio >= 0.80:
            is_parroting = True

    # So khớp từ khóa nội dung giữa đề bài và bài làm
    prompt_kws = _extract_content_keywords(prompt_str)
    essay_stems = {_simple_stem(w) for w in words_lower if len(w) >= 3}
    matched_kws = [disp for disp, stem in prompt_kws if stem in essay_stems]
    missing_kws = [disp for disp, stem in prompt_kws if stem not in essay_stems]
    prompt_coverage = round(len(matched_kws) / len(prompt_kws), 3) if prompt_kws else 0.0

    # Lượt 1: Thu thập các chỉnh sửa từ vựng, ngữ pháp, mạo từ a/an, lặp từ, chia số nhiều và khoảng trắng sau dấu câu
    candidate_edits: list[_SpanEdit] = []

    for m in _LOWERCASE_I_RE.finditer(essay_str):
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement="I",
                original=m.group(0),
                correction="I",
                mistake_type="spelling",
                explanation="Đại từ ngôi thứ nhất số ít 'I' trong tiếng Anh luôn phải viết hoa trong mọi câu.",
            )
        )

    for m in _ADJ_DUP_RE.finditer(essay_str):
        dup_word = m.group(1)
        if dup_word.lower() in ("had", "that"):
            continue
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=dup_word,
                original=m.group(0),
                correction=dup_word,
                mistake_type="grammar",
                explanation=f"Từ '{dup_word}' bị lặp liền kề hai lần. Hãy lược bỏ một từ bị dư.",
            )
        )

    for m in _ARTICLE_A_BEFORE_VOWEL_RE.finditer(essay_str):
        art, nxt = m.group(1), m.group(2)
        repl_art = "An" if art[0].isupper() else "an"
        correction = f"{repl_art} {nxt}"
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=correction,
                original=m.group(0),
                correction=correction,
                mistake_type="grammar",
                explanation=f"Quy tắc mạo từ: Dùng 'an' thay cho 'a' trước từ bắt đầu bằng nguyên âm phát âm ('{nxt}').",
            )
        )

    for m in _ARTICLE_AN_BEFORE_CONSONANT_RE.finditer(essay_str):
        art, nxt = m.group(1), m.group(2)
        repl_art = "A" if art[0].isupper() else "a"
        correction = f"{repl_art} {nxt}"
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=correction,
                original=m.group(0),
                correction=correction,
                mistake_type="grammar",
                explanation=f"Quy tắc mạo từ: Dùng 'a' thay cho 'an' trước từ bắt đầu bằng phụ âm phát âm ('{nxt}').",
            )
        )

    for m in _TYPO_WORD_RE.finditer(essay_str):
        raw_tok = m.group(1)
        entry = _TYPO_CORRECTIONS.get(raw_tok.lower())
        if not entry:
            continue
        corr_base, mtype, explain = entry
        corr_word = _match_case(raw_tok, corr_base)
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=corr_word,
                original=raw_tok,
                correction=corr_word,
                mistake_type=mtype,
                explanation=explain,
            )
        )

    for m in _THERE_IS_PLURAL_RE.finditer(essay_str):
        lead, tail = m.group(1), m.group(2)
        is_past = "was" in lead.lower()
        repl_lead = ("There were" if is_past else "There are") if lead[0].isupper() else ("there were" if is_past else "there are")
        correction = f"{repl_lead} {tail}"
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=correction,
                original=m.group(0),
                correction=correction,
                mistake_type="grammar",
                explanation="Cấu trúc 'There is / There are': Danh từ phía sau ở dạng số nhiều nên động từ 'to be' phải chia số nhiều ('there are / there were').",
            )
        )

    for m in _ONE_OF_SINGULAR_RE.finditer(essay_str):
        prefix, noun = m.group(1), m.group(2)
        plural_noun = noun + "s"
        correction = f"{prefix}{plural_noun}"
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=correction,
                original=m.group(0),
                correction=correction,
                mistake_type="grammar",
                explanation=f"Cấu trúc 'one of the + danh từ số nhiều': Từ '{noun}' phải viết ở dạng số nhiều là '{plural_noun}'.",
            )
        )

    for m in _SPACE_AFTER_PUNCT_RE.finditer(essay_str):
        punct, letter = m.group(1), m.group(2)
        correction = f"{punct} {letter}"
        candidate_edits.append(
            _SpanEdit(
                start=m.start(),
                end=m.end(),
                replacement=correction,
                original=m.group(0),
                correction=correction,
                mistake_type="punctuation",
                explanation=f"Cần thêm một khoảng trắng sau dấu câu '{punct}' trước khi viết tiếp từ '{letter}...'.",
            )
        )

    def _apply_non_overlapping(text: str, edits: list[_SpanEdit]) -> tuple[str, list[_SpanEdit]]:
        """Áp dụng các span chỉnh sửa không chồng lấn từ cuối chuỗi lên đầu để bảo toàn chỉ số vị trí."""
        edits.sort(key=lambda e: (e.start, -(e.end - e.start)))
        chosen: list[_SpanEdit] = []
        last_end = -1
        for ed in edits:
            if ed.start >= last_end:
                chosen.append(ed)
                last_end = ed.end
        if not chosen:
            return text, []
        buf = list(text)
        for ed in reversed(chosen):
            buf[ed.start : ed.end] = list(ed.replacement)
        return "".join(buf), chosen

    pass1_text, accepted_pass1 = _apply_non_overlapping(essay_str, candidate_edits)

    # Lượt 2: Chuẩn hóa viết hoa đầu câu và bổ sung dấu chấm kết thúc đoạn/câu trên văn bản sau lượt 1
    punct_edits: list[_SpanEdit] = []
    for m in re.finditer(r"(?:^|(?<=[.!?])\s+|(?<=\n))([a-z][a-zA-Z']*)", pass1_text):
        word_tok = m.group(1)
        start_idx = m.start(1)
        end_idx = m.end(1)
        if word_tok == "i":
            continue
        prefix_ctx = pass1_text[max(0, m.start() - 8) : m.start()].rstrip()
        if _SENT_ABBREV_RE.search(prefix_ctx):
            continue
        cap = word_tok[0].upper() + word_tok[1:]
        punct_edits.append(
            _SpanEdit(
                start=start_idx,
                end=end_idx,
                replacement=cap,
                original=word_tok,
                correction=cap,
                mistake_type="punctuation",
                explanation="Chữ cái đầu câu cần được viết hoa sau dấu kết thúc câu hoặc ở đầu đoạn văn.",
            )
        )

    if word_count >= 5:
        for m in re.finditer(r"([A-Za-z0-9]+)(?=[ \t\r]*(?:\n|$))", pass1_text):
            line_end = m.end(1)
            after_stripped = pass1_text[line_end:].lstrip(" \t\r")
            if not after_stripped or after_stripped.startswith("\n"):
                tok = m.group(1)
                punct_edits.append(
                    _SpanEdit(
                        start=m.start(1),
                        end=line_end,
                        replacement=tok + ".",
                        original=tok,
                        correction=tok + ".",
                        mistake_type="punctuation",
                        explanation="Đoạn văn/câu kết thúc thiếu dấu chấm câu (. ! ?).",
                    )
                )

    final_text, accepted_pass2 = _apply_non_overlapping(pass1_text, punct_edits)
    accepted_edits = accepted_pass1 + accepted_pass2
    corrected_text = final_text if final_text != essay_str else ""

    # Gom tối đa 12 lỗi tiêu biểu (loại trùng theo cặp original/correction/type)
    mistakes: list[dict[str, str]] = []
    seen_mistake_keys: set[tuple[str, str, str]] = set()
    for ed in accepted_edits:
        key = (ed.original.lower(), ed.correction.lower(), ed.mistake_type)
        if key in seen_mistake_keys:
            continue
        seen_mistake_keys.add(key)
        mistakes.append(
            {
                "original": ed.original,
                "correction": ed.correction,
                "type": ed.mistake_type,
                "explanation": ed.explanation,
            }
        )
        if len(mistakes) >= 12:
            break

    # Chẩn đoán bổ sung về văn phong học thuật (dạng viết tắt) và lặp từ (chỉ báo nhắc, không sửa đè văn bản)
    is_informal_email = writing_subtype == "PARAGRAPH_EMAIL"
    if len(mistakes) < 12 and not is_informal_email:
        for contr, full_form in _INFORMAL_CONTRACTIONS.items():
            if re.search(rf"\b{re.escape(contr)}\b", essay_lower):
                key = (contr, full_form, "vocabulary")
                if key not in seen_mistake_keys:
                    seen_mistake_keys.add(key)
                    task_label = (
                        "IELTS Writing Task 1"
                        if writing_task == "TASK_1"
                        else ("đoạn văn học thuật" if writing_task == "PARAGRAPH" else "IELTS Writing Task 2")
                    )
                    mistakes.append(
                        {
                            "original": contr,
                            "correction": full_form,
                            "type": "vocabulary",
                            "explanation": f"Văn phong học thuật ({task_label}) hạn chế dùng dạng viết tắt '{contr}'; nên viết đầy đủ là '{full_form}'.",
                        }
                    )
                    if len(mistakes) >= 12:
                        break

    if len(mistakes) < 12 and is_repetitive and top_repeated_word and top_repeated_word[1] >= 4:
        rep_w, rep_cnt = top_repeated_word
        mistakes.append(
            {
                "original": f"{rep_w} (lặp {rep_cnt} lần)",
                "correction": f"Dùng từ đồng nghĩa / paraphrase thay cho '{rep_w}'",
                "type": "vocabulary",
                "explanation": f"Từ '{rep_w}' xuất hiện {rep_cnt} lần trong bài, dễ làm giảm điểm Lexical Resource và Coherence. Hãy thay thế bằng từ đồng nghĩa hoặc đại từ quy chiếu.",
            }
        )

    return {
        "word_count": word_count,
        "sentence_count": sent_count,
        "paragraph_count": para_count,
        "avg_sentence_length": avg_sent_len,
        "sentences": raw_sents,
        "base_revised_text": final_text,
        "lexical_diversity_ttr": ttr,
        "discourse_markers_unique": dm_unique,
        "has_conclusion_marker": has_conclusion_marker,
        "has_overview_signal": has_overview_signal,
        "data_figure_count": data_figure_count,
        "sequence_marker_count": sequence_marker_count,
        "spatial_marker_count": spatial_marker_count,
        "has_email_greeting": has_email_greeting,
        "has_email_signoff": has_email_signoff,
        "subordinator_per_100": subordinator_per_100,
        "repeated_trigram_ratio": repeated_trigram_ratio,
        "top_repeated_word": top_repeated_word[0] if top_repeated_word else None,
        "top_repeated_count": top_repeated_word[1] if top_repeated_word else 0,
        "is_repetitive": is_repetitive,
        "is_vietnamese_heavy": is_vietnamese_heavy,
        "is_parroting": is_parroting,
        "has_prompt": has_prompt,
        "matched_keywords": matched_kws,
        "missing_keywords": missing_kws,
        "prompt_coverage": prompt_coverage,
        "corrected_text": corrected_text,
        "mistakes": mistakes,
    }


def _build_vietnamese_task_achievement(
    tr_score: float,
    is_off_topic: bool,
    surface: dict[str, Any],
    writing_task: str = "TASK_2",
    writing_subtype: str = "TASK2_OPINION",
    target_range: tuple[int, int] = (250, 320),
) -> dict[str, Any]:
    """Dựng danh sách điểm đã đạt (`addressedPoints`) và điểm còn thiếu (`missingPoints`) bằng tiếng Việt theo đúng dạng bài."""
    addressed: list[str] = []
    missing: list[str] = []

    wc = surface["word_count"]
    para_count = surface["paragraph_count"]
    matched_kws: list[str] = surface["matched_keywords"]
    missing_kws: list[str] = surface["missing_keywords"]
    min_words, max_words = target_range

    # Kiểm tra các trường hợp ngoại lệ nặng trước (viết tiếng Việt, chép lại đề, lạc đề)
    if surface["is_vietnamese_heavy"]:
        missing.append("Bài viết chứa nhiều tiếng Việt thay vì sử dụng tiếng Anh chuẩn.")
    elif surface["is_parroting"]:
        missing.append("Bài viết mới chép lại phần lớn câu chữ trong đề bài, chưa triển khai ý riêng.")
    elif is_off_topic:
        missing.append("Nội dung chưa bám sát yêu cầu trọng tâm và từ khóa chính của đề bài.")
    else:
        # Ghi nhận các điểm đã hoàn thành tương ứng với TASK_1, PARAGRAPH hoặc TASK_2
        if matched_kws:
            addressed.append(f"Đã đề cập các từ khóa trọng tâm của đề bài: {', '.join(matched_kws[:5])}.")
        if writing_task == "TASK_1":
            if wc >= min_words:
                addressed.append(f"Đáp ứng yêu cầu độ dài IELTS Writing Task 1 ({wc}/{min_words} từ).")
            elif wc >= 90:
                addressed.append(f"Đã trình bày được khung mô tả cơ bản ({wc} từ), cần mở rộng thêm chi tiết.")
            if surface["has_overview_signal"]:
                addressed.append("Có tín hiệu nêu Overview / xu hướng tổng quan.")
            if writing_subtype == "TASK1_DATA" and surface["data_figure_count"] >= 2:
                addressed.append("Đã đưa ra số liệu hoặc động từ mô tả xu hướng cụ thể.")
            elif writing_subtype == "TASK1_PROCESS" and surface["sequence_marker_count"] >= 2:
                addressed.append("Sử dụng được từ nối mô tả trình tự các bước trong quy trình.")
            elif writing_subtype == "TASK1_MAP" and surface["spatial_marker_count"] >= 1:
                addressed.append("Có sử dụng từ vựng chỉ vị trí / sự thay đổi không gian trên bản đồ.")
        elif writing_task == "PARAGRAPH":
            if min_words <= wc <= max_words + 20:
                addressed.append(f"Đáp ứng đúng khung độ dài mục tiêu ({wc} từ, yêu cầu {min_words}–{max_words} từ).")
            elif wc > max_words + 20:
                addressed.append(f"Diễn đạt khá đầy đủ ý ({wc} từ), cần chú ý cô đọng trong khung {min_words}–{max_words} từ.")
            if writing_subtype == "PARAGRAPH_EMAIL":
                if surface["has_email_greeting"] and surface["has_email_signoff"]:
                    addressed.append("Đảm bảo đầy đủ bố cục Email (có lời chào mở đầu và lời kết thư).")
            elif para_count == 1:
                addressed.append("Tuân thủ đúng cấu trúc viết gọn trong 1 đoạn văn thống nhất.")
            if surface["discourse_markers_unique"] >= 2:
                addressed.append(f"Sử dụng được {surface['discourse_markers_unique']} từ nối để liên kết câu trong đoạn.")
        else:
            if wc >= min_words:
                addressed.append(f"Đáp ứng yêu cầu độ dài tối thiểu ({wc}/{min_words} từ).")
            elif wc >= 150:
                addressed.append(f"Đã triển khai được khung bài viết cơ bản ({wc} từ), có thể mở rộng thêm dẫn chứng.")
            if para_count >= 4:
                addressed.append(f"Bố cục rõ ràng gồm {para_count} đoạn (Mở bài, Thân bài, Kết luận).")
            if surface["discourse_markers_unique"] >= 3:
                addressed.append(f"Sử dụng được {surface['discourse_markers_unique']} nhóm từ nối học thuật để liên kết luận điểm.")
        if not addressed:
            addressed.append("Đã bước đầu trình bày ý liên quan đến yêu cầu đề bài.")

    # Liệt kê các khía cạnh còn thiếu theo ngưỡng độ dài, độ phủ đề bài và cấu trúc từng dạng bài
    if not is_off_topic:
        if wc < min_words:
            missing.append(f"Chưa đạt độ dài tối thiểu {min_words} từ (hiện có {wc} từ).")
        if surface["has_prompt"] and surface["prompt_coverage"] < 0.55 and missing_kws:
            missing.append(f"Cần khai thác sâu hơn các khía cạnh liên quan đến: {', '.join(missing_kws[:4])}.")
        if writing_task == "TASK_1":
            if not surface["has_overview_signal"]:
                missing.append("Thiếu câu/đoạn Overview khái quát đặc điểm nổi bật hoặc xu hướng chính của đề bài.")
            if writing_subtype == "TASK1_DATA" and surface["data_figure_count"] < 2:
                missing.append("Cần chọn lọc và so sánh thêm các mốc số liệu/tỷ lệ tiêu biểu trong biểu đồ.")
            elif writing_subtype == "TASK1_PROCESS" and surface["sequence_marker_count"] < 2:
                missing.append("Cần bổ sung từ nối chỉ trình tự bước (First, Next, Subsequently, Finally) và thể bị động.")
            elif writing_subtype == "TASK1_MAP" and surface["spatial_marker_count"] < 1:
                missing.append("Cần mô tả rõ phương hướng (north/south/east/west) và sự thay đổi qua các giai đoạn.")
        elif writing_task == "PARAGRAPH":
            if writing_subtype == "PARAGRAPH_EMAIL":
                if not surface["has_email_greeting"]:
                    missing.append("Thiếu lời chào mở đầu phù hợp (ví dụ: Dear..., Hi...).")
                if not surface["has_email_signoff"]:
                    missing.append("Thiếu lời kết thư/ký tên (ví dụ: Best regards, See you soon...).")
            elif wc >= 40 and surface["discourse_markers_unique"] < 2:
                missing.append("Nên dùng thêm từ nối chuyển ý (First, Moreover, However, In short) để đoạn văn mạch lạc hơn.")
        else:
            if para_count < 4 and wc >= 80:
                missing.append("Nên chia bài viết thành 4 đoạn chuẩn (Mở bài, 2 Thân bài, Kết bài) để tách bạch luận điểm.")
            if not surface["has_conclusion_marker"] and wc >= 120:
                missing.append("Nên bổ sung câu kết luận rõ ràng (ví dụ: In conclusion, To sum up...) để khẳng định lại lập trường.")
            if tr_score < 6.5 and len(missing) < 2:
                missing.append("Cần bổ sung giải thích nguyên nhân - hệ quả và ví dụ thực tế cụ thể cho mỗi luận điểm.")

    return {
        "score": tr_score,
        "addressedPoints": addressed,
        "missingPoints": missing,
    }


def _build_vietnamese_feedback_and_suggestions(
    overall_band: float,
    cefr: str,
    tr_score: float,
    cc_score: float,
    lr_score: float,
    gra_score: float,
    is_off_topic: bool,
    surface: dict[str, Any],
    mistakes: list[dict[str, str]],
    adjustments: list[str],
    writing_task: str = "TASK_2",
    writing_subtype: str = "TASK2_OPINION",
    target_range: tuple[int, int] = (250, 320),
) -> tuple[str, list[dict[str, str]]]:
    """Sinh đoạn nhận xét tổng quan (`generalFeedback`) và danh sách gợi ý cải thiện (`suggestions`) bằng tiếng Việt."""
    task_criterion_label = (
        "Task Achievement (Mức độ hoàn thành mô tả)"
        if writing_task == "TASK_1"
        else (
            "Task Fulfillment (Mức độ hoàn thành yêu cầu đoạn văn)"
            if writing_task == "PARAGRAPH"
            else "Task Response (Trả lời đề bài)"
        )
    )
    criteria_map = {
        task_criterion_label: tr_score,
        "Coherence & Cohesion (Mạch lạc & Liên kết)": cc_score,
        "Lexical Resource (Từ vựng)": lr_score,
        "Grammatical Range & Accuracy (Ngữ pháp)": gra_score,
    }
    strongest_name, strongest_val = max(criteria_map.items(), key=lambda kv: kv[1])
    weakest_name, weakest_val = min(criteria_map.items(), key=lambda kv: kv[1])

    wc = surface["word_count"]
    para_count = surface["paragraph_count"]
    dm_unique = surface["discourse_markers_unique"]
    min_words, max_words = target_range
    subtype_label = _WRITING_SUBTYPE_LABELS_VI.get(writing_subtype, "Bài viết Writing")

    parts: list[str] = [
        f"[{subtype_label}] Ước lượng điểm tổng thể: Band {overall_band:.1f}/9.0 (trình độ {cefr}). "
        f"Điểm mạnh nhất là {strongest_name} ({strongest_val:.1f}); "
        f"tiêu chí cần ưu tiên cải thiện là {weakest_name} ({weakest_val:.1f})."
    ]

    if surface["is_vietnamese_heavy"]:
        parts.append(
            "Cảnh báo ngôn ngữ: Phát hiện bài viết sử dụng nhiều tiếng Việt. "
            "Hệ thống giới hạn điểm tối đa Band 4.0; bạn cần viết toàn bộ bài bằng tiếng Anh."
        )
    elif surface["is_parroting"]:
        parts.append(
            "Cảnh báo nội dung: Bài viết gần như chỉ lặp lại câu chữ của đề bài mà chưa phát triển ý riêng "
            "(giới hạn tiêu chí nội dung <= 3.5 và Overall <= 4.0)."
        )
    elif is_off_topic:
        parts.append(
            "Cảnh báo lạc đề: Bài viết ít trùng khớp từ khóa và ngữ cảnh với đề bài, "
            "nên tiêu chí nội dung bị giới hạn <= 3.5 và Overall <= 4.0."
        )

    # Nhận xét độ dài và bố cục đoạn tương ứng với PARAGRAPH, TASK_1 hoặc TASK_2
    if writing_task == "PARAGRAPH":
        severe_floor = max(12, int(round(min_words * 0.45)))
        if wc < severe_floor:
            parts.append(f"Độ dài quá ngắn ({wc} từ, yêu cầu {min_words}–{max_words} từ) nên bị giới hạn điểm tổng <= 3.5.")
        elif wc < min_words:
            parts.append(
                f"Bài viết hiện có {wc} từ, chưa đạt tối thiểu {min_words} từ của khung {min_words}–{max_words} từ; "
                f"nên bổ sung thêm khoảng {min_words - wc} từ để hoàn thiện ý."
            )
        else:
            parts.append(f"Độ dài phù hợp với khung mục tiêu ({wc} từ / {min_words}–{max_words} từ).")

        if writing_subtype == "PARAGRAPH_EMAIL":
            if surface["has_email_greeting"] and surface["has_email_signoff"]:
                parts.append("Cấu trúc Email hợp lệ với lời chào mở đầu và lời kết thư.")
            else:
                parts.append("Email cần bổ sung đầy đủ lời chào mở đầu (Dear/Hi...) và câu kết thư (Best regards/See you...).")
        elif para_count == 1:
            parts.append("Bố cục gọn trong 1 đoạn văn đúng chuẩn dạng bài.")
    elif writing_task == "TASK_1":
        if wc < 40:
            parts.append(f"Độ dài quá ngắn ({wc} từ, chuẩn IELTS Task 1 tối thiểu {min_words} từ) nên bị giới hạn điểm tổng <= 3.5.")
        elif wc < min_words:
            parts.append(
                f"Cảnh báo độ dài: Bài viết hiện có {wc} từ, chưa đạt tối thiểu {min_words} từ của IELTS Task 1; "
                f"hãy bổ sung thêm ít nhất {min_words - wc} từ (khuyên dùng 160–190 từ)."
            )
        else:
            parts.append(f"Độ dài đạt chuẩn Task 1 ({wc} từ).")

        if not surface["has_overview_signal"]:
            parts.append("Bài Task 1 cần có đoạn/câu Overview nêu rõ xu hướng hoặc đặc điểm nổi bật tổng quan.")
        elif para_count >= 3:
            parts.append(f"Bố cục gồm {para_count} đoạn rõ ràng (Introduction – Overview – Body details).")
    else:
        if wc < 50:
            parts.append(f"Độ dài quá ngắn ({wc} từ, chuẩn bài luận tối thiểu {min_words} từ) nên bị giới hạn điểm tổng <= 3.5.")
        elif wc < 120:
            parts.append(f"Bài viết mới đạt {wc}/{min_words} từ nên thiếu chiều sâu lập luận (điểm tổng bị giới hạn <= 4.5).")
        elif wc < min_words:
            parts.append(
                f"Cảnh báo độ dài: Bài viết hiện có {wc} từ, chưa đạt tối thiểu {min_words} từ; "
                f"hãy viết thêm ít nhất {min_words - wc} từ (khuyên dùng 260–290 từ) kèm ví dụ minh họa."
            )
        else:
            parts.append(f"Độ dài đạt chuẩn ({wc} từ).")

        if para_count >= 4:
            parts.append(f"Bố cục gồm {para_count} đoạn văn tương đối rõ ràng.")
        elif para_count == 3:
            parts.append("Bài viết đang chia 3 đoạn; nên tách thành 4 đoạn (Mở bài – 2 Thân bài – Kết bài) để điểm mạch lạc cao hơn.")
        else:
            parts.append(f"Bài viết hiện chỉ có {para_count} đoạn; cần chia rõ 4 đoạn (Mở bài, 2 Thân bài, Kết bài).")

    if surface["is_repetitive"]:
        parts.append("Phát hiện lặp từ hoặc lặp cụm từ nhiều lần, làm giảm điểm Từ vựng và Mạch lạc.")
    elif dm_unique < (2 if writing_task == "PARAGRAPH" else 3) and wc >= 60:
        parts.append(f"Số lượng từ nối chuyển ý còn hạn chế ({dm_unique} loại); nên tăng cường các liên từ tự nhiên.")

    if mistakes:
        parts.append(f"Hệ thống phát hiện {len(mistakes)} lỗi hình thức/chính tả/ngữ pháp cơ bản cần rà soát ở mục Sửa lỗi bên dưới.")
    elif adjustments:
        parts.append("Lưu ý chấm điểm: " + "; ".join(adjustments))

    # Tạo danh sách gợi ý cải thiện ưu tiên theo các tiêu chí còn yếu (< 6.5) hoặc vi phạm hình thức
    suggestions: list[dict[str, str]] = []

    if is_off_topic or surface["is_vietnamese_heavy"] or surface["is_parroting"]:
        suggestions.append(
            {
                "area": "Bám sát đề bài",
                "recommendation": "Đọc kỹ yêu cầu câu hỏi, triển khai đúng trọng tâm bằng tiếng Anh và bám sát các từ khóa chính của đề.",
            }
        )
    elif wc < min_words:
        suggestions.append(
            {
                "area": "Độ dài & Phát triển ý",
                "recommendation": f"Mở rộng bài viết từ {wc} từ lên tối thiểu {min_words} từ để đáp ứng trọn vẹn tiêu chí hoàn thành yêu cầu đề.",
            }
        )
    elif writing_task == "TASK_1" and not surface["has_overview_signal"]:
        suggestions.append(
            {
                "area": "Đoạn Overview (Task Achievement)",
                "recommendation": "Bổ sung đoạn Overview bắt đầu bằng 'Overall,' nêu 2 điểm nổi bật nhất trước khi đi vào số liệu hoặc từng bước chi tiết.",
            }
        )
    elif tr_score < 6.5:
        t_rec = (
            "Chọn lọc các điểm cao nhất/thấp nhất, bước chuyển tiếp chính hoặc thay đổi lớn để so sánh có hệ thống thay vì liệt kê rời rạc."
            if writing_task == "TASK_1"
            else (
                "Đảm bảo câu chủ đề (Topic Sentence) rõ ràng ở đầu đoạn, mỗi luận điểm đều có giải thích ngắn gọn và ví dụ minh họa."
                if writing_task == "PARAGRAPH"
                else "Đào sâu phần giải thích nguyên nhân - hệ quả và thêm ví dụ cụ thể thay vì nêu ý chung chung; đảm bảo kết bài nhất quán."
            )
        )
        suggestions.append(
            {
                "area": "Phát triển nội dung & Đáp ứng yêu cầu đề",
                "recommendation": t_rec,
            }
        )

    if writing_task == "PARAGRAPH":
        if writing_subtype == "PARAGRAPH_EMAIL" and (not surface["has_email_greeting"] or not surface["has_email_signoff"]):
            suggestions.append(
                {
                    "area": "Bố cục Email / Tin nhắn",
                    "recommendation": "Mở đầu bằng lời chào thân thiện (Dear/Hi [Name],) và kết thúc bằng lời chúc/ký tên (Best regards, / See you soon,).",
                }
            )
        elif cc_score < 6.5 or dm_unique < 2:
            suggestions.append(
                {
                    "area": "Liên kết câu trong đoạn (Coherence)",
                    "recommendation": "Dùng mạch liên kết Topic Sentence -> Supporting Ideas -> Concluding Sentence kèm từ nối (First, Moreover, Because, As a result).",
                }
            )
    elif writing_task == "TASK_1":
        if cc_score < 6.5 or dm_unique < 3:
            seq_hint = (
                "dùng từ nối trình tự (First, Next, Subsequently, Finally) và thể bị động."
                if writing_subtype == "TASK1_PROCESS"
                else "chia 4 đoạn rõ ràng (Intro – Overview – Body 1 – Body 2) với từ nối so sánh (Whereas, In contrast, Similarly)."
            )
            suggestions.append(
                {
                    "area": "Tổ chức & Liên kết (Coherence & Cohesion)",
                    "recommendation": f"Sắp xếp thông tin mạch lạc: {seq_hint}",
                }
            )
    elif para_count < 4 or cc_score < 6.5 or dm_unique < 3:
        suggestions.append(
            {
                "area": "Cấu trúc & Liên kết (Coherence & Cohesion)",
                "recommendation": "Tổ chức đủ 4 đoạn văn và dùng đa dạng từ nối theo chức năng: bổ sung (Moreover, Furthermore), tương phản (However, Conversely), kết quả (Consequently, Therefore).",
            }
        )

    if surface["is_repetitive"] or lr_score < 6.5:
        rep_note = (
            f" Tránh lặp lại từ '{surface['top_repeated_word']}' quá nhiều lần bằng cách dùng đại từ quy chiếu hoặc từ đồng nghĩa."
            if surface["top_repeated_word"] and surface["top_repeated_count"] >= 4
            else ""
        )
        lex_tip = (
            "Sử dụng đa dạng động từ/trạng từ mô tả xu hướng hoặc thay đổi (surge, plateau, undergo redevelopment, be converted into) và tránh lặp từ khóa đề bài."
            if writing_task == "TASK_1"
            else "Thay thế các từ phổ thông (good, bad, important, people, things) bằng collocations chuẩn xác hơn và paraphrase từ khóa đề bài."
        )
        suggestions.append(
            {
                "area": "Từ vựng & Collocations (Lexical Resource)",
                "recommendation": lex_tip + rep_note,
            }
        )

    if gra_score < 6.5 or surface["subordinator_per_100"] < 1.5 or any(m["type"] in ("grammar", "punctuation") for m in mistakes):
        gram_tip = (
            "Dùng đúng thì (quá khứ/hiện tại/tương lai) phù hợp mốc thời gian và kết hợp câu bị động (trong Process/Map) hoặc mệnh đề quan hệ."
            if writing_task == "TASK_1"
            else "Kết hợp đa dạng câu phức (although, whereas, because), mệnh đề quan hệ (which, whose) và kiểm tra viết hoa, mạo từ a/an, chia động từ."
        )
        suggestions.append(
            {
                "area": "Cấu trúc ngữ pháp (Grammatical Range & Accuracy)",
                "recommendation": gram_tip,
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "area": "Nâng cấp lên Band 7.5+",
                "recommendation": "Duy trì cấu trúc chặt chẽ, tăng cường collocations tự nhiên và đa dạng hóa cấu trúc câu phức để đạt Band cao hơn.",
            }
        )

    return " ".join(parts), suggestions


# Kho từ vựng & collocations học thuật theo 5 chủ đề phổ biến (kèm IPA, nghĩa tiếng Việt, ví dụ và ngữ cảnh dùng)
_TOPIC_VOCAB_BANK: dict[str, tuple[tuple[str, ...], list[dict[str, str]]]] = {
    "energy_environment": (
        (
            "fossil", "renewable", "solar", "wind", "carbon", "climate", "emission",
            "pollution", "ecological", "environment", "green", "energy", "coal",
            "sustainability", "decarboniz", "ecosystem", "hydroelectric",
        ),
        [
            {"word": "fossil fuel phase-out", "ipa": "/ˈfɒs.əl ˈfjuː.əl ˈfeɪz aʊt/", "meaning": "sự loại bỏ dần nhiên liệu hóa thạch", "example": "The fossil fuel phase-out requires massive financial investment in alternative power grids.", "usageContext": "Cụm này dùng để thay thế cách nói đơn giản về việc chuyển đổi năng lượng trong phần mở bài."},
            {"word": "ecological integrity", "ipa": "/ˌiː.kəˈlɒdʒ.ɪ.kəl ɪnˈteɡ.rə.ti/", "meaning": "tính toàn vẹn sinh thái", "example": "Protecting ecological integrity is the primary argument for abandoning traditional energy sources.", "usageContext": "Cụm này phục vụ việc phân tích lợi ích môi trường ở đoạn thân bài thứ nhất."},
            {"word": "carbon footprint reduction", "ipa": "/ˈkɑː.bən ˈfʊt.prɪnt rɪˈdʌk.ʃən/", "meaning": "việc giảm thiểu dấu chân carbon", "example": "Rapid carbon footprint reduction is essential to keep global temperature increases below critical thresholds.", "usageContext": "Cụm này diễn tả chính xác lợi ích sinh thái của việc phát triển năng lượng tái tạo."},
            {"word": "climate change mitigation", "ipa": "/ˈklaɪ.mət tʃeɪndʒ ˌmɪt.ɪˈɡeɪ.ʃən/", "meaning": "sự giảm nhẹ biến đổi khí hậu", "example": "Governments must prioritize climate change mitigation through aggressive solar and wind adoption.", "usageContext": "Cụm này làm rõ mục đích của quá trình chuyển đổi xanh trong đoạn thân bài đầu tiên."},
            {"word": "structural unemployment", "ipa": "/ˈstrʌk.tʃər.əl ˌʌn.ɪmˈplɔɪ.mənt/", "meaning": "thất nghiệp cơ cấu", "example": "Structural unemployment often plagues regions that depend entirely on dying mining industries.", "usageContext": "Cụm này mô tả thách thức kinh tế khi các nhà máy năng lượng truyền thống đóng cửa."},
            {"word": "socio-economic disruption", "ipa": "/ˌsəʊ.si.əʊ ˌiː.kəˈnɒm.ɪk dɪsˈrʌp.ʃən/", "meaning": "sự gián đoạn kinh tế xã hội", "example": "A hasty transition risks triggering severe socio-economic disruption in industrial towns.", "usageContext": "Cụm này khái quát các khó khăn mà cộng đồng phụ thuộc nhiên liệu hóa thạch phải gánh chịu."},
            {"word": "vocational retraining", "ipa": "/vəʊˈkeɪ.ʃən.əl ˌriːˈtreɪ.nɪŋ/", "meaning": "đào tạo lại nghề nghiệp", "example": "Comprehensive vocational retraining helps coal miners secure jobs in the solar sector.", "usageContext": "Cụm này đề xuất giải pháp cho vấn đề việc làm trong đoạn thân bài thứ hai."},
            {"word": "energy transition", "ipa": "/ˈen.ə.dʒi trænˈzɪʃ.ən/", "meaning": "quá trình chuyển dịch năng lượng", "example": "An equitable energy transition must protect vulnerable workers from poverty.", "usageContext": "Cụm này dùng xuyên suốt bài viết để chỉ chủ đề chính đang được bàn luận."},
            {"word": "sustainable development", "ipa": "/səˈsteɪ.nə.bəl dɪˈvel.əp.mənt/", "meaning": "sự phát triển bền vững", "example": "Sustainable development balances ecological preservation with long-term financial growth.", "usageContext": "Cụm này củng cố luận điểm về lợi ích kinh tế của năng lượng sạch trong phần kết bài."},
            {"word": "green subsidy", "ipa": "/ɡriːn ˈsʌb.sɪ.di/", "meaning": "khoản trợ cấp xanh", "example": "Green subsidies encourage local businesses to invest in rooftop solar panels.", "usageContext": "Cụm này nêu rõ một chính sách hỗ trợ cụ thể của chính phủ trong phần giải pháp."},
            {"word": "economic resilience", "ipa": "/ˌiː.kəˈnɒm.ɪk rɪˈzɪl.i.əns/", "meaning": "khả năng chống chịu kinh tế", "example": "Diversifying local industries builds economic resilience against commodity price shocks.", "usageContext": "Cụm này mô tả mục tiêu kinh tế lâu dài của các khu vực sau khi chuyển đổi."},
            {"word": "legacy infrastructure", "ipa": "/ˈleɡ.ə.si ˈɪn.frə.strʌk.tʃə(r)/", "meaning": "cơ sở hạ tầng cũ", "example": "Replacing legacy infrastructure requires billions of dollars in public and private funding.", "usageContext": "Cụm này chỉ các nhà máy điện than và dầu mỏ cần được thay thế."},
            {"word": "workforce displacement", "ipa": "/ˈwɜːk.fɔːs dɪsˈpleɪs.mənt/", "meaning": "tình trạng mất việc làm của lực lượng lao động", "example": "Workforce displacement remains the most contentious issue during the shift to clean energy.", "usageContext": "Cụm này thay thế cho cách diễn đạt về công nhân mất việc trong đoạn thân bài hai."},
            {"word": "environmental degradation", "ipa": "/ɪnˌvaɪ.rənˈmen.təl ˌdeɡ.rəˈdeɪ.ʃən/", "meaning": "sự suy thoái môi trường", "example": "Unchecked carbon emissions accelerate environmental degradation across the globe.", "usageContext": "Cụm này giải thích hậu quả của việc tiếp tục sử dụng nhiên liệu hóa thạch."},
            {"word": "policy intervention", "ipa": "/ˈpɒl.ə.si ˌɪn.təˈven.ʃən/", "meaning": "sự can thiệp chính sách", "example": "Active policy intervention is necessary to support communities affected by mine closures.", "usageContext": "Cụm này chỉ vai trò điều tiết của nhà nước trong việc giải quyết khủng hoảng lao động."},
            {"word": "equitable prosperity", "ipa": "/ˈek.wɪ.tə.bəl prɒsˈper.ə.ti/", "meaning": "sự thịnh vượng công bằng", "example": "Good governance ensures equitable prosperity for both urban and industrial regions.", "usageContext": "Cụm này tổng kết mục tiêu cuối cùng của chính sách phát triển bền vững."},
        ],
    ),
    "technology_ai": (
        ("technology", "artificial", "intelligence", "automation", "digital", "internet", "online", "robot", "software", "computer", "cyber"),
        [
            {"word": "technological disruption", "ipa": "/ˌtek.nəˈlɒdʒ.ɪ.kəl dɪsˈrʌp.ʃən/", "meaning": "sự xáo trộn do công nghệ", "example": "Rapid technological disruption forces workers to update their skills continuously.", "usageContext": "Dùng ở mở bài hoặc thân bài khi nói về tác động mạnh mẽ của công nghệ mới."},
            {"word": "digital literacy", "ipa": "/ˈdɪdʒ.ɪ.təl ˈlɪt.ər.ə.si/", "meaning": "năng lực sử dụng công nghệ số", "example": "Integrating digital literacy into school curricula prepares students for modern careers.", "usageContext": "Dùng để nêu giải pháp giáo dục hoặc nâng cao năng lực người lao động."},
            {"word": "human oversight", "ipa": "/ˈhjuː.mən ˈəʊ.və.saɪt/", "meaning": "sự giám sát của con người", "example": "Automated medical diagnostics still require strict human oversight to prevent critical errors.", "usageContext": "Dùng trong đoạn phản biện hoặc cân bằng giữa AI và vai trò con người."},
            {"word": "algorithmic bias", "ipa": "/ˌæl.ɡəˈrɪð.mɪk ˈbaɪ.əs/", "meaning": "thiên lệch thuật toán", "example": "Auditing datasets regularly helps minimize algorithmic bias in hiring platforms.", "usageContext": "Dùng khi phân tích rủi ro mặt trái của trí tuệ nhân tạo."},
            {"word": "productivity surge", "ipa": "/ˌprɒd.ʌkˈtɪv.ə.ti sɜːdʒ/", "meaning": "sự tăng vọt năng suất", "example": "Cloud collaboration tools triggered a measurable productivity surge across service sectors.", "usageContext": "Dùng khi phân tích lợi ích kinh tế của tự động hóa."},
            {"word": "ethical governance", "ipa": "/ˈeθ.ɪ.kəl ˈɡʌv.ən.əns/", "meaning": "quản trị theo chuẩn mực đạo đức", "example": "Clear ethical governance ensures artificial intelligence serves broad public interests.", "usageContext": "Dùng cho đoạn kiến nghị giải pháp quản lý nhà nước và kết bài."},
            {"word": "digital divide", "ipa": "/ˈdɪdʒ.ɪ.təl dɪˈvaɪd/", "meaning": "khoảng cách tiếp cận công nghệ số", "example": "Subsidized broadband narrows the digital divide between rural towns and metropolises.", "usageContext": "Dùng khi phân tích bất bình đẳng xã hội liên quan đến công nghệ."},
            {"word": "cognitive offload", "ipa": "/ˈkɒɡ.nə.tɪv ˈɒf.ləʊd/", "meaning": "sự ỷ lại nhận thức vào công cụ", "example": "Excessive cognitive offload onto chatbots can weaken students' independent writing fluency.", "usageContext": "Dùng khi phân tích tác hại tiềm ẩn của AI lên tư duy học thuật."},
        ],
    ),
    "education_work": (
        ("education", "school", "university", "student", "study", "teacher", "learning", "curriculum", "academic", "degree", "job", "career", "work", "part-time", "remote"),
        [
            {"word": "pedagogical innovation", "ipa": "/ˌped.əˈɡɒdʒ.ɪ.kəl ˌɪn.əˈveɪ.ʃən/", "meaning": "đổi mới phương pháp sư phạm", "example": "Pedagogical innovation shifts classrooms away from passive rote memorization.", "usageContext": "Dùng khi đề xuất cải tiến chất lượng giáo dục trong thân bài."},
            {"word": "critical thinking acumen", "ipa": "/ˈkrɪt.ɪ.kəl ˈθɪŋ.kɪŋ ˈæk.jʊ.mən/", "meaning": "năng lực tư duy phản biện", "example": "Seminar debates sharpen university students' critical thinking acumen.", "usageContext": "Dùng khi phân tích giá trị cốt lõi của giáo dục đại học."},
            {"word": "vocational readiness", "ipa": "/vəʊˈkeɪ.ʃən.əl ˈred.i.nəs/", "meaning": "sự sẵn sàng cho nghề nghiệp", "example": "Internships significantly strengthen graduates' vocational readiness before full-time work.", "usageContext": "Dùng khi liên kết học tập với thị trường lao động."},
            {"word": "financial autonomy", "ipa": "/faɪˈnæn.ʃəl ɔːˈtɒn.ə.mi/", "meaning": "sự tự chủ tài chính", "example": "Taking part-time work fosters early financial autonomy among undergraduates.", "usageContext": "Dùng khi phân tích lợi ích của việc đi làm thêm hoặc tự lập."},
            {"word": "educational equity", "ipa": "/ˌedʒ.ʊˈkeɪ.ʃən.əl ˈek.wə.ti/", "meaning": "công bằng trong tiếp cận giáo dục", "example": "Need-based scholarships advance educational equity across low-income districts.", "usageContext": "Dùng trong câu luận điểm hoặc kết luận về chính sách học phí."},
            {"word": "experiential learning", "ipa": "/ɪkˌspɪə.riˈen.ʃəl ˈlɜː.nɪŋ/", "meaning": "học tập qua trải nghiệm thực tế", "example": "Laboratory projects and fieldwork exemplify experiential learning.", "usageContext": "Dùng khi giải thích lợi ích thực hành ngoài sách vở."},
            {"word": "time-management proficiency", "ipa": "/taɪm ˈmæn.ɪdʒ.mənt prəˈfɪʃ.ən.si/", "meaning": "kỹ năng quản lý thời gian thành thạo", "example": "Balancing lectures with shifts cultivates strong time-management proficiency.", "usageContext": "Dùng để nêu kỹ năng mềm đạt được qua trải nghiệm."},
            {"word": "lifelong learning", "ipa": "/ˈlaɪf.lɒŋ ˈlɜː.nɪŋ/", "meaning": "học tập suốt đời", "example": "Lifelong learning enables mid-career professionals to adapt to shifting industries.", "usageContext": "Dùng cho đoạn kết bài khi khẳng định giá trị lâu dài của tri thức."},
        ],
    ),
    "urban_transport": (
        ("transport", "traffic", "city", "urban", "suburb", "infrastructure", "commute", "road", "railway", "bus", "metro", "housing", "congestion", "public"),
        [
            {"word": "urban congestion", "ipa": "/ˈɜː.bən kənˈdʒes.tʃən/", "meaning": "tình trạng ùn tắc đô thị", "example": "Expanding underground rail lines offers a durable remedy for urban congestion.", "usageContext": "Dùng khi mô tả vấn đề giao thông tại các thành phố lớn."},
            {"word": "sustainable mobility", "ipa": "/səˈsteɪ.nə.bəl məʊˈbɪl.ə.ti/", "meaning": "di chuyển đô thị bền vững", "example": "Protected cycling lanes and electric buses form the backbone of sustainable mobility.", "usageContext": "Dùng trong mở bài và thân bài về quy hoạch giao thông xanh."},
            {"word": "fiscal allocation", "ipa": "/ˈfɪs.kəl ˌæl.əˈkeɪ.ʃən/", "meaning": "phân bổ ngân sách nhà nước", "example": "Prudent fiscal allocation prioritizes mass transit over widening suburban highways.", "usageContext": "Dùng khi bàn về vai trò chi tiêu ngân sách của chính phủ."},
            {"word": "induced traffic demand", "ipa": "/ɪnˈdʒuːst ˈtræf.ɪk dɪˈmɑːnd/", "meaning": "nhu cầu đi xe tăng theo đường mở rộng", "example": "Wider motorways often backfire by triggering induced traffic demand within five years.", "usageContext": "Dùng làm luận điểm phản biện giải pháp mở thêm đường bộ."},
            {"word": "municipal authority", "ipa": "/mjuːˈnɪs.ɪ.pəl ɔːˈθɒr.ə.ti/", "meaning": "chính quyền đô thị", "example": "Each municipal authority should subsidize student transit passes.", "usageContext": "Dùng khi đề cập chủ thể thực thi giải pháp ở cấp thành phố."},
            {"word": "long-term dividend", "ipa": "/ˌlɒŋ.tɜːm ˈdɪv.ɪ.dend/", "meaning": "lợi ích sinh lời dài hạn", "example": "Early spending on high-speed rail yields a substantial economic long-term dividend.", "usageContext": "Dùng trong kết bài hoặc câu đánh giá chi phí–lợi ích."},
        ],
    ),
    "academic_core": (
        (),
        [
            {"word": "multifaceted phenomenon", "ipa": "/ˌmʌl.tiˈfæs.ɪ.tɪd fəˈnɒm.ɪ.nən/", "meaning": "hiện tượng đa chiều", "example": "Rapid urbanization is a multifaceted phenomenon requiring coordinated policy responses.", "usageContext": "Cụm mở bài giúp nâng cấp cách diễn đạt chung chung như 'a big issue'."},
            {"word": "empirical evidence", "ipa": "/ɪmˈpɪr.ɪ.kəl ˈev.ɪ.dəns/", "meaning": "bằng chứng thực nghiệm", "example": "Policymakers should anchor major reforms in verifiable empirical evidence.", "usageContext": "Dùng khi nhấn mạnh tính xác thực của lập luận trong thân bài."},
            {"word": "unintended consequence", "ipa": "/ˌʌn.ɪnˈten.dɪd ˈkɒn.sɪ.kwəns/", "meaning": "hệ quả ngoài ý muốn", "example": "Strict bans without transition aid often trigger unintended consequences for families.", "usageContext": "Dùng khi viết câu nhượng bộ hoặc phân tích mặt trái."},
            {"word": "mitigating measure", "ipa": "/ˈmɪt.ɪ.ɡeɪ.tɪŋ ˈmeʒ.ər/", "meaning": "biện pháp giảm thiểu", "example": "Targeted grants serve as an effective mitigating measure against rising costs.", "usageContext": "Dùng trong đoạn nêu giải pháp hoặc phản biện."},
            {"word": "long-term viability", "ipa": "/ˌlɒŋ.tɜːm ˌvaɪ.əˈbɪl.ə.ti/", "meaning": "tính khả thi dài hạn", "example": "Financial discipline guarantees the long-term viability of public welfare schemes.", "usageContext": "Dùng ở đoạn kết để củng cố tính bền vững của quan điểm."},
            {"word": "coordinated intervention", "ipa": "/kəʊˈɔː.dɪ.neɪ.tɪd ˌɪn.təˈven.ʃən/", "meaning": "sự can thiệp đồng bộ", "example": "Meaningful progress demands coordinated intervention from both schools and families.", "usageContext": "Dùng khi kết luận vai trò phối hợp của các bên liên quan."},
        ],
    ),
}

# Kho mẫu câu nâng cấp ví dụ chung chung thành dẫn chứng định lượng cụ thể (từ khóa -> câu viết lại, nhận xét, cách sửa)
_CONCRETE_EXAMPLE_BANK: list[tuple[tuple[str, ...], str, str, str]] = [
    (
        ("northern european", "european nations", "nordic", "renewable", "solar", "wind", "fossil", "carbon", "coal", "decarboniz"),
        "For instance, Germany has successfully transitioned its Ruhr valley by shutting down coal mines while lowering regional carbon emissions by thirty percent over the past decade.",
        "Ví dụ này chỉ nhắc chung chung đến một khu vực rộng mà không nêu tên một quốc gia hoặc địa phương cụ thể cùng số liệu xác thực, làm giảm sức thuyết phục của lập luận.",
        "Cần thay thế bằng một ví dụ cụ thể về một quốc gia hoặc khu vực cụ thể cùng với thành tựu đo lường được (ví dụ: Đức giảm 30% lượng phát thải tại vùng Ruhr).",
    ),
    (
        ("public transport", "transit", "railway", "metro", "traffic", "congestion", "commuter"),
        "For instance, Singapore curtailed peak-hour road congestion by over twenty percent after integrating electronic road pricing with extensive MRT metro expansion.",
        "Ví dụ hiện tại còn mang tính khái quát chung thay vì chỉ rõ một thành phố cụ thể và mức độ cải thiện có thể kiểm chứng.",
        "Hãy trích dẫn một đô thị điển hình (như Singapore hoặc Copenhagen) kèm số liệu cụ thể về tỷ lệ giảm ùn tắc hoặc tăng người đi tàu.",
    ),
    (
        ("school", "student", "university", "education", "part-time", "online learning", "digital", "ai"),
        "For example, a 2023 OECD survey showed that students spending under ten hours weekly on guided internships improved time-management scores by roughly fifteen percent without GPA loss.",
        "Dẫn chứng hiện còn chung chung về nhóm đối tượng học sinh/sinh viên mà chưa gắn với nguồn khảo sát hoặc con số cụ thể.",
        "Nên bổ sung bối cảnh cụ thể (quốc gia, báo cáo OECD/UNESCO hoặc mốc số liệu rõ ràng) để tăng tính thuyết phục cho Task Response.",
    ),
]


def _build_suggested_vocabulary(
    prompt: str,
    essay: str,
    writing_task: str = "TASK_2",
    limit: int = 16,
) -> list[dict[str, str]]:
    """Chọn tối đa `limit` từ vựng/collocation học thuật phù hợp nhất với chủ đề của đề bài và bài viết."""
    combined = f"{prompt or ''} {essay or ''}".lower()
    ranked_domains: list[tuple[int, str]] = []
    # Xếp hạng chủ đề theo số lượng từ khóa khớp với (prompt + essay), luôn bổ sung nhóm academic_core
    for dom_name, (keywords, _) in _TOPIC_VOCAB_BANK.items():
        if not keywords:
            continue
        hits = sum(1 for kw in keywords if kw in combined)
        if hits > 0:
            ranked_domains.append((hits, dom_name))
    ranked_domains.sort(reverse=True)

    selected: list[dict[str, str]] = []
    seen_words: set[str] = set()
    domain_order = [dom for _, dom in ranked_domains] + ["academic_core"]
    for dom in domain_order:
        for item in _TOPIC_VOCAB_BANK[dom][1]:
            w_key = item["word"].lower()
            if w_key in seen_words:
                continue
            seen_words.add(w_key)
            selected.append(dict(item))
            if len(selected) >= limit:
                return selected
    return selected


def _find_example_upgrade_and_rewrite(
    prompt: str,
    essay_str: str,
    base_revised_text: str,
    sentences: list[str],
    tr_score: float,
    writing_task: str,
    is_off_topic: bool,
) -> tuple[Optional[dict[str, str]], str, int]:
    """Tìm câu ví dụ còn chung chung (thiếu số liệu/địa danh) để gợi ý viết lại cụ thể hơn và tạo `correctedText` hoàn chỉnh."""
    clean_base = (base_revised_text or essay_str).replace("\ufffd", "—").strip()
    if is_off_topic or count_ielts_words(essay_str) < 20 or writing_task == "TASK_1":
        final_rev = clean_base if clean_base != essay_str.replace("\ufffd", "—").strip() else ""
        return None, final_rev, count_ielts_words(final_rev) if final_rev else 0

    example_trigger_re = re.compile(r"\b(?:for\s+instance|for\s+example|such\s+as)\b", re.IGNORECASE)
    vague_entity_re = re.compile(
        r"\b(?:northern\s+european\s+nations|many\s+countries|several\s+countries|some\s+nations|"
        r"many\s+cities|some\s+schools|many\s+people|various\s+industries|developing\s+nations)\b",
        re.IGNORECASE,
    )
    has_metric_re = re.compile(r"(?:\b\d+(?:[.,]\d+)?%?\b|\bpercent\b|\bmillion\b|\bbillion\b)", re.IGNORECASE)

    # Tìm câu chứa tín hiệu nêu ví dụ nhưng thiếu số liệu định lượng cụ thể
    candidate_sent: Optional[str] = None
    for sent in sentences:
        clean_sent = sent.strip()
        if len(clean_sent.split()) < 10:
            continue
        if (example_trigger_re.search(clean_sent) or vague_entity_re.search(clean_sent)) and not has_metric_re.search(clean_sent):
            candidate_sent = clean_sent
            break

    highlight: Optional[dict[str, str]] = None
    if candidate_sent and tr_score <= 8.0:
        cand_and_prompt = f"{prompt or ''} {candidate_sent}".lower()
        chosen_rewrite = ""
        critique_msg = ""
        fix_msg = ""
        for kws, rw, crit, fix in _CONCRETE_EXAMPLE_BANK:
            if any(kw in cand_and_prompt for kw in kws):
                chosen_rewrite = rw
                critique_msg = crit
                fix_msg = fix
                break
        if not chosen_rewrite:
            chosen_rewrite = (
                "For instance, a national policy report in Germany recorded measurable improvements exceeding "
                "twenty percent within five years after targeted reforms were enacted."
            )
            critique_msg = (
                "Ví dụ hiện tại còn mang tính khái quát chung, chưa nêu rõ địa điểm/chủ thể cụ thể hoặc số liệu kiểm chứng."
            )
            fix_msg = (
                "Nên thay thế bằng một ví dụ cụ thể gắn với quốc gia, tổ chức hoặc tỷ lệ cải thiện đo lường được."
            )

        highlight = {
            "inEssay": candidate_sent.replace("\ufffd", "—"),
            "rewritten": chosen_rewrite,
            "critique": critique_msg,
            "howToFix": fix_msg,
        }
        cand_norm = candidate_sent.replace("\ufffd", "—")
        if cand_norm in clean_base:
            clean_base = clean_base.replace(cand_norm, chosen_rewrite, 1)
        elif candidate_sent in clean_base:
            clean_base = clean_base.replace(candidate_sent, chosen_rewrite, 1)

    has_diff = bool(highlight) or (base_revised_text.strip() != essay_str.strip())
    if not has_diff:
        clean_out = clean_base
    else:
        clean_out = clean_base
    return highlight, clean_out, count_ielts_words(clean_out)


def _build_criteria_details(
    writing_task: str,
    writing_subtype: str,
    tr_score: float,
    cc_score: float,
    lr_score: float,
    gra_score: float,
    is_off_topic: bool,
    surface: dict[str, Any],
    mistakes: list[dict[str, str]],
    tr_highlight: Optional[dict[str, str]],
) -> dict[str, dict[str, Any]]:
    """Tạo đánh giá chi tiết tiếng Việt cho từng tiêu chí (TR/TA, CC, LR, GRA) kèm mục tiêu lên band kế tiếp và highlight lỗi."""
    tr_code = "TA" if writing_task == "TASK_1" else "TR"
    tr_name = "Task Achievement" if writing_task == "TASK_1" else "Task Response"

    tr_band_i = int(round(tr_score))
    cc_band_i = int(round(cc_score))
    lr_band_i = int(round(lr_score))
    gra_band_i = int(round(gra_score))

    # 1. Nhận xét và lời khuyên nâng band cho tiêu chí Nội dung / Đáp ứng đề (TR hoặc TA)
    if is_off_topic:
        tr_summary = "Bài viết chưa bám sát trọng tâm câu hỏi hoặc chưa đảm bảo ngôn ngữ tiếng Anh học thuật, khiến mức độ hoàn thành yêu cầu đề bị giới hạn."
    elif tr_band_i >= 8:
        tr_summary = "Bài viết giải quyết toàn diện và sâu sắc các yêu cầu của đề bài với lập trường nhất quán, các luận điểm được triển khai đầy đủ cùng dẫn chứng thuyết phục."
    elif tr_band_i == 7:
        tr_summary = (
            "Bài viết giải quyết đầy đủ các phần của đề bài với quan điểm rõ ràng và lập luận mạch lạc. "
            + (
                "Tuy nhiên, phần triển khai ví dụ minh họa còn mang tính chung chung, chưa đủ chi tiết định lượng để đạt mức độ phát triển sâu sắc của band 8."
                if tr_highlight
                else "Tuy nhiên, một số ý mở rộng hoặc số liệu đối chiếu có thể đào sâu thêm để đạt mức band 8."
            )
        )
    elif tr_band_i == 6:
        tr_summary = "Bài viết đề cập được các yêu cầu chính của đề nhưng độ sâu phát triển ý và độ cụ thể của dẫn chứng giữa các phần còn chưa đồng đều."
    else:
        tr_summary = "Bài viết mới chỉ chạm bề nổi yêu cầu đề hoặc chưa đáp ứng ngưỡng độ dài tối thiểu; cần bổ sung luận điểm trọng tâm và ví dụ cụ thể."

    if tr_band_i >= 9:
        tr_advice = "Duy trì khả năng phân tích sắc bén, bao quát trọn vẹn mọi khía cạnh đề bài với ví dụ thực chứng chính xác."
    elif tr_band_i >= 7:
        tr_advice = "Đoạn này cần đưa ra các ví dụ thực tế cụ thể (tên quốc gia, tổ chức, năm hoặc tỷ lệ %) để chứng minh cho các luận điểm."
    else:
        tr_advice = "Đọc kỹ mọi vế câu hỏi, đảm bảo đủ độ dài mục tiêu và mỗi luận điểm đều có giải thích nguyên nhân–kết quả kèm ví dụ minh họa."

    # 2. Nhận xét và lời khuyên nâng band cho tiêu chí Mạch lạc & Liên kết (CC)
    para_count = surface["paragraph_count"]
    dm_unique = surface["discourse_markers_unique"]
    if cc_band_i >= 8:
        cc_summary = (
            f"Thông tin và ý tưởng được sắp xếp hợp lý ({para_count} đoạn) với sự tiến triển rõ ràng trong toàn bộ bài viết. "
            f"Các phương tiện liên kết ({dm_unique} nhóm từ nối) được sử dụng linh hoạt và tự nhiên, giúp người đọc dễ dàng theo dõi mạch văn."
        )
        cc_advice = "Đoạn này cần duy trì sự mạch lạc, sử dụng phép quy chiếu tự nhiên và cấu trúc đoạn văn rõ ràng này trong các bài viết tiếp theo để giữ vững mức điểm cao."
    elif cc_band_i == 7:
        cc_summary = f"Bố cục bài viết phân đoạn hợp lý ({para_count} đoạn) và mạch ý nhìn chung trôi chảy; tuy nhiên một vài đoạn chuyển tiếp có thể liên kết mượt mà hơn."
        cc_advice = "Sử dụng linh hoạt phép quy chiếu đại từ/từ đồng nghĩa thay cho từ nối đầu câu lặp lại để nâng mạch lạc lên Band 8."
    else:
        cc_summary = f"Bài viết có {para_count} đoạn và {dm_unique} nhóm từ nối; mạch triển khai ý giữa các câu/đoạn còn đôi chỗ rời rạc."
        cc_advice = "Chia tách rõ bố cục Mở bài – Thân bài – Kết bài và đặt Topic Sentence rõ ràng ở đầu mỗi đoạn."

    # 3. Nhận xét và lời khuyên nâng band cho tiêu chí Từ vựng (LR)
    ttr = surface["lexical_diversity_ttr"]
    vocab_mistakes = [m for m in mistakes if m.get("type") == "vocabulary"]
    if lr_band_i >= 8:
        lr_summary = (
            f"Bài viết sử dụng vốn từ vựng phong phú, đa dạng (TTR={ttr:.2f}), linh hoạt và chính xác để truyền đạt ý nghĩa một cách tinh tế. "
            "Việc sử dụng các cụm từ nâng cao và collocation diễn ra tự nhiên, chỉ có rất ít điểm nhỏ có thể tinh chỉnh thêm."
        )
        lr_advice = "Tiếp tục duy trì độ chính xác khi lựa chọn từ vựng học thuật và collocations tự nhiên theo đúng văn phong chủ đề."
    elif lr_band_i == 7:
        lr_summary = "Vốn từ vựng đủ rộng để diễn đạt linh hoạt với một số collocations học thuật tốt; đôi chỗ vẫn có thể dùng từ đồng nghĩa chính xác hơn."
        lr_advice = "Hạn chế lặp lại từ khóa gốc và thay thế các tính từ/động từ phổ thông bằng cụm từ học thuật chuyên biệt theo chủ đề."
    else:
        lr_summary = "Vốn từ nhìn chung truyền tải được ý cơ bản nhưng độ đa dạng và độ chuẩn xác trong kết hợp từ (collocation) còn hạn chế."
        lr_advice = "Mở rộng bộ từ vựng gợi ý theo chủ đề bên dưới, ưu tiên collocations chuẩn xác và tránh lỗi chính tả."

    # 4. Nhận xét và lời khuyên nâng band cho tiêu chí Ngữ pháp (GRA)
    gra_mistakes = [m for m in mistakes if m.get("type") in ("grammar", "punctuation", "spelling")]
    if gra_band_i >= 8:
        gra_summary = (
            "Bài viết sử dụng đa dạng các cấu trúc ngữ pháp phức tạp (câu ghép, mệnh đề quan hệ, nhượng bộ, bị động) một cách chính xác và linh hoạt. "
            "Hầu hết các câu đều chuẩn xác, dấu câu được kiểm soát tốt tạo nên sự trôi chảy cho văn bản."
        )
        gra_advice = "Tiếp tục phát huy sự chuẩn xác và đa dạng trong cấu trúc câu phức (đảo ngữ, phân từ rút gọn) để duy trì kiểm soát ngữ pháp tối đa."
    elif gra_band_i == 7:
        gra_summary = "Bài viết sử dụng được nhiều câu phức đa mệnh đề với mức độ kiểm soát tốt, dù vẫn xuất hiện một số lỗi nhỏ về mạo từ, hòa hợp chủ–vị hoặc dấu câu."
        gra_advice = "Rà soát kỹ các lỗi mạo từ, chia động từ số ít/nhiều và dấu phẩy trong câu phức để tiến tới Band 8."
    else:
        gra_summary = f"Bài viết có sử dụng câu ghép/câu phức cơ bản nhưng vẫn còn {len(gra_mistakes)} điểm cần điều chỉnh về ngữ pháp, chính tả hoặc dấu câu."
        gra_advice = "Kiểm tra lại thì động từ, hòa hợp chủ–vị, mạo từ a/an và dấu chấm câu trước khi nộp bài."

    # Đưa tối đa 2 lỗi nổi bật làm ví dụ minh họa sửa lỗi trực tiếp cho GRA và LR
    gra_highlights: list[dict[str, str]] = []
    for m in gra_mistakes[:2]:
        gra_highlights.append(
            {
                "inEssay": m["original"],
                "rewritten": m["correction"],
                "critique": m["explanation"],
                "howToFix": f"Sửa trực tiếp thành \"{m['correction']}\".",
            }
        )

    lr_highlights: list[dict[str, str]] = []
    for m in vocab_mistakes[:2]:
        lr_highlights.append(
            {
                "inEssay": m["original"],
                "rewritten": m["correction"],
                "critique": m["explanation"],
                "howToFix": f"Ưu tiên diễn đạt bằng \"{m['correction']}\".",
            }
        )

    tr_highlights: list[dict[str, str]] = [tr_highlight] if tr_highlight else []

    return {
        "TR": {
            "code": tr_code,
            "name": tr_name,
            "band": float(tr_band_i),
            "summary": tr_summary,
            "nextBand": min(9, tr_band_i + 1),
            "nextBandAdvice": tr_advice,
            "highlights": tr_highlights,
        },
        "CC": {
            "code": "CC",
            "name": "Coherence & Cohesion",
            "band": float(cc_band_i),
            "summary": cc_summary,
            "nextBand": min(9, cc_band_i + 1),
            "nextBandAdvice": cc_advice,
            "highlights": [],
        },
        "LR": {
            "code": "LR",
            "name": "Lexical Resource",
            "band": float(lr_band_i),
            "summary": lr_summary,
            "nextBand": min(9, lr_band_i + 1),
            "nextBandAdvice": lr_advice,
            "highlights": lr_highlights,
        },
        "GRA": {
            "code": "GRA",
            "name": "Grammatical Range & Accuracy",
            "band": float(gra_band_i),
            "summary": gra_summary,
            "nextBand": min(9, gra_band_i + 1),
            "nextBandAdvice": gra_advice,
            "highlights": gra_highlights,
        },
    }


def _apply_task_specific_calibrations(
    writing_task: str,
    writing_subtype: str,
    surface: dict[str, Any],
    min_words: int,
    max_words: int,
    tr_score: float,
    cc_score: float,
    lr_score: float,
    gra_score: float,
    overall_band: float,
    tr_raw: float,
    ov_raw: float,
    is_off_topic: bool,
    adjustments: list[str],
    guardrails_applied_by_model: bool,
    raw_overall_cap: Optional[float] = None,
) -> tuple[float, float, float, float, float, float, float]:
    """Áp dụng luật hiệu chỉnh độ dài, bố cục và đặc trưng thể loại riêng cho từng dạng bài (TASK_2, TASK_1, PARAGRAPH)."""
    wc = surface["word_count"]
    changed = False

    # Nhánh TASK_2: áp dụng các mốc độ dài chuẩn bài luận IELTS (<50, <120, <220 từ)
    if writing_task == "TASK_2":
        if wc < 50:
            tr_score = min(tr_score, 3.0)
            overall_band = min(overall_band, 3.5)
            adjustments.append(f"Very short essay (< 50 words, {wc}w): overall capped at 3.5.")
            changed = True
        elif wc < 120:
            tr_score = min(tr_score, 4.0)
            overall_band = min(overall_band, 4.5)
            adjustments.append(f"Short essay (< 120 words, {wc}w): overall capped at 4.5.")
            changed = True
        elif wc < 220:
            tr_score = min(tr_score, 5.0)
            overall_band = min(overall_band, 5.5)
            adjustments.append(f"Under 250-word IELTS Task 2 threshold ({wc}w): overall capped at 5.5.")
            changed = True
    # Nhánh TASK_1: thưởng sàn 6.0 nếu đủ từ và có Overview; phạt nếu thiếu Overview, thiếu số liệu/từ nối quy trình/chỉ hướng bản đồ hoặc thiếu từ (<150)
    elif writing_task == "TASK_1":
        if not is_off_topic and wc >= min_words and tr_score < 6.0 and surface["has_overview_signal"]:
            tr_score = max(tr_score, 6.0)
            cc_score = max(cc_score, 6.0)
            changed = True

        if not is_off_topic and wc >= 60:
            if not surface["has_overview_signal"]:
                tr_score = min(tr_score, 5.0)
                adjustments.append("Thiếu đoạn Overview (xu hướng/đặc điểm nổi bật) trong IELTS Task 1: Task Achievement tối đa 5.")
                changed = True
            if writing_subtype == "TASK1_DATA" and surface["data_figure_count"] < 2:
                tr_score = min(tr_score, 5.0)
                adjustments.append("Task 1 biểu đồ số liệu thiếu dẫn chứng số liệu/xu hướng cụ thể.")
                changed = True
            elif writing_subtype == "TASK1_PROCESS" and surface["sequence_marker_count"] < 2:
                cc_score = min(cc_score, 6.0)
                adjustments.append("Task 1 quy trình cần bổ sung từ nối trình tự (First, Next, Then, Finally).")
                changed = True
            elif writing_subtype == "TASK1_MAP" and surface["spatial_marker_count"] < 1:
                tr_score = min(tr_score, 6.0)
                adjustments.append("Task 1 bản đồ cần bổ sung mô tả vị trí không gian/sự thay đổi.")
                changed = True

        if changed:
            tr_score = round_to_whole_band(tr_score)
            cc_score = round_to_whole_band(cc_score)
            lr_score = round_to_whole_band(lr_score)
            gra_score = round_to_whole_band(gra_score)
            overall_band = floor_to_half_band((tr_score + cc_score + lr_score + gra_score) / 4.0)

        if wc < 40:
            tr_score = min(tr_score, 3.0)
            overall_band = min(overall_band, 3.5)
            adjustments.append(f"Bài Task 1 quá ngắn (< 40 từ, {wc}w): giới hạn điểm tổng <= 3.5.")
        elif wc < 90:
            tr_score = min(tr_score, 4.0)
            overall_band = min(overall_band, 4.5)
            adjustments.append(f"Bài Task 1 chưa đủ độ dài ({wc}/{min_words} từ): giới hạn điểm tổng <= 4.5.")
        elif wc < max(120, min_words - 15):
            tr_score = min(tr_score, 5.0)
            overall_band = min(overall_band, 5.5)
            adjustments.append(f"Bài Task 1 dưới ngưỡng tối thiểu ({wc}/{min_words} từ): giới hạn điểm tổng <= 5.5.")
    # Nhánh PARAGRAPH: hiệu chỉnh lại thang điểm từ mô hình Task 2 sang khung độ dài đoạn văn/email ngắn (không phạt oan bài 50-150 từ)
    elif writing_task == "PARAGRAPH":
        severe_floor = max(12, int(round(min_words * 0.45)))
        under_floor = max(25, int(round(min_words * 0.80)))

        if not is_off_topic and wc >= min_words:
            baseline_tr = 6.0 if (surface["prompt_coverage"] >= 0.35 or not surface["has_prompt"]) else 5.0
            tr_score = max(tr_score, baseline_tr)
            if wc <= max_words + 40 and surface["discourse_markers_unique"] >= 1:
                cc_score = max(cc_score, 6.0)
            lr_score = max(lr_score, 5.0 if surface["lexical_diversity_ttr"] >= 0.4 else 4.0)
            gra_score = max(gra_score, 5.0 if surface["sentence_count"] >= 3 else 4.0)
            changed = True

        if not is_off_topic and wc >= severe_floor and writing_subtype == "PARAGRAPH_EMAIL":
            if not surface["has_email_greeting"] or not surface["has_email_signoff"]:
                tr_score = min(tr_score, 5.0)
                cc_score = min(cc_score, 6.0)
                adjustments.append("Email ngắn thiếu lời chào mở đầu hoặc lời kết thư phù hợp.")
                changed = True

        if changed:
            tr_score = round_to_whole_band(tr_score)
            cc_score = round_to_whole_band(cc_score)
            lr_score = round_to_whole_band(lr_score)
            gra_score = round_to_whole_band(gra_score)
            overall_band = floor_to_half_band((tr_score + cc_score + lr_score + gra_score) / 4.0)

        if wc < severe_floor:
            tr_score = min(tr_score, 3.0)
            overall_band = min(overall_band, 3.5)
            adjustments.append(f"Đoạn văn quá ngắn ({wc}/{min_words}–{max_words} từ): giới hạn điểm tổng <= 3.5.")
        elif wc < under_floor:
            tr_score = min(tr_score, 4.0)
            overall_band = min(overall_band, 5.0)
            adjustments.append(f"Đoạn văn thiếu độ dài ({wc}/{min_words}–{max_words} từ): giới hạn điểm tổng <= 5.0.")
        elif wc < min_words:
            tr_score = min(tr_score, 5.0)
            overall_band = min(overall_band, 5.5)
            adjustments.append(f"Đoạn văn hơi ngắn so với mục tiêu {min_words}–{max_words} từ.")

    if raw_overall_cap is not None and writing_task == "TASK_2" and guardrails_applied_by_model:
        overall_band = min(overall_band, floor_to_half_band(raw_overall_cap))

    # Chuẩn hóa lần cuối: 4 tiêu chí con là số nguyên [1..9], điểm Overall làm tròn xuống bước 0.5
    tr_score = round_to_whole_band(tr_score)
    cc_score = round_to_whole_band(cc_score)
    lr_score = round_to_whole_band(lr_score)
    gra_score = round_to_whole_band(gra_score)
    overall_band = floor_to_half_band(overall_band)

    tr_raw = tr_score if tr_score > tr_raw else min(tr_raw, tr_score)
    ov_raw = overall_band if overall_band > ov_raw else min(ov_raw, overall_band)
    return tr_score, cc_score, lr_score, gra_score, overall_band, tr_raw, ov_raw


def build_evaluation_response(
    raw_pred: dict[str, Any],
    prompt: str,
    essay: str,
    requested_model_type: str = "best",
    writing_task: str = "TASK_2",
    raw_writing_task: Optional[str] = None,
    assignment_title: Optional[str] = None,
    rubrics: Optional[str] = None,
) -> dict[str, Any]:
    """Hợp nhất kết quả dự đoán từ `WritingScorer` và phân tích ngoại tuyến thành phản hồi JSON chuẩn cho Spring Boot."""
    # 1. Phân loại Task (TASK_1 / TASK_2 / PARAGRAPH), tiểu thể loại và khung số từ mục tiêu
    norm_task = normalize_writing_task(writing_task)
    writing_subtype = detect_writing_subtype(
        writing_task=norm_task,
        raw_task=raw_writing_task or writing_task or "",
        prompt=prompt,
        assignment_title=assignment_title or "",
        rubrics=rubrics or "",
    )
    target_range = _extract_target_word_range(
        writing_task=norm_task,
        writing_subtype=writing_subtype,
        prompt=prompt,
        assignment_title=assignment_title or "",
        rubrics=rubrics or "",
    )
    # 2. Chạy chẩn đoán bề mặt, kiểm tra lạc đề/tiếng Việt/chép đề và tự động sửa lỗi chính tả/ngữ pháp
    surface = _analyze_essay_surface_and_mechanics(
        prompt,
        essay,
        writing_task=norm_task,
        writing_subtype=writing_subtype,
    )
    diag = dict(raw_pred.get("diagnostics") or {})
    adjustments = list(diag.get("rubric_adjustments") or [])

    # 3. Quy đổi điểm thô từ mô hình sang 4 tiêu chí nguyên IELTS và tính trung bình làm tròn xuống 0.5
    tr_raw = float(raw_pred.get("task_response_raw", raw_pred.get("task_response", raw_pred.get("overall_band", 5.5))))
    cc_raw = float(raw_pred.get("coherence_cohesion_raw", raw_pred.get("coherence_cohesion", raw_pred.get("overall_band", 5.5))))
    lr_raw = float(raw_pred.get("lexical_resource_raw", raw_pred.get("lexical_resource", raw_pred.get("overall_band", 5.5))))
    gra_raw = float(raw_pred.get("grammatical_range_raw", raw_pred.get("grammatical_range", raw_pred.get("overall_band", 5.5))))
    ov_raw = float(raw_pred.get("overall_band_raw", raw_pred.get("overall_band", 5.5)))

    tr_in = min(tr_raw, float(raw_pred.get("task_response", tr_raw)))
    cc_in = min(cc_raw, float(raw_pred.get("coherence_cohesion", cc_raw)))
    lr_in = min(lr_raw, float(raw_pred.get("lexical_resource", lr_raw)))
    gra_in = min(gra_raw, float(raw_pred.get("grammatical_range", gra_raw)))

    tr_score = round_to_whole_band(tr_in)
    cc_score = round_to_whole_band(cc_in)
    lr_score = round_to_whole_band(lr_in)
    gra_score = round_to_whole_band(gra_in)
    overall_band = floor_to_half_band((tr_score + cc_score + lr_score + gra_score) / 4.0)

    raw_overall_cap = (
        float(raw_pred["overall_band"])
        if adjustments and "overall_band" in raw_pred
        else None
    )

    is_off_topic = bool(
        raw_pred.get("is_off_topic", False)
        or surface["is_vietnamese_heavy"]
        or surface["is_parroting"]
    )

    # 4. Hiệu chỉnh điểm theo đặc thù Task 1 / Task 2 / Paragraph và khóa trần khi lạc đề/vi phạm ngôn ngữ
    tr_score, cc_score, lr_score, gra_score, overall_band, tr_raw, ov_raw = _apply_task_specific_calibrations(
        writing_task=norm_task,
        writing_subtype=writing_subtype,
        surface=surface,
        min_words=target_range[0],
        max_words=target_range[1],
        tr_score=tr_score,
        cc_score=cc_score,
        lr_score=lr_score,
        gra_score=gra_score,
        overall_band=overall_band,
        tr_raw=tr_raw,
        ov_raw=ov_raw,
        is_off_topic=is_off_topic,
        adjustments=adjustments,
        guardrails_applied_by_model=bool(diag.get("guardrails_applied", norm_task == "TASK_2")),
        raw_overall_cap=raw_overall_cap,
    )

    if is_off_topic:
        if tr_score > 3.0:
            tr_score = 3.0
            tr_raw = min(tr_raw, 3.0)
        if overall_band > 4.0:
            overall_band = 4.0
            ov_raw = min(ov_raw, 4.0)
        if surface["is_vietnamese_heavy"]:
            adjustments.append("Non-English / Vietnamese text detected: overall capped at 4.0.")
        elif surface["is_parroting"]:
            adjustments.append("Prompt parroting detected: overall capped at 4.0.")

    cefr = band_to_cefr(overall_band)
    overall_score_pct = int(round((overall_band / 9.0) * 100.0))
    is_passed = overall_band >= 5.0

    word_count = int(surface["word_count"] if surface["word_count"] > 0 else (raw_pred.get("word_count") or 0))

    # 5. Dựng đầy đủ phản hồi sư phạm tiếng Việt, gợi ý sửa lỗi, nâng cấp ví dụ, chi tiết 4 tiêu chí và từ vựng gợi ý
    task_achievement = _build_vietnamese_task_achievement(
        tr_score=tr_score,
        is_off_topic=is_off_topic,
        surface=surface,
        writing_task=norm_task,
        writing_subtype=writing_subtype,
        target_range=target_range,
    )
    mistakes = surface["mistakes"]
    general_feedback, suggestions = _build_vietnamese_feedback_and_suggestions(
        overall_band=overall_band,
        cefr=cefr,
        tr_score=tr_score,
        cc_score=cc_score,
        lr_score=lr_score,
        gra_score=gra_score,
        is_off_topic=is_off_topic,
        surface=surface,
        mistakes=mistakes,
        adjustments=adjustments,
        writing_task=norm_task,
        writing_subtype=writing_subtype,
        target_range=target_range,
    )

    tr_highlight, full_revised_text, revised_word_count = _find_example_upgrade_and_rewrite(
        prompt=prompt,
        essay_str=essay.strip(),
        base_revised_text=surface.get("base_revised_text", surface["corrected_text"]),
        sentences=surface.get("sentences", []),
        tr_score=tr_score,
        writing_task=norm_task,
        is_off_topic=is_off_topic,
    )
    criteria_details = _build_criteria_details(
        writing_task=norm_task,
        writing_subtype=writing_subtype,
        tr_score=tr_score,
        cc_score=cc_score,
        lr_score=lr_score,
        gra_score=gra_score,
        is_off_topic=is_off_topic,
        surface=surface,
        mistakes=mistakes,
        tr_highlight=tr_highlight,
    )
    suggested_vocab = _build_suggested_vocabulary(prompt=prompt, essay=essay, writing_task=norm_task)

    active_model_type = str(raw_pred.get("model_used") or requested_model_type or "baseline")
    examiner_tips = list((raw_pred.get("feedback") or {}).get("retrieved_examiner_tips") or [])

    return {
        "writingTask": norm_task,
        "writingSubType": writing_subtype,
        "wordCount": word_count,
        "correctedWordCount": revised_word_count,
        "isOffTopic": is_off_topic,
        "taskAchievement": task_achievement,
        "taskResponseScore": tr_score,
        "overallBand": overall_band,
        "overallScore": overall_score_pct,
        "isPassed": is_passed,
        "estimatedCefr": cefr,
        "grammarScore": gra_score,
        "vocabularyScore": lr_score,
        "coherenceScore": cc_score,
        "correctedText": full_revised_text,
        "generalFeedback": general_feedback,
        "mistakes": mistakes,
        "suggestions": suggestions,
        "criteriaDetails": criteria_details,
        "suggestedVocabulary": suggested_vocab,
        "evaluatedBy": "PYTHON_WRITING_SCORER",
        "modelType": active_model_type,
        "subcriteria": {
            "taskResponse": tr_score,
            "taskResponseRaw": round(tr_raw, 4),
            "coherenceCohesion": cc_score,
            "coherenceCohesionRaw": round(cc_raw, 4),
            "lexicalResource": lr_score,
            "lexicalResourceRaw": round(lr_raw, 4),
            "grammaticalRange": gra_score,
            "grammaticalRangeRaw": round(gra_raw, 4),
            "overallBandRaw": round(ov_raw, 4),
        },
        "diagnostics": {
            "sentenceCount": surface["sentence_count"],
            "paragraphCount": surface["paragraph_count"],
            "avgSentenceLength": surface["avg_sentence_length"],
            "lexicalDiversityTtr": surface["lexical_diversity_ttr"],
            "discourseMarkersUnique": surface["discourse_markers_unique"],
            "promptCoverage": surface["prompt_coverage"],
            "isRepetitive": surface["is_repetitive"],
            "rubricAdjustments": adjustments,
            "retrievedExaminerTips": examiner_tips,
        },
    }


def load_scorer(config: ServiceConfig) -> Any:
    """Import lười `WritingScorer` từ `infer.py` và nạp mô hình theo cấu hình dịch vụ."""
    if str(BASE_DIR) not in sys.path:
        sys.path.insert(0, str(BASE_DIR))
    from infer import WritingScorer

    return WritingScorer(
        model_dir=config.model_dir,
        model_type=config.model_type,
        device=config.device,
    )


def create_app(
    config: Optional[ServiceConfig] = None,
    scorer_instance: Any = None,
) -> FastAPI:
    """Khởi tạo ứng dụng FastAPI kèm lifespan nạp mô hình, CORS, xử lý lỗi và các route `/health`, `/api/v1/writing/evaluate`."""
    cfg = config or ServiceConfig()
    # Khóa tuần tự hóa suy luận để bảo vệ mô hình PyTorch/VRAM khi có nhiều request đồng thời
    infer_lock = threading.Lock()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        # Nạp mô hình AI một lần khi server khởi động (trừ khi đã truyền sẵn scorer_instance khi test)
        if getattr(application.state, "scorer", None) is None:
            try:
                logger.info(
                    "Loading WritingScorer (model_dir=%s, model_type=%s, device=%s)...",
                    cfg.model_dir,
                    cfg.model_type,
                    cfg.device or "auto",
                )
                application.state.scorer = load_scorer(cfg)
                application.state.load_error = None
                logger.info(
                    "WritingScorer ready (active_model_type=%s)",
                    getattr(application.state.scorer, "active_model_type", cfg.model_type),
                )
            except Exception as exc:
                application.state.scorer = None
                application.state.load_error = str(exc)
                logger.error("Failed to initialize WritingScorer: %s", exc, exc_info=True)
        yield
        logger.info("Shutting down IELTS Writing Scorer microservice...")

    application = FastAPI(
        title="IELTS & Academic Writing Scorer Microservice",
        description="Local trained Writing scoring (Task 1, Task 2, Paragraph & Email) and offline Vietnamese pedagogical feedback service.",
        version="1.1.0",
        lifespan=lifespan,
    )
    application.state.config = cfg
    application.state.scorer = scorer_instance
    application.state.load_error = None
    application.state.infer_lock = infer_lock

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Bộ xử lý ngoại lệ nghiệp vụ có cấu trúc (ServiceDomainError) trả HTTP status + code/message/suggestion
    @application.exception_handler(ServiceDomainError)
    async def handle_domain_error(request: Request, exc: ServiceDomainError):
        logger.warning("ServiceDomainError [%s] on %s: %s", exc.code, request.url.path, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": {
                    "code": exc.code,
                    "message": exc.message,
                    "suggestion": exc.suggestion,
                }
            },
        )

    # Bộ xử lý ngoại lệ hệ thống ngoài dự kiến trả HTTP 500 theo định dạng chuẩn
    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        logger.error("Unexpected error on %s: %s", request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": {
                    "code": "INTERNAL_ERROR",
                    "message": "Đã xảy ra lỗi nội bộ khi chấm bài Writing.",
                    "reason": str(exc) or "Internal processing error",
                    "suggestion": "Vui lòng thử lại sau hoặc chuyển sang dịch vụ dự phòng.",
                }
            },
        )

    # Endpoint kiểm tra trạng thái sống của service và tình trạng nạp mô hình AI
    @application.get("/health", status_code=status.HTTP_200_OK)
    async def health_check():
        scorer = getattr(application.state, "scorer", None)
        load_err = getattr(application.state, "load_error", None)
        active_type = getattr(scorer, "active_model_type", None) if scorer is not None else None
        device = cfg.device or (
            str(getattr(scorer, "torch_device", "cpu")) if scorer is not None and getattr(scorer, "torch_device", None) else "cpu"
        )
        return {
            "status": "healthy" if scorer is not None else "degraded",
            "service": "writing-scorer",
            "version": "1.0.0",
            "modelType": active_type,
            "requestedModelType": cfg.model_type,
            "device": device,
            "modelLoaded": scorer is not None,
            "supportedTasks": list(SUPPORTED_WRITING_TASKS),
            "error": load_err,
        }

    # Endpoint chính: nhận bài viết từ backend, kiểm tra hợp lệ, chạy suy luận trong threadpool và dựng phản hồi tiếng Việt
    @application.post(
        "/api/v1/writing/evaluate",
        response_model=WritingEvaluateResponse,
        status_code=status.HTTP_200_OK,
    )
    async def evaluate_writing(req: WritingEvaluateRequest):
        # Bước 1: Chuẩn hóa và xác thực dạng bài viết thuộc (TASK_1, TASK_2, PARAGRAPH)
        requested_task = normalize_writing_task(req.writing_task)
        if requested_task not in SUPPORTED_WRITING_TASKS:
            logger.info("Rejected unsupported writingTask=%r (normalized=%s)", req.writing_task, requested_task)
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "UNSUPPORTED_WRITING_TASK",
                    "message": "Local writing-scorer service only grades TASK_1, TASK_2, and PARAGRAPH writing formats.",
                    "requestedWritingTask": requested_task,
                    "supportedWritingTasks": list(SUPPORTED_WRITING_TASKS),
                },
            )

        # Bước 2: Kiểm tra nội dung bài viết không rỗng, có ký tự chữ/số và không vượt quá 30.000 ký tự
        essay_text = (req.essay_text or "").strip()
        if not essay_text or not re.search(r"[A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF]", essay_text):
            raise ServiceDomainError(
                status_code=422,
                code="INVALID_ESSAY",
                message="Nội dung bài viết không được để trống.",
                suggestion="Vui lòng nhập nội dung bài viết bằng tiếng Anh trước khi gửi chấm điểm.",
            )
        if len(essay_text) > MAX_ESSAY_CHARS:
            raise ServiceDomainError(
                status_code=422,
                code="ESSAY_TOO_LONG",
                message=f"Bài viết vượt quá giới hạn tối đa ({MAX_ESSAY_CHARS} ký tự).",
                suggestion="Vui lòng rút gọn bài viết xuống dưới 30.000 ký tự.",
            )

        # Bước 3: Kiểm tra mô hình AI đã sẵn sàng nạp trong application.state
        scorer = getattr(application.state, "scorer", None)
        if scorer is None:
            raise ServiceDomainError(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="MODEL_UNAVAILABLE",
                message="Mô hình chấm điểm Writing cục bộ chưa sẵn sàng.",
                suggestion="Vui lòng kiểm tra thư mục models/ hoặc khởi động lại writing-scorer.",
            )

        prompt_parts = [p.strip() for p in (req.topic,) if p and p.strip()]
        prompt_text = " ".join(prompt_parts)

        # Bước 4: Đưa tác vụ suy luận đồng bộ (PyTorch/LightGBM) vào threadpool với infer_lock để không block event loop async;
        # chỉ bật guardrails của Task 2 tại WritingScorer khi requested_task == "TASK_2" (TASK_1 và PARAGRAPH xử lý riêng ở bước sau)
        def _run_predict() -> dict[str, Any]:
            with infer_lock:
                return scorer.predict(
                    prompt=prompt_text,
                    essay=essay_text,
                    include_feedback=True,
                    apply_guardrails=(requested_task == "TASK_2"),
                )

        raw_pred = await run_in_threadpool(_run_predict)
        # Bước 5: Áp dụng hiệu chỉnh thang điểm theo loại bài và dựng phản hồi tiếng Việt đầy đủ
        return build_evaluation_response(
            raw_pred=raw_pred,
            prompt=prompt_text,
            essay=essay_text,
            requested_model_type=req.model_type or cfg.model_type,
            writing_task=requested_task,
            raw_writing_task=req.writing_task,
            assignment_title=req.assignment_title,
            rubrics=req.rubrics,
        )

    return application


# Khởi tạo đối tượng ASGI app mặc định để chạy trực tiếp qua uvicorn service:app
app = create_app()


def main() -> None:
    """Điểm vào CLI khởi chạy máy chủ FastAPI/Uvicorn với cấu hình host, port, model_type và device."""
    parser = argparse.ArgumentParser(description="Run IELTS Writing Task 2 FastAPI microservice.")
    parser.add_argument("--host", type=str, default=os.getenv("WRITING_SCORER_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("WRITING_SCORER_PORT", str(DEFAULT_PORT))))
    parser.add_argument(
        "--model-type",
        choices=["best", "baseline", "transformer", "hybrid"],
        default=os.getenv("WRITING_SCORER_MODEL_TYPE", "best"),
    )
    parser.add_argument(
        "--model-dir",
        type=str,
        default=os.getenv("WRITING_SCORER_MODEL_DIR", str(DEFAULT_MODEL_DIR)),
    )
    parser.add_argument(
        "--device",
        type=str,
        default=os.getenv("WRITING_SCORER_DEVICE", None),
        help="Optional device override (e.g., 'cpu' or 'cuda').",
    )
    args = parser.parse_args()

    os.environ["WRITING_SCORER_HOST"] = args.host
    os.environ["WRITING_SCORER_PORT"] = str(args.port)
    os.environ["WRITING_SCORER_MODEL_TYPE"] = args.model_type
    os.environ["WRITING_SCORER_MODEL_DIR"] = str(args.model_dir)
    if args.device:
        os.environ["WRITING_SCORER_DEVICE"] = args.device

    import uvicorn

    runtime_cfg = ServiceConfig(
        host=args.host,
        port=args.port,
        model_dir=Path(args.model_dir),
        model_type=args.model_type,
        device=args.device,
    )
    runtime_app = create_app(config=runtime_cfg)
    uvicorn.run(runtime_app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
