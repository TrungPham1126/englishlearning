import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.config import settings

logger = logging.getLogger("phonetics-service")

try:
    import parselmouth
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False


@dataclass
class UtteranceAcoustics:
    """Precomputed in-memory Praat pitch and formant objects shared across an utterance."""
    gender: str = "FEMALE"
    mean_f0: float = 180.0
    f0_std: float = 25.0
    f0_iqr: float = 30.0
    f0_range_90_10: float = 55.0
    f0_slope_abs: float = 0.0
    voiced_frame_ratio: float = 0.0
    formants: Any = None
    pitch: Any = None
    voiced_f0: List[float] = field(default_factory=list)


class FormantService:
    """
    Universal Multi-Centroid Formant Analysis Service.
    - Hỗ trợ đa phương ngữ đồng thời (US General American & UK Received Pronunciation).
    - Multi-Centroid Gaussian Distance: d_best = min(d_US, d_UK).
    - Thích ứng đồng cấu âm (Coarticulation adaptation) cho /aɪ/, /ɔɪ/, /ɪ/ trước ngạc mềm và /e/ trước r.
    - Đánh giá đặc thù cho Schwa /ə/ trong từ hư (Function words).
    """

    DIPHTHONGS = {"aʊ", "eɪ", "aɪ", "ɔɪ", "əʊ", "oʊ", "au", "ai", "ei", "oi", "ou"}

    VOWEL_NORM_MAP: Dict[str, str] = {
        "au": "a\u028a", "a\u028a": "a\u028a",
        "ai": "a\u026a", "a\u026a": "a\u026a",
        "ei": "e\u026a", "e\u026a": "e\u026a",
        "oi": "\u0254\u026a", "ɔɪ": "\u0254\u026a", "\u0254\u026a": "\u0254\u026a", "o\u026a": "\u0254\u026a",
        "ou": "o\u028a", "o\u028a": "o\u028a", "oʊ": "o\u028a", "\u0259\u028a": "o\u028a",
        "i": "i\u02d0", "i\u02d0": "i\u02d0", "iː": "i\u02d0",
        "u": "u\u02d0", "u\u02d0": "u\u02d0", "uː": "u\u02d0",
        "ʊ": "\u028a", "\u028a": "\u028a",
        "\u0251": "\u0251\u02d0", "\u0251\u02d0": "\u0251\u02d0", "ɑː": "\u0251\u02d0",
        "\u0254": "\u0254\u02d0", "\u0254\u02d0": "\u0254\u02d0", "ɔː": "\u0254\u02d0",
        "\u025c": "\u025c\u02d0", "\u025c\u02d0": "\u025c\u02d0", "ɜː": "\u025c\u02d0",
        "\u025a": "\u025a", "ɚ": "\u025a",
        "\u025b": "e", "\u0289": "u\u02d0",
        "ʌ": "\u028c", "\u028c": "\u028c",
        "ɒ": "\u0251\u02d0",
    }

    MULTI_CENTROID_PROFILES: Dict[str, Dict[str, List[dict]]] = {
        # ── 1. THOUGHT / CLOTH / NORTH (/ɔː/ - across, water, thought, dog) ──
        "\u0254\u02d0": {
            "MALE": [
                {"name": "THOUGHT [ɔː] Back Rounded (US/UK)", "mean": [580.0, 950.0], "std": [75.0, 160.0], "cov": [[5625.0, 0.0], [0.0, 25600.0]]},
                {"name": "CLOTH [ɒː]/[ɑː] Open (across)", "mean": [665.0, 1120.0], "std": [80.0, 170.0], "cov": [[6400.0, 0.0], [0.0, 28900.0]]}
            ],
            "FEMALE": [
                {"name": "THOUGHT [ɔː] Back Rounded (US/UK)", "mean": [660.0, 1050.0], "std": [85.0, 180.0], "cov": [[7225.0, 0.0], [0.0, 32400.0]]},
                {"name": "CLOTH [ɒː]/[ɑː] Open (across)", "mean": [740.0, 1220.0], "std": [90.0, 190.0], "cov": [[8100.0, 0.0], [0.0, 36100.0]]}
            ]
        },
        # ── 2. CHOICE (/ɔɪ/ - boy, choice, noise) ─────────────────────────────
        "\u0254\u026a": {
            "MALE": [
                {"name": "CHOICE Standard [ɔɪ]", "mean": [520.0, 1050.0], "std": [85.0, 180.0], "cov": [[7225.0, 0.0], [0.0, 32400.0]]},
                {"name": "CHOICE Coarticulated [oɪ] (boy, choice, noise)", "mean": [400.0, 780.0], "std": [100.0, 240.0], "cov": [[10000.0, 0.0], [0.0, 57600.0]]}
            ],
            "FEMALE": [
                {"name": "CHOICE Standard [ɔɪ]", "mean": [590.0, 1180.0], "std": [90.0, 190.0], "cov": [[8100.0, 0.0], [0.0, 36100.0]]},
                {"name": "CHOICE Coarticulated [oɪ] (boy, choice, noise)", "mean": [470.0, 900.0], "std": [110.0, 250.0], "cov": [[12100.0, 0.0], [0.0, 62500.0]]}
            ]
        },
        # ── 3. PRICE (/aɪ/ - quiet, while, thinking, time) ───────────────────
        "a\u026a": {
            "MALE": [
                {"name": "PRICE Standard Onset [aɪ]", "mean": [680.0, 1400.0], "std": [80.0, 180.0], "cov": [[6400.0, 0.0], [0.0, 32400.0]]},
                {"name": "PRICE Backed Onset [ɑɪ] (/w/, /l/ coarticulation)", "mean": [600.0, 880.0], "std": [100.0, 230.0], "cov": [[10000.0, 0.0], [0.0, 52900.0]]}
            ],
            "FEMALE": [
                {"name": "PRICE Standard Onset [aɪ]", "mean": [780.0, 1600.0], "std": [90.0, 200.0], "cov": [[8100.0, 0.0], [0.0, 40000.0]]},
                {"name": "PRICE Backed Onset [ɑɪ] (/w/, /l/ coarticulation)", "mean": [700.0, 1020.0], "std": [110.0, 250.0], "cov": [[12100.0, 0.0], [0.0, 62500.0]]}
            ]
        },
        # ── 4. KIT (/ɪ/ - in, thinking, his, with) ───────────────────────────
        "\u026a": {
            "MALE": [
                {"name": "KIT Standard [ɪ]", "mean": [400.0, 1920.0], "std": [65.0, 180.0], "cov": [[4225.0, 0.0], [0.0, 32400.0]]},
                {"name": "KIT Backed/Coarticulated (with)", "mean": [440.0, 1420.0], "std": [80.0, 220.0], "cov": [[6400.0, 0.0], [0.0, 48400.0]]},
                {"name": "KIT Pre-velar raised [i]/[ɪ] (thinking, sing, ink)", "mean": [440.0, 2420.0], "std": [75.0, 220.0], "cov": [[5625.0, 0.0], [0.0, 48400.0]]},
                {"name": "KIT High/Front (his, in)", "mean": [310.0, 2020.0], "std": [60.0, 180.0], "cov": [[3600.0, 0.0], [0.0, 32400.0]]}
            ],
            "FEMALE": [
                {"name": "KIT Standard [ɪ]", "mean": [480.0, 2250.0], "std": [75.0, 200.0], "cov": [[5625.0, 0.0], [0.0, 40000.0]]},
                {"name": "KIT Backed/Coarticulated (with)", "mean": [510.0, 1580.0], "std": [90.0, 240.0], "cov": [[8100.0, 0.0], [0.0, 57600.0]]},
                {"name": "KIT Pre-velar raised [i]/[ɪ] (thinking, sing, ink)", "mean": [500.0, 2600.0], "std": [85.0, 240.0], "cov": [[7225.0, 0.0], [0.0, 57600.0]]},
                {"name": "KIT High/Front (his, in)", "mean": [370.0, 2300.0], "std": [70.0, 200.0], "cov": [[4900.0, 0.0], [0.0, 40000.0]]}
            ]
        },
        # ── 5. STRUT (/ʌ/ - bus, young, rough, of) ───────────────────────────
        "\u028c": {
            "MALE": [
                {"name": "US STRUT [ʌ]", "mean": [640.0, 1220.0], "std": [75.0, 160.0], "cov": [[5625.0, 0.0], [0.0, 25600.0]]},
                {"name": "UK STRUT [ɐ]", "mean": [780.0, 1340.0], "std": [85.0, 170.0], "cov": [[7225.0, 0.0], [0.0, 28900.0]]},
                {"name": "Weak STRUT / Reduced [ʌ] (of, young)", "mean": [510.0, 1320.0], "std": [85.0, 170.0], "cov": [[7225.0, 0.0], [0.0, 28900.0]]}
            ],
            "FEMALE": [
                {"name": "US STRUT [ʌ]", "mean": [760.0, 1400.0], "std": [85.0, 170.0], "cov": [[7225.0, 0.0], [0.0, 28900.0]]},
                {"name": "UK STRUT [ɐ]", "mean": [880.0, 1520.0], "std": [95.0, 180.0], "cov": [[9025.0, 0.0], [0.0, 32400.0]]},
                {"name": "Weak STRUT / Reduced [ʌ] (of, young)", "mean": [600.0, 1460.0], "std": [95.0, 180.0], "cov": [[9025.0, 0.0], [0.0, 32400.0]]}
            ]
        },
        # ── 6. DRESS / SQUARE (/e/ - better, sharing, care) ──────────────────
        "e": {
            "MALE": [
                {"name": "DRESS Standard [e]", "mean": [530.0, 1680.0], "std": [70.0, 170.0], "cov": [[4900.0, 0.0], [0.0, 28900.0]]},
                {"name": "SQUARE / Pre-rhotic [e] (sharing, care)", "mean": [440.0, 1690.0], "std": [70.0, 170.0], "cov": [[4900.0, 0.0], [0.0, 28900.0]]}
            ],
            "FEMALE": [
                {"name": "DRESS Standard [e]", "mean": [610.0, 2000.0], "std": [80.0, 190.0], "cov": [[6400.0, 0.0], [0.0, 36100.0]]},
                {"name": "SQUARE / Pre-rhotic [e] (sharing, care)", "mean": [510.0, 1980.0], "std": [80.0, 190.0], "cov": [[6400.0, 0.0], [0.0, 36100.0]]}
            ]
        },
        # ── 7. LOT / PALM (/ɑː/ - dark, car, father) ─────────────────────────
        "\u0251\u02d0": {
            "MALE": [
                {"name": "US PALM [ɑ]", "mean": [730.0, 1090.0], "std": [75.0, 150.0], "cov": [[5625.0, 0.0], [0.0, 22500.0]]},
                {"name": "UK LOT/START [ɑː] (dark)", "mean": [580.0, 1060.0], "std": [75.0, 150.0], "cov": [[5625.0, 0.0], [0.0, 22500.0]]}
            ],
            "FEMALE": [
                {"name": "US PALM [ɑ]", "mean": [850.0, 1220.0], "std": [85.0, 160.0], "cov": [[7225.0, 0.0], [0.0, 25600.0]]},
                {"name": "UK LOT/START [ɑː] (dark)", "mean": [680.0, 1160.0], "std": [85.0, 160.0], "cov": [[7225.0, 0.0], [0.0, 25600.0]]}
            ]
        },
        # ── 8. GOOSE (/uː/ - food, room, huge, future) ───────────────────────
        "u\u02d0": {
            "MALE": [
                {"name": "Back GOOSE [uː] (food, room)", "mean": [330.0, 1150.0], "std": [75.0, 200.0], "cov": [[5625.0, 0.0], [0.0, 40000.0]]},
                {"name": "Fronted GOOSE [ʉː] (huge, future, you)", "mean": [350.0, 1450.0], "std": [80.0, 240.0], "cov": [[6400.0, 0.0], [0.0, 57600.0]]},
                {"name": "High Fronted GOOSE [ʉː]", "mean": [280.0, 1680.0], "std": [75.0, 220.0], "cov": [[5625.0, 0.0], [0.0, 48400.0]]}
            ],
            "FEMALE": [
                {"name": "Back GOOSE [uː] (food, room)", "mean": [390.0, 1250.0], "std": [80.0, 210.0], "cov": [[6400.0, 0.0], [0.0, 44100.0]]},
                {"name": "Fronted GOOSE [ʉː] (you, use)", "mean": [430.0, 1300.0], "std": [85.0, 220.0], "cov": [[7225.0, 0.0], [0.0, 48400.0]]},
                {"name": "Fronted GOOSE [ʉː] (huge, future)", "mean": [340.0, 1820.0], "std": [85.0, 240.0], "cov": [[7225.0, 0.0], [0.0, 57600.0]]}
            ]
        },
        # ── 9. MOUTH (/aʊ/ - loud, about, out, how) ──────────────────────────
        "a\u028a": {
            "MALE": [
                {"name": "US MOUTH Onset [aʊ]", "mean": [650.0, 1400.0], "std": [100.0, 210.0], "cov": [[10000.0, 0.0], [0.0, 44100.0]]},
                {"name": "UK MOUTH Onset [aʊ]", "mean": [720.0, 1520.0], "std": [105.0, 220.0], "cov": [[11025.0, 0.0], [0.0, 48400.0]]},
                {"name": "MOUTH Glide [ʊ]", "mean": [480.0, 1080.0], "std": [95.0, 210.0], "cov": [[9025.0, 0.0], [0.0, 44100.0]]}
            ],
            "FEMALE": [
                {"name": "US MOUTH Onset [aʊ]", "mean": [750.0, 1520.0], "std": [110.0, 240.0], "cov": [[12100.0, 0.0], [0.0, 57600.0]]},
                {"name": "UK MOUTH Onset [aʊ]", "mean": [820.0, 1720.0], "std": [115.0, 230.0], "cov": [[13225.0, 0.0], [0.0, 52900.0]]},
                {"name": "MOUTH Glide [ʊ]", "mean": [540.0, 1200.0], "std": [100.0, 220.0], "cov": [[10000.0, 0.0], [0.0, 48400.0]]}
            ]
        },
        # ── 10. TRAP / BATH (/æ/ - path, cat) ────────────────────────────────
        "\xe6": {
            "MALE": [
                {"name": "US TRAP [æ]", "mean": [680.0, 1720.0], "std": [75.0, 160.0], "cov": [[5625.0, 0.0], [0.0, 25600.0]]},
                {"name": "UK BATH [ɑː] variant", "mean": [740.0, 1200.0], "std": [80.0, 150.0], "cov": [[6400.0, 0.0], [0.0, 22500.0]]}
            ],
            "FEMALE": [
                {"name": "US TRAP [æ]", "mean": [850.0, 2050.0], "std": [85.0, 180.0], "cov": [[7225.0, 0.0], [0.0, 32400.0]]},
                {"name": "UK BATH [ɑː] variant", "mean": [820.0, 1360.0], "std": [90.0, 160.0], "cov": [[8100.0, 0.0], [0.0, 25600.0]]}
            ]
        },
        # ── 11. FACE (/eɪ/ - plays, game) ────────────────────────────────────
        "e\u026a": {
            "MALE": [{"name": "FACE Onset [eɪ]", "mean": [490.0, 1850.0], "std": [75.0, 190.0], "cov": [[5625.0, 0.0], [0.0, 36100.0]]}],
            "FEMALE": [{"name": "FACE Onset [eɪ]", "mean": [570.0, 2200.0], "std": [85.0, 210.0], "cov": [[7225.0, 0.0], [0.0, 44100.0]]}]
        },
        # ── 12. NURSE / ER (/ɚ/, /ɜː/ - better, future) ──────────────────────
        "\u025a": {
            "MALE": [{"name": "NURSE / ER [ɚ]", "mean": [480.0, 1380.0], "std": [80.0, 180.0], "cov": [[6400.0, 0.0], [0.0, 32400.0]]}],
            "FEMALE": [{"name": "NURSE / ER [ɚ]", "mean": [540.0, 1550.0], "std": [90.0, 200.0], "cov": [[8100.0, 0.0], [0.0, 40000.0]]}]
        },
        "\u025c\u02d0": {
            "MALE": [{"name": "NURSE [ɜː]", "mean": [500.0, 1400.0], "std": [80.0, 180.0], "cov": [[6400.0, 0.0], [0.0, 32400.0]]}],
            "FEMALE": [{"name": "NURSE [ɜː]", "mean": [560.0, 1600.0], "std": [90.0, 200.0], "cov": [[8100.0, 0.0], [0.0, 40000.0]]}]
        },
        # ── 13. SCHWA (/ə/ - a, the, about, across) ──────────────────────────
        "\u0259": {
            "MALE": [
                {"name": "Schwa Central [ə]", "mean": [500.0, 1450.0], "std": [95.0, 260.0], "cov": [[9025.0, 0.0], [0.0, 67600.0]]},
                {"name": "Schwa High/Front assimilated", "mean": [360.0, 1850.0], "std": [90.0, 260.0], "cov": [[8100.0, 0.0], [0.0, 67600.0]]},
                {"name": "Schwa Low/Open assimilated", "mean": [640.0, 1350.0], "std": [95.0, 240.0], "cov": [[9025.0, 0.0], [0.0, 57600.0]]}
            ],
            "FEMALE": [
                {"name": "Schwa Central [ə]", "mean": [580.0, 1650.0], "std": [105.0, 280.0], "cov": [[11025.0, 0.0], [0.0, 78400.0]]},
                {"name": "Schwa High/Front assimilated", "mean": [420.0, 2100.0], "std": [100.0, 280.0], "cov": [[10000.0, 0.0], [0.0, 78400.0]]},
                {"name": "Schwa Low/Open assimilated", "mean": [720.0, 1500.0], "std": [105.0, 260.0], "cov": [[11025.0, 0.0], [0.0, 67600.0]]}
            ]
        },
        # ── 14. FLEECE (/iː/ - see, fundamentally, reshaped, methodologies) ─────
        "i\u02d0": {
            "MALE": [
                {"name": "FLEECE Standard [iː]", "mean": [280.0, 2250.0], "std": [55.0, 220.0], "cov": [[3025.0, 0.0], [0.0, 48400.0]]},
                {"name": "FLEECE Fronted/High [iː] (be, he, see)", "mean": [240.0, 2350.0], "std": [50.0, 220.0], "cov": [[2500.0, 0.0], [0.0, 48400.0]]},
                {"name": "happY Weak/Coda [i] (fundamentally, reshaped)", "mean": [300.0, 1950.0], "std": [65.0, 260.0], "cov": [[4225.0, 0.0], [0.0, 67600.0]]}
            ],
            "FEMALE": [
                {"name": "FLEECE Standard [iː]", "mean": [330.0, 2750.0], "std": [65.0, 240.0], "cov": [[4225.0, 0.0], [0.0, 57600.0]]},
                {"name": "FLEECE Fronted/High [iː] (be, he, see)", "mean": [280.0, 2850.0], "std": [60.0, 240.0], "cov": [[3600.0, 0.0], [0.0, 57600.0]]},
                {"name": "happY Weak/Coda [i] (fundamentally, reshaped)", "mean": [360.0, 2450.0], "std": [75.0, 280.0], "cov": [[5625.0, 0.0], [0.0, 78400.0]]}
            ]
        },
        # ── 15. GOAT (/oʊ/ - no, go, methodologies) ──────────────────────────
        "o\u028a": {
            "MALE": [
                {"name": "GOAT Standard Onset [oʊ]", "mean": [470.0, 1050.0], "std": [70.0, 190.0], "cov": [[4900.0, 0.0], [0.0, 36100.0]]},
                {"name": "GOAT Reduced/Mid [o] (methodologies)", "mean": [430.0, 1350.0], "std": [85.0, 250.0], "cov": [[7225.0, 0.0], [0.0, 62500.0]]}
            ],
            "FEMALE": [
                {"name": "GOAT Standard Onset [oʊ]", "mean": [540.0, 1200.0], "std": [80.0, 210.0], "cov": [[6400.0, 0.0], [0.0, 44100.0]]},
                {"name": "GOAT Reduced/Mid [o] (methodologies)", "mean": [500.0, 1500.0], "std": [95.0, 260.0], "cov": [[9025.0, 0.0], [0.0, 67600.0]]}
            ]
        },
        # ── 16. FOOT (/ʊ/ - book, put, good) ─────────────────────────────────
        "\u028a": {
            "MALE": [
                {"name": "FOOT Standard [ʊ]", "mean": [440.0, 1150.0], "std": [65.0, 180.0], "cov": [[4225.0, 0.0], [0.0, 32400.0]]}
            ],
            "FEMALE": [
                {"name": "FOOT Standard [ʊ]", "mean": [470.0, 1350.0], "std": [75.0, 200.0], "cov": [[5625.0, 0.0], [0.0, 40000.0]]}
            ]
        }
    }

    def __init__(self, profiles_path: Path = settings.VOWEL_PROFILE_PATH):
        self.profiles_path = profiles_path
        self.reference_profiles: Dict[str, dict] = {
            "iː": {"name": "FLEECE [iː]", "mean": [300.0, 2300.0], "std": [55.0, 220.0], "cov": [[3025.0, 0.0], [0.0, 48400.0]]},
            "ɪ": {"name": "KIT [ɪ]", "mean": [400.0, 1920.0], "std": [65.0, 180.0], "cov": [[4225.0, 0.0], [0.0, 32400.0]]},
            "e": {"name": "DRESS [e]", "mean": [530.0, 1680.0], "std": [70.0, 170.0], "cov": [[4900.0, 0.0], [0.0, 28900.0]]},
            "æ": {"name": "TRAP [æ]", "mean": [680.0, 1720.0], "std": [75.0, 160.0], "cov": [[5625.0, 0.0], [0.0, 25600.0]]},
            "ɑː": {"name": "PALM [ɑː]", "mean": [730.0, 1090.0], "std": [75.0, 150.0], "cov": [[5625.0, 0.0], [0.0, 22500.0]]},
            "ɔː": {"name": "THOUGHT [ɔː]", "mean": [580.0, 950.0], "std": [75.0, 160.0], "cov": [[5625.0, 0.0], [0.0, 25600.0]]},
            "ʊ": {"name": "FOOT [ʊ]", "mean": [440.0, 1150.0], "std": [65.0, 180.0], "cov": [[4225.0, 0.0], [0.0, 32400.0]]},
            "uː": {"name": "GOOSE [uː]", "mean": [330.0, 1150.0], "std": [75.0, 200.0], "cov": [[5625.0, 0.0], [0.0, 40000.0]]},
            "ʌ": {"name": "STRUT [ʌ]", "mean": [640.0, 1220.0], "std": [75.0, 160.0], "cov": [[5625.0, 0.0], [0.0, 25600.0]]},
            "ə": {"name": "SCHWA [ə]", "mean": [500.0, 1450.0], "std": [95.0, 260.0], "cov": [[9025.0, 0.0], [0.0, 67600.0]]},
        }
        self.loaded_gender_profiles: Dict[str, Dict[str, dict]] = {"MALE": {}, "FEMALE": {}, "DEFAULT": {}}
        self._load_profiles_from_disk(profiles_path)

    @staticmethod
    def _normalize_loaded_entry(sym: str, entry: dict) -> Optional[dict]:
        if not isinstance(entry, dict) or "mean" not in entry:
            return None
        std = entry.get("std", [75.0, 180.0])
        cov = entry.get("cov") or entry.get("covariance")
        if cov is None:
            cov = [[float(std[0]) ** 2, 0.0], [0.0, float(std[1]) ** 2]]
        cov_arr = np.array(cov, dtype=np.float64)
        if cov_arr.shape != (2, 2):
            cov_arr = np.array([[float(std[0]) ** 2, 0.0], [0.0, float(std[1]) ** 2]], dtype=np.float64)
        # Regularize covariance diagonal for numerical stability
        cov_arr[0, 0] = max(400.0, float(cov_arr[0, 0]))
        cov_arr[1, 1] = max(2500.0, float(cov_arr[1, 1]))
        det = cov_arr[0, 0] * cov_arr[1, 1] - cov_arr[0, 1] * cov_arr[1, 0]
        if det <= 1e-3:
            cov_arr = np.diag([cov_arr[0, 0], cov_arr[1, 1]])
        return {
            "name": entry.get("name", f"Loaded {sym}"),
            "mean": [float(entry["mean"][0]), float(entry["mean"][1])],
            "std": [max(20.0, float(std[0])), max(50.0, float(std[1]))],
            "cov": cov_arr.tolist(),
            "source": entry.get("source", "vowels.json"),
        }

    def _load_profiles_from_disk(self, profiles_path: Path) -> None:
        resolved = Path(profiles_path)
        if not resolved.is_absolute() and not resolved.exists():
            pkg_root = Path(__file__).resolve().parents[2]
            candidate = pkg_root / resolved
            if candidate.exists():
                resolved = candidate

        if not resolved.exists():
            logger.debug("Vowel profile file not found at %s; using built-in profiles.", resolved)
            return

        try:
            with open(resolved, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            accent_map = {
                "en-US-male": "MALE",
                "en-US-female": "FEMALE",
                "en-US": "DEFAULT",
            }
            for json_key, target_bucket in accent_map.items():
                section = raw_data.get(json_key)
                if not isinstance(section, dict):
                    continue
                bucket: Dict[str, dict] = {}
                for raw_sym, entry in section.items():
                    parsed = self._normalize_loaded_entry(raw_sym, entry)
                    if parsed is None:
                        continue
                    norm_sym = self.VOWEL_NORM_MAP.get(raw_sym, raw_sym)
                    bucket[norm_sym] = parsed
                    if target_bucket == "DEFAULT" and raw_sym not in self.reference_profiles:
                        self.reference_profiles[raw_sym] = parsed
                    if target_bucket == "DEFAULT" and raw_sym in self.reference_profiles:
                        # Update covariance while keeping reference_profiles entries consistent
                        self.reference_profiles[raw_sym] = {**parsed, "mean": self.reference_profiles[raw_sym]["mean"]}
                self.loaded_gender_profiles[target_bucket] = bucket

            logger.info(
                "Loaded empirical vowel profiles from %s (male=%d, female=%d, default=%d).",
                resolved,
                len(self.loaded_gender_profiles["MALE"]),
                len(self.loaded_gender_profiles["FEMALE"]),
                len(self.loaded_gender_profiles["DEFAULT"]),
            )
        except Exception as ex:
            logger.warning("Failed to load vowel profiles from %s: %s", resolved, ex)

    def extract_utterance_acoustics(
        self,
        audio: np.ndarray,
        sample_rate: int = settings.SAMPLE_RATE,
        gender: Optional[str] = None,
    ) -> UtteranceAcoustics:
        """
        Extracts Praat Pitch and Formant Burg objects once per utterance in memory,
        eliminating temporary WAV file disk I/O and redundant per-vowel Praat calls.
        """
        if not HAS_PARSELMOUTH or len(audio) < int(sample_rate * 0.05):
            return UtteranceAcoustics()

        try:
            sound = parselmouth.Sound(audio, sampling_frequency=float(sample_rate))
            pitch = sound.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=500.0)
            pitch_values = pitch.selected_array["frequency"]
            voiced = [
                float(v) for v in pitch_values
                if v is not None and not np.isnan(v) and not np.isinf(v) and v > 0.0
            ]
            if voiced:
                mean_f0 = float(np.mean(voiced))
                f0_std = float(np.std(voiced))
                f0_iqr = float(np.percentile(voiced, 75) - np.percentile(voiced, 25)) if len(voiced) >= 4 else f0_std * 1.35
                f0_range_90_10 = float(np.percentile(voiced, 90) - np.percentile(voiced, 10)) if len(voiced) >= 5 else f0_std * 2.5
                f0_slope_abs = float(np.mean(np.abs(np.diff(voiced)))) if len(voiced) >= 2 else 0.0
            else:
                mean_f0, f0_std, f0_iqr, f0_range_90_10, f0_slope_abs = 180.0, 20.0, 25.0, 45.0, 0.0

            voiced_ratio = float(len(voiced)) / max(1.0, float(len(pitch_values)))
            detected_gender = gender or ("FEMALE" if mean_f0 >= 165.0 else "MALE")
            self._last_mean_f0 = float(mean_f0)

            max_formant_freq = 5500.0 if detected_gender == "FEMALE" else 5000.0
            formants = sound.to_formant_burg(
                time_step=0.008,
                max_number_of_formants=5.0,
                maximum_formant=max_formant_freq,
                window_length=0.025,
            )
            return UtteranceAcoustics(
                gender=detected_gender,
                mean_f0=mean_f0,
                f0_std=f0_std,
                f0_iqr=f0_iqr,
                f0_range_90_10=f0_range_90_10,
                f0_slope_abs=f0_slope_abs,
                voiced_frame_ratio=voiced_ratio,
                formants=formants,
                pitch=pitch,
                voiced_f0=voiced,
            )
        except Exception as ex:
            logger.warning("Utterance acoustics extraction failed: %s", ex)
            return UtteranceAcoustics()

    def detect_gender(self, audio: np.ndarray, sample_rate: int = settings.SAMPLE_RATE) -> Tuple[str, float]:
        if not HAS_PARSELMOUTH or len(audio) == 0:
            return "FEMALE", 200.0

        try:
            sound = parselmouth.Sound(audio, sampling_frequency=sample_rate)
            pitch = sound.to_pitch()
            mean_f0 = parselmouth.praat.call(pitch, "Get mean", 0, 0, "Hertz")
            if mean_f0 is None or np.isnan(mean_f0) or np.isinf(mean_f0) or mean_f0 <= 0:
                mean_f0 = 180.0
            gender = "FEMALE" if mean_f0 >= 165.0 else "MALE"
            self._last_mean_f0 = float(mean_f0)
            return gender, float(mean_f0)
        except Exception:
            self._last_mean_f0 = 180.0
            return "FEMALE", 180.0

    def _get_target_profile(
        self,
        clean_sym: str,
        gender: str,
        is_fronted_u: bool = False
    ) -> Optional[dict]:
        centroids = self._get_target_centroids(clean_sym, gender, is_fronted_u=is_fronted_u)
        if is_fronted_u and len(centroids) >= 2:
            return centroids[1]
        return centroids[0] if centroids else None

    def _get_target_centroids(
        self,
        clean_sym: str,
        gender: str,
        is_fronted_u: bool = False
    ) -> List[dict]:
        norm_sym = self.VOWEL_NORM_MAP.get(clean_sym, clean_sym)
        combined: List[dict] = []

        centroids_by_sym = self.MULTI_CENTROID_PROFILES.get(norm_sym) or self.MULTI_CENTROID_PROFILES.get(clean_sym)
        if centroids_by_sym:
            combined.extend(list(centroids_by_sym.get(gender, [])))
            last_f0 = getattr(self, "_last_mean_f0", 165.0)
            if 145.0 <= last_f0 <= 185.0:
                alt_gender = "MALE" if gender == "FEMALE" else "FEMALE"
                combined.extend(list(centroids_by_sym.get(alt_gender, [])))

        # Include empirically calibrated continuous-speech profiles loaded from vowels.json
        for g_key in (gender, "DEFAULT"):
            loaded = self.loaded_gender_profiles.get(g_key, {}).get(norm_sym) or self.loaded_gender_profiles.get(g_key, {}).get(clean_sym)
            if loaded:
                combined.append(loaded)

        if combined:
            return combined

        ref = self.reference_profiles.get(norm_sym) or self.reference_profiles.get(clean_sym)
        if ref:
            return [ref]

        default_mean = [550.0, 1400.0] if gender == "MALE" else [650.0, 1600.0]
        return [{
            "name": f"Generic vowel {clean_sym} ({gender})",
            "mean": default_mean,
            "std": [90.0, 220.0],
            "cov": [[8100.0, 0.0], [0.0, 48400.0]]
        }]

    def analyze_vowel(
        self,
        audio: np.ndarray,
        start_time: float,
        end_time: float,
        phoneme_symbol: str,
        gender: Optional[str] = None,
        preceding_phoneme: Optional[str] = None,
        word: Optional[str] = None,
        precomputed_formants: Optional[Any] = None,
    ) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], float, Optional[str], str]:
        duration = end_time - start_time
        if not gender:
            gender, _ = self.detect_gender(audio)

        clean_sym = phoneme_symbol.replace("/", "").strip()
        norm_sym = self.VOWEL_NORM_MAP.get(clean_sym, clean_sym)

        clean_word = re.sub(r'[^a-zA-Z]', '', word).lower() if word else ""
        is_function_word = clean_word in {"a", "an", "the", "of", "to", "in", "about", "across"}
        is_after_palatal_glide = bool(
            preceding_phoneme and preceding_phoneme.strip("/ ") in ("j", "dʒ", "tʃ", "ʃ", "\u02a4", "\u02a7")
        )
        is_fronted_u = bool(
            norm_sym in ("u\u02d0", "u", "ju\u02d0", "ju", "\u0289") and
            (is_after_palatal_glide or clean_word in ("you", "use", "music", "beautiful", "view", "few", "huge", "cute", "new", "due", "duty", "future"))
        )

        centroids = self._get_target_centroids(norm_sym, gender, is_fronted_u=is_fronted_u)
        primary_centroid = centroids[0]
        default_t_f1 = float(primary_centroid["mean"][0])
        default_t_f2 = float(primary_centroid["mean"][1])

        min_analysis_dur = 0.018 if (norm_sym == "\u0259" or is_function_word) else 0.025
        if duration < min_analysis_dur or not HAS_PARSELMOUTH:
            return (
                None, None, default_t_f1, default_t_f2, 75.0,
                "Khẩu hình và vị trí đặt lưỡi chuẩn xác!",
                "FORMANT_NOT_RELIABLE"
            )

        try:
            if precomputed_formants is not None:
                formants = precomputed_formants
            else:
                sound = parselmouth.Sound(audio, sampling_frequency=float(settings.SAMPLE_RATE))
                max_formant_freq = 5500.0 if gender == "FEMALE" else 5000.0
                formants = sound.to_formant_burg(
                    time_step=0.008,
                    max_number_of_formants=5.0,
                    maximum_formant=max_formant_freq,
                    window_length=0.025
                )

            candidate_windows = [
                (start_time + 0.10 * duration, start_time + 0.40 * duration),
                (start_time + 0.20 * duration, start_time + 0.80 * duration),
                (start_time + 0.45 * duration, start_time + 0.85 * duration),
            ]

            window_measurements: List[Tuple[float, float]] = []
            for w_start, w_end in candidate_windows:
                f1_samples = []
                f2_samples = []
                curr_t = w_start
                while curr_t <= w_end:
                    try:
                        v1 = formants.get_value_at_time(1, curr_t)
                        v2 = formants.get_value_at_time(2, curr_t)
                        if v1 and not np.isnan(v1) and not np.isinf(v1) and 180.0 <= v1 <= 1450.0:
                            f1_samples.append(float(v1))
                        if v2 and not np.isnan(v2) and not np.isinf(v2) and 450.0 <= v2 <= 3300.0:
                            f2_samples.append(float(v2))
                    except Exception:
                        pass
                    curr_t += 0.008
                if f1_samples and f2_samples:
                    window_measurements.append((float(np.median(f1_samples)), float(np.median(f2_samples))))

            if not window_measurements:
                return (
                    None, None, default_t_f1, default_t_f2, 70.0,
                    "Khẩu hình nguyên âm tương đối ổn định.",
                    "FORMANT_NOT_RELIABLE"
                )

            best_score = -1.0
            best_feedback = ""
            best_centroid = primary_centroid
            best_m_f1, best_m_f2 = window_measurements[0]

            for m_f1, m_f2 in window_measurements:
                for centroid in centroids:
                    c_f1 = float(centroid["mean"][0])
                    c_f2 = float(centroid["mean"][1])
                    sc, fb = self._score_mahalanobis(
                        m_f1, m_f2, c_f1, c_f2, centroid, is_flexible_vowel=True
                    )
                    if sc > best_score:
                        best_score = sc
                        best_feedback = fb
                        best_centroid = centroid
                        best_m_f1, best_m_f2 = m_f1, m_f2

            chosen_t_f1 = float(best_centroid["mean"][0])
            chosen_t_f2 = float(best_centroid["mean"][1])

            return (
                round(best_m_f1, 1),
                round(best_m_f2, 1),
                round(chosen_t_f1, 1),
                round(chosen_t_f2, 1),
                round(best_score, 1),
                best_feedback,
                "OK"
            )

        except Exception as ex:
            logger.warning("Formant analysis failed: %s", ex)
            return (None, None, default_t_f1, default_t_f2, 70.0, "Khẩu hình nguyên âm tương đối ổn định.", "FORMANT_NOT_RELIABLE")

    def _score_mahalanobis(
        self,
        f1: float,
        f2: float,
        t_f1: float,
        t_f2: float,
        ref: dict,
        is_flexible_vowel: bool = False
    ) -> Tuple[float, Optional[str]]:
        t_f1_safe = max(1.0, float(t_f1))
        t_f2_safe = max(1.0, float(t_f2))
        diff_f1_ratio = abs(f1 - t_f1_safe) / t_f1_safe
        diff_f2_ratio = abs(f2 - t_f2_safe) / t_f2_safe
        max_rel_dev = max(diff_f1_ratio, diff_f2_ratio)

        x = np.array([f1, f2], dtype=np.float64)
        u = np.array(ref["mean"], dtype=np.float64)
        cov = np.array(ref.get("cov", [[5625.0, 0.0], [0.0, 28900.0]]), dtype=np.float64)

        try:
            inv_cov = np.linalg.inv(cov)
            diff = x - u
            dist_sq = float(diff.T @ inv_cov @ diff)
            dist = np.sqrt(max(0.0, dist_sq))
        except Exception:
            std1 = max(1.0, float(ref.get("std", [75.0, 170.0])[0]))
            std2 = max(1.0, float(ref.get("std", [75.0, 170.0])[1]))
            dist = np.sqrt(((f1 - t_f1_safe) / std1)**2 + ((f2 - t_f2_safe) / std2)**2)

        if np.isnan(dist) or np.isinf(dist):
            dist = 1.0

        d_tol = 2.05 if is_flexible_vowel else 1.60
        beta = 0.20 if is_flexible_vowel else 0.28
        tol_margin = 0.30 if is_flexible_vowel else 0.26
        min_floor = 25.0
        max_ceil = 100.0 if is_flexible_vowel else 98.0

        if dist <= d_tol:
            raw_score = 96.5 + 3.5 * (1.0 - dist / d_tol)
        else:
            raw_score = 96.5 * np.exp(-beta * ((dist - d_tol) ** 2))

        if max_rel_dev <= tol_margin:
            norm_dev = max_rel_dev / tol_margin
            tolerance_score = 100.0 - norm_dev * 5.0
            score = max(raw_score, tolerance_score)
        else:
            score = raw_score

        score = float(np.clip(score, min_floor, max_ceil))

        # ZERO CONTRADICTION RULE:
        # Nếu score >= 75.0, nhận xét bắt buộc phải là đạt chuẩn,
        # không được vừa cho điểm cao vừa chê khẩu hình.
        if score >= 75.0:
            feedback_str = "Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
        else:
            std1 = ref.get("std", [75.0, 170.0])[0]
            std2 = ref.get("std", [75.0, 170.0])[1]
            z1 = (f1 - t_f1) / std1
            z2 = (f2 - t_f2) / std2
            z_threshold = 1.85 if is_flexible_vowel else 1.25

            feedbacks = []
            if z1 > z_threshold:
                feedbacks.append("Hạ hàm thấp hơn một chút (khẩu hình mở hơi rộng)")
            elif z1 < -z_threshold:
                feedbacks.append("Mở rộng khẩu hình hơn (hạ cằm sâu hơn một chút)")

            if z2 > z_threshold:
                feedbacks.append("Kéo lưỡi về phía sau hơn")
            elif z2 < -z_threshold:
                feedbacks.append("Đưa lưỡi về phía trước hơn")

            feedback_str = "; ".join(feedbacks) if feedbacks else "Cần chú ý điều chỉnh khẩu hình để nguyên âm chuẩn hơn."

        return score, feedback_str

    def extract_f0_variation(self, audio_data: np.ndarray, sample_rate: int = 16000) -> float:
        """
        Extracts pitch contour variation (standard deviation of F0 in voiced frames)
        using Praat Parselmouth. Used for detecting monotone/robotic speech in prosody scoring.
        """
        if not HAS_PARSELMOUTH or len(audio_data) < sample_rate * 0.2:
            return 25.0

        try:
            sound = parselmouth.Sound(audio_data, sampling_frequency=float(sample_rate))
            if sound.get_total_duration() < 0.2:
                return 20.0
            pitch = sound.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=500.0)
            pitch_values = pitch.selected_array['frequency']
            voiced = [float(v) for v in pitch_values if v is not None and not np.isnan(v) and not np.isinf(v) and v > 0]
            if len(voiced) < 5:
                return 20.0
            std_val = float(np.std(voiced))
            return 25.0 if (np.isnan(std_val) or np.isinf(std_val)) else std_val
        except Exception as ex:
            logger.warning("F0 variation extraction failed: %s", ex)
            return 25.0


formant_service = FormantService()