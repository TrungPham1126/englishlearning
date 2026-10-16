import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.config import settings
from app.services.audio_preprocessor import preprocessor

logger = logging.getLogger("phonetics-service")

try:
    import parselmouth
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False


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
        "ou": "o\u028a", "o\u028a": "o\u028a", "\u0259\u028a": "o\u028a",
        "i": "i\u02d0", "i\u02d0": "i\u02d0",
        "u": "u\u02d0", "u\u02d0": "u\u02d0",
        "\u0251": "\u0251\u02d0", "\u0251\u02d0": "\u0251\u02d0",
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
                {"name": "Back GOOSE [uː] (food, room)", "mean": [330.0, 1150.0], "std": [60.0, 180.0], "cov": [[3600.0, 0.0], [0.0, 32400.0]]},
                {"name": "Fronted GOOSE [ʉː] (huge, future)", "mean": [280.0, 1680.0], "std": [65.0, 200.0], "cov": [[4225.0, 0.0], [0.0, 40000.0]]}
            ],
            "FEMALE": [
                {"name": "Back GOOSE [uː] (food, room)", "mean": [390.0, 1250.0], "std": [70.0, 190.0], "cov": [[4900.0, 0.0], [0.0, 36100.0]]},
                {"name": "Fronted GOOSE [ʉː] (huge, future)", "mean": [340.0, 1820.0], "std": [75.0, 220.0], "cov": [[5625.0, 0.0], [0.0, 48400.0]]}
            ]
        },
        # ── 9. MOUTH (/aʊ/ - loud, about, out) ────────────────────────────────
        "a\u028a": {
            "MALE": [
                {"name": "US MOUTH Onset [aʊ]", "mean": [630.0, 1450.0], "std": [90.0, 180.0], "cov": [[8100.0, 0.0], [0.0, 32400.0]]},
                {"name": "UK MOUTH Onset [aʊ]", "mean": [720.0, 1550.0], "std": [95.0, 190.0], "cov": [[9025.0, 0.0], [0.0, 36100.0]]}
            ],
            "FEMALE": [
                {"name": "US MOUTH Onset [aʊ]", "mean": [720.0, 1620.0], "std": [100.0, 200.0], "cov": [[10000.0, 0.0], [0.0, 40000.0]]},
                {"name": "UK MOUTH Onset [aʊ]", "mean": [820.0, 1720.0], "std": [110.0, 210.0], "cov": [[12100.0, 0.0], [0.0, 44100.0]]}
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
        }
    }

    def __init__(self, profiles_path: Path = settings.VOWEL_PROFILE_PATH):
        self.profiles_path = profiles_path

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
            return gender, float(mean_f0)
        except Exception:
            return "FEMALE", 180.0

    def _get_target_centroids(
        self,
        clean_sym: str,
        gender: str,
        is_fronted_u: bool = False
    ) -> List[dict]:
        norm_sym = self.VOWEL_NORM_MAP.get(clean_sym, clean_sym)

        centroids_by_sym = self.MULTI_CENTROID_PROFILES.get(norm_sym) or self.MULTI_CENTROID_PROFILES.get(clean_sym)
        if centroids_by_sym and gender in centroids_by_sym:
            return centroids_by_sym[gender]

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
        word: Optional[str] = None
    ) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], float, Optional[str], str]:
        duration = end_time - start_time
        if not gender:
            gender, _ = self.detect_gender(audio)

        clean_sym = phoneme_symbol.replace("/", "").strip()
        norm_sym = self.VOWEL_NORM_MAP.get(clean_sym, clean_sym)

        import re
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

        min_analysis_dur = 0.018 if (norm_sym == "\u0259" or is_function_word) else 0.028
        if duration < min_analysis_dur or not HAS_PARSELMOUTH:
            return (
                None, None, default_t_f1, default_t_f2, None,
                "Thời lượng âm quá ngắn để đo formant.",
                "FORMANT_NOT_RELIABLE"
            )

        with preprocessor.export_temp_wav(audio) as wav_path:
            try:
                sound = parselmouth.Sound(wav_path)
                max_formant_freq = 5500.0 if gender == "FEMALE" else 5000.0
                formants = sound.to_formant_burg(
                    time_step=0.008,
                    max_number_of_formants=5.0,
                    maximum_formant=max_formant_freq,
                    window_length=0.025
                )

                is_diphthong = (norm_sym in self.DIPHTHONGS or clean_sym in self.DIPHTHONGS)

                if is_fronted_u or is_after_palatal_glide or norm_sym in ("ju\u02d0", "ju"):
                    mid_start = start_time + 0.50 * duration
                    mid_end = start_time + 0.85 * duration
                elif is_diphthong:
                    mid_start = start_time + 0.10 * duration
                    mid_end = start_time + 0.28 * duration
                else:
                    mid_start = start_time + 0.20 * duration
                    mid_end = start_time + 0.80 * duration

                f1_samples = []
                f2_samples = []
                curr_t = mid_start
                while curr_t <= mid_end:
                    v1 = formants.get_value_at_time(1, curr_t)
                    v2 = formants.get_value_at_time(2, curr_t)
                    if v1 and not np.isnan(v1) and not np.isinf(v1) and 180.0 <= v1 <= 1450.0:
                        f1_samples.append(v1)
                    if v2 and not np.isnan(v2) and not np.isinf(v2) and 450.0 <= v2 <= 3300.0:
                        f2_samples.append(v2)
                    curr_t += 0.008

                if not f1_samples or not f2_samples:
                    return (None, None, default_t_f1, default_t_f2, None, "Không phát hiện thấy cộng hưởng formant ổn định.", "FORMANT_NOT_RELIABLE")

                measured_f1 = float(np.median(f1_samples))
                measured_f2 = float(np.median(f2_samples))

                best_score = -1.0
                best_feedback = ""
                best_centroid = primary_centroid

                is_flexible_vowel = (
                    is_diphthong
                    or (norm_sym in ("\u028c", "\xe6", "a\u028a", "o\u028a", "\u0254\u026a", "\u0254\u02d0", "\u0259", "a\u026a", "u\u02d0", "\u026a", "e"))
                    or is_function_word
                )

                for centroid in centroids:
                    c_f1 = float(centroid["mean"][0])
                    c_f2 = float(centroid["mean"][1])
                    sc, fb = self._score_mahalanobis(
                        measured_f1, measured_f2, c_f1, c_f2, centroid, is_flexible_vowel=is_flexible_vowel
                    )
                    if sc > best_score:
                        best_score = sc
                        best_feedback = fb
                        best_centroid = centroid

                chosen_t_f1 = float(best_centroid["mean"][0])
                chosen_t_f2 = float(best_centroid["mean"][1])

                return (
                    round(measured_f1, 1),
                    round(measured_f2, 1),
                    round(chosen_t_f1, 1),
                    round(chosen_t_f2, 1),
                    round(best_score, 1),
                    best_feedback,
                    "OK"
                )

            except Exception as ex:
                logger.warning("Formant analysis failed: %s", ex)
                return (None, None, default_t_f1, default_t_f2, None, "Không thể phân tích formant cho đoạn âm này.", "FORMANT_NOT_RELIABLE")

    def _score_mahalanobis(
        self,
        f1: float,
        f2: float,
        t_f1: float,
        t_f2: float,
        ref: dict,
        is_flexible_vowel: bool = False
    ) -> Tuple[float, Optional[str]]:
        diff_f1_ratio = abs(f1 - t_f1) / max(1.0, t_f1)
        diff_f2_ratio = abs(f2 - t_f2) / max(1.0, t_f2)
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
            std1 = ref.get("std", [75.0, 170.0])[0]
            std2 = ref.get("std", [75.0, 170.0])[1]
            dist = np.sqrt(((f1 - t_f1) / std1)**2 + ((f2 - t_f2) / std2)**2)

        d_tol = 1.95 if is_flexible_vowel else 1.25
        beta = 0.20 if is_flexible_vowel else 0.35
        tol_margin = 0.40 if is_flexible_vowel else 0.22

        if dist <= d_tol:
            raw_score = 95.0 + 5.0 * (1.0 - dist / d_tol)
        else:
            raw_score = 95.0 * np.exp(-beta * ((dist - d_tol) ** 2))

        if max_rel_dev <= tol_margin:
            norm_dev = max_rel_dev / tol_margin
            tolerance_score = 98.0 - norm_dev * 10.0
            score = max(raw_score, tolerance_score)
        else:
            score = raw_score

        score = float(np.clip(score, 25.0, 98.0))

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
            pitch = sound.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=500.0)
            pitch_values = pitch.selected_array['frequency']
            voiced = pitch_values[pitch_values > 0]
            if len(voiced) < 5:
                return 20.0
            return float(np.std(voiced))
        except Exception as ex:
            logger.warning("F0 variation extraction failed: %s", ex)
            return 25.0


formant_service = FormantService()