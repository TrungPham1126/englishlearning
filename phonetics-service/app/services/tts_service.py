import hashlib
import io
import logging
import os
import re
import threading
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple
import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline

logger = logging.getLogger("phonetics-service")

# Configure PyTorch CPU thread count to match physical cores for maximum inference speed without contention
try:
    cpu_count = os.cpu_count() or 4
    optimal_threads = min(8, max(2, cpu_count // 2 if cpu_count >= 8 else cpu_count))
    torch.set_num_threads(optimal_threads)
    logger.info("Configured PyTorch CPU inference threads: %d (CPU count: %d)", optimal_threads, cpu_count)
except Exception as e:
    logger.warning("Could not set PyTorch thread count: %s", e)

AVAILABLE_VOICES: Dict[str, Dict[str, str]] = {
    # American English (lang_code='a')
    "af_heart": {
        "name": "Heart (US Female)",
        "accent": "en-US",
        "gender": "Female",
        "description": "Giọng nữ Mỹ truyền cảm, tự nhiên, ngữ điệu chuẩn bản xứ (Khuyên dùng)",
        "pipeline": "a"
    },
    "am_michael": {
        "name": "Michael (US Male)",
        "accent": "en-US",
        "gender": "Male",
        "description": "Giọng nam Mỹ trầm ấm, phát âm rõ ràng, tốc độ vừa phải",
        "pipeline": "a"
    },
    "af_bella": {
        "name": "Bella (US Female)",
        "accent": "en-US",
        "gender": "Female",
        "description": "Giọng nữ Mỹ thanh thoát, rõ âm tiết",
        "pipeline": "a"
    },
    "am_adam": {
        "name": "Adam (US Male)",
        "accent": "en-US",
        "gender": "Male",
        "description": "Giọng nam Mỹ hiện đại, ngữ điệu dứt khoát",
        "pipeline": "a"
    },
    # British English (lang_code='b')
    "bf_emma": {
        "name": "Emma (UK Female)",
        "accent": "en-GB",
        "gender": "Female",
        "description": "Giọng nữ Anh (RP - Received Pronunciation) chuẩn mực, quý phái",
        "pipeline": "b"
    },
    "bm_george": {
        "name": "George (UK Male)",
        "accent": "en-GB",
        "gender": "Male",
        "description": "Giọng nam Anh chuẩn BBC, phát âm phụ âm rất rõ",
        "pipeline": "b"
    }
}

DEFAULT_VOICE = "af_heart"
DEFAULT_SPEED = 1.0
SAMPLE_RATE = 24000


class KokoroTtsService:
    """
    Singleton TTS engine utilizing hexgrad/Kokoro-82M with turn-level LRU caching.
    Runs locally on CPU/CUDA, producing high-fidelity 24kHz mono audio.
    """

    def __init__(self, repo_id: str = "hexgrad/Kokoro-82M", cache_max_size: int = 500):
        self.repo_id = repo_id
        self._pipelines: Dict[str, KPipeline] = {}
        self._is_initialized = False
        self._turn_cache: OrderedDict[str, Tuple[np.ndarray, float]] = OrderedDict()
        self._cache_lock = threading.Lock()
        self._synth_lock = threading.RLock()
        self._cache_max_size = cache_max_size

    @staticmethod
    def _compute_cache_key(text: str, voice: str, speed: float) -> str:
        raw_key = f"{text.strip()}::{voice.strip().lower()}::{speed:.2f}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def _get_from_cache(self, key: str) -> Optional[Tuple[np.ndarray, float]]:
        with self._cache_lock:
            if key in self._turn_cache:
                self._turn_cache.move_to_end(key)
                arr, dur = self._turn_cache[key]
                return arr.copy(), dur
        return None

    def _put_to_cache(self, key: str, arr: np.ndarray, dur: float):
        with self._cache_lock:
            if key in self._turn_cache:
                self._turn_cache.move_to_end(key)
            else:
                if len(self._turn_cache) >= self._cache_max_size:
                    self._turn_cache.popitem(last=False)
            self._turn_cache[key] = (arr.copy(), dur)

    def initialize(self):
        """Pre-load KPipeline instances for US ('a') and UK ('b') English."""
        if self._is_initialized:
            return

        logger.info("Khởi tạo Kokoro-82M Pipelines (US: 'a', UK: 'b')...")
        try:
            # Pipeline for American English
            self._pipelines["a"] = KPipeline(lang_code="a", repo_id=self.repo_id)
            logger.info("Pipeline US ('a') sẵn sàng.")

            # Pipeline for British English
            self._pipelines["b"] = KPipeline(lang_code="b", repo_id=self.repo_id)
            logger.info("Pipeline UK ('b') sẵn sàng.")

            self._is_initialized = True
            logger.info("Khởi tạo Kokoro-82M thành công!")
        except Exception as e:
            logger.error("Không thể khởi tạo Kokoro-82M: %s", e, exc_info=True)
            raise

    def warmup(self):
        """Warm up model with a short sample phrase to eliminate cold-start latency."""
        if not self._is_initialized:
            self.initialize()
        logger.info("Thực hiện warmup Kokoro-82M TTS...")
        try:
            _ = self.synthesize_wav_bytes(
                text="Welcome to the English Learning Platform.",
                voice="af_heart",
                speed=1.0
            )
            logger.info("Warmup Kokoro-82M hoàn tất!")
        except Exception as e:
            logger.warning("Warmup Kokoro-82M gặp lỗi nhẹ (không ảnh hưởng khởi động): %s", e)

    @staticmethod
    def strip_speaker_and_stage_directions(text: str) -> str:
        """
        Strips leading speaker prefixes (e.g. 'Friend A:', '**Speaker 1:**', '[Man]:', '- Alice (smiling):')
        and stage directions ('(laughs)', '[sighs]') plus markdown formatting ('**', '*')
        across all lines so that Kokoro-82M NEVER reads speaker labels or non-spoken annotations aloud.
        Also normalizes Unicode hyphens and smart quotes to prevent phonemizer word-count mismatches.
        """
        if not text:
            return ""
        raw_text = (
            text.replace("\u2010", "-")
            .replace("\u2011", "-")
            .replace("\u2012", "-")
            .replace("\u2013", "-")
            .replace("\u2014", " - ")
            .replace("\u2018", "'")
            .replace("\u2019", "'")
            .replace("\u201c", '"')
            .replace("\u201d", '"')
            .strip()
        )
        raw_text = re.sub(
            r'(?<=[.?!])\s+(?=(?:\*{1,2}|_)?(?:Friend\s+[A-Z0-9]|Speaker\s+[A-Z0-9]|Person\s+[A-Z0-9]|Student\s+[A-Z0-9]|Man|Woman|Boy|Girl|Receptionist|Customer|Interviewer|Candidate|Teacher|Professor|Waiter|Waitress|Doctor|Patient)(?:\*{1,2}|_)?\s*:)',
            '\n',
            raw_text,
            flags=re.IGNORECASE
        )
        cleaned_lines: List[str] = []
        for line in re.split(r'\r?\n', raw_text):
            s = line.strip()
            if not s:
                continue
            s = re.sub(r'^(?:[-*•]+|\d+[.)])\s*', '', s)
            s = re.sub(
                r'^(?:\*{1,2}|_)?(?:\[\s*([A-Za-z0-9_.\-\s]{1,30})\s*\]|([A-Za-z0-9_.\-\s]{1,30})(?:\s*\([^)]{1,25}\))?)(?:\*{1,2}|_)?\s*:\s*(?:\*{1,2}|_)?\s*',
                '',
                s
            )
            s = re.sub(
                r'\(\s*(?:laugh(?:s|ing)?|sigh(?:s|ing)?|cough(?:s|ing)?|pause(?:s)?|whisper(?:s|ing)?|chuckle(?:s|ing)?|smile(?:s|ing)?|gasp(?:s)?|clears throat|music|applause|excited|angry|sad|happy|surprised|nervous)\s*\)',
                ' ',
                s,
                flags=re.IGNORECASE
            )
            s = re.sub(r'\[\s*[^\]]{1,30}\s*\]', ' ', s)
            s = re.sub(r'[*_#`~]+', '', s)
            s = re.sub(r'\s+', ' ', s).strip()
            if s:
                cleaned_lines.append(s)
        return " ".join(cleaned_lines).strip()

    @staticmethod
    def resolve_smart_voice_for_speaker(speaker_label: str, assigned_voices: List[str]) -> str:
        """
        Maps a speaker label to an appropriate Kokoro-82M voice based on gender keywords/names
        while ensuring distinct voices for multi-speaker dialogues.
        """
        spk_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', (speaker_label or "")).strip().lower()
        tokens = set(spk_clean.split())

        female_keywords = {
            "woman", "girl", "female", "lady", "mother", "mom", "mum", "sister", "daughter", "wife",
            "mrs", "ms", "miss", "madam", "waitress", "actress", "hostess", "nurse", "receptionist",
            "alice", "sarah", "emma", "anna", "mary", "lisa", "jane", "emily", "sophia", "olivia",
            "bella", "heart", "claire", "lucy", "hannah", "rachel", "kate", "katie", "jessica", "amy", "linda", "susan", "maria", "elena", "maya"
        }
        male_keywords = {
            "man", "boy", "male", "gentleman", "father", "dad", "brother", "son", "husband",
            "mr", "sir", "waiter", "actor", "host", "policeman", "manager",
            "bob", "john", "michael", "david", "tom", "james", "robert", "william", "richard",
            "charles", "thomas", "daniel", "matthew", "mark", "paul", "steven", "kevin", "brian",
            "george", "adam", "alex", "ben", "jack", "sam", "peter", "chris", "eric", "nick", "ryan", "leo"
        }

        female_pool = ["af_heart", "bf_emma", "af_bella"]
        male_pool = ["am_michael", "bm_george", "am_adam"]
        alternating_pool = ["af_heart", "am_michael", "bf_emma", "bm_george", "af_bella", "am_adam"]

        is_female = bool(tokens & female_keywords)
        is_male = bool(tokens & male_keywords)

        # Special rule for A vs B / 1 vs 2 when no explicit gender keyword is present
        if not is_female and not is_male:
            if any(k in spk_clean for k in ["friend a", "speaker a", "person a", "student a", "speaker 1", "person 1", "student 1"]) or spk_clean == "a":
                is_female = True
            elif any(k in spk_clean for k in ["friend b", "speaker b", "person b", "student b", "speaker 2", "person 2", "student 2"]) or spk_clean == "b":
                is_male = True

        if is_female and not is_male:
            for v in female_pool:
                if v not in assigned_voices:
                    return v
            return female_pool[len(assigned_voices) % len(female_pool)]

        if is_male and not is_female:
            for v in male_pool:
                if v not in assigned_voices:
                    return v
            return male_pool[len(assigned_voices) % len(male_pool)]

        # Alternating fallback (Female -> Male -> UK Female -> UK Male)
        for v in alternating_pool:
            if v not in assigned_voices:
                return v
        return alternating_pool[len(assigned_voices) % len(alternating_pool)]

    def preprocess_text(self, text: str) -> str:
        """
        Normalize and clean input text while preserving critical punctuation marks
        (commas, periods, exclamation marks, question marks) which dictate prosody and pauses.
        """
        if not text or not text.strip():
            raise ValueError("Văn bản yêu cầu phát âm không được để trống.")

        cleaned = self.strip_speaker_and_stage_directions(text)
        if not cleaned:
            cleaned = re.sub(r'\s+', ' ', text.strip())

        # If sentence lacks terminating punctuation, append period for natural falling intonation
        if not re.search(r'[.?!,:;]$', cleaned):
            cleaned += "."

        return cleaned

    def synthesize_audio_array(
        self,
        text: str,
        voice: Optional[str] = None,
        speed: float = DEFAULT_SPEED
    ) -> Tuple[np.ndarray, int, float]:
        """
        Synthesizes text into a numpy 1D float32 audio array.
        Uses turn-level in-memory LRU cache and thread-safe synthesis lock.
        Returns: (audio_array, sample_rate, duration_seconds)
        """
        if not self._is_initialized:
            self.initialize()

        cleaned_text = self.preprocess_text(text)
        effective_voice = voice.strip() if voice and voice.strip() in AVAILABLE_VOICES else DEFAULT_VOICE
        voice_meta = AVAILABLE_VOICES[effective_voice]
        pipeline_code = voice_meta["pipeline"]

        # Clamp speed between 0.5x and 2.0x for stability
        clamped_speed = max(0.5, min(2.0, float(speed)))

        # 1. Fast path: check turn-level cache first
        cache_key = self._compute_cache_key(cleaned_text, effective_voice, clamped_speed)
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            logger.info(
                "Turn-level TTS Cache HIT: voice='%s', text='%s'",
                effective_voice, cleaned_text[:50]
            )
            return cached[0], SAMPLE_RATE, cached[1]

        # 2. Acquire synthesis lock so espeak-ng C library is never called concurrently
        with self._synth_lock:
            cached = self._get_from_cache(cache_key)
            if cached is not None:
                logger.info(
                    "Turn-level TTS Cache HIT (after lock): voice='%s', text='%s'",
                    effective_voice, cleaned_text[:50]
                )
                return cached[0], SAMPLE_RATE, cached[1]

            pipeline = self._pipelines.get(pipeline_code)
            if not pipeline:
                pipeline = self._pipelines["a"]

            logger.info(
                "Kokoro TTS synthesize (Cache MISS): voice='%s' (%s), speed=%.2f, text='%s'",
                effective_voice, pipeline_code, clamped_speed,
                cleaned_text[:60] + ("..." if len(cleaned_text) > 60 else "")
            )

            with torch.inference_mode():
                generator = pipeline(
                    cleaned_text,
                    voice=effective_voice,
                    speed=clamped_speed,
                    split_pattern=r'\n+'
                )

                audio_pieces: List[np.ndarray] = []
                for _gs, _ps, audio_chunk in generator:
                    if audio_chunk is None:
                        continue
                    if isinstance(audio_chunk, torch.Tensor):
                        arr = audio_chunk.detach().cpu().numpy()
                    else:
                        arr = np.array(audio_chunk)
                    if arr.ndim > 1:
                        arr = arr.flatten()
                    audio_pieces.append(arr)

            if not audio_pieces:
                raise RuntimeError("Mô hình Kokoro không tạo ra bất kỳ khối âm thanh nào.")

            full_audio = np.concatenate(audio_pieces).astype(np.float32)
            duration_sec = float(len(full_audio) / SAMPLE_RATE)

            # 3. Store in turn-level cache
            self._put_to_cache(cache_key, full_audio, duration_sec)

            return full_audio, SAMPLE_RATE, duration_sec

    def synthesize_wav_bytes(
        self,
        text: str,
        voice: Optional[str] = None,
        speed: float = DEFAULT_SPEED
    ) -> Tuple[bytes, float]:
        """
        Synthesizes text and encodes into WAV (16-bit PCM, 24kHz mono) bytes.
        Returns: (wav_bytes, duration_seconds)
        """
        audio_arr, sr, duration_sec = self.synthesize_audio_array(text, voice, speed)

        buffer = io.BytesIO()
        sf.write(buffer, audio_arr, sr, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        return buffer.read(), duration_sec

    def synthesize_dialogue(
        self,
        turns: List[dict],
        speaker_map: Optional[dict] = None,
        inter_turn_pause_ms: int = 450
    ) -> Tuple[bytes, int, List[dict]]:
        """
        Synthesizes multi-speaker dialogue into a single continuous 24kHz WAV audio stream.
        - Maps each distinct speaker to a unique Kokoro voice (e.g. A -> af_heart, B -> am_michael).
        - Normalizes RMS energy across turns to eliminate loudness imbalances.
        - Connects turns with natural pauses and subtle 15ms linear fade transitions to eliminate clicks.
        - Generates millisecond-accurate timeline metadata (startMs, endMs) for frontend transcript synchronization.

        Returns: (wav_bytes, total_duration_ms, segments_metadata)
        """
        if not self._is_initialized:
            self.initialize()

        if not turns:
            raise ValueError("Danh sách lượt thoại không được để trống.")

        # 1. Establish Speaker-to-Voice mapping
        resolved_speaker_map: Dict[str, Dict[str, any]] = {}
        assigned_voices: List[str] = []
        if speaker_map:
            for spk_key, cfg in speaker_map.items():
                if isinstance(cfg, dict):
                    v = cfg.get("voice", DEFAULT_VOICE)
                    s = float(cfg.get("speed", 1.0))
                else:
                    v = getattr(cfg, "voice", DEFAULT_VOICE)
                    s = float(getattr(cfg, "speed", 1.0))
                if v not in AVAILABLE_VOICES:
                    v = DEFAULT_VOICE
                resolved_speaker_map[spk_key.strip().upper()] = {"voice": v, "speed": s}
                assigned_voices.append(v)

        # Smart gender-aware auto-assignment for any speaker not explicitly configured
        for t in turns:
            spk = (t.get("speaker") if isinstance(t, dict) else getattr(t, "speaker", "")).strip().upper()
            if spk and spk not in resolved_speaker_map:
                assigned_voice = self.resolve_smart_voice_for_speaker(spk, assigned_voices)
                assigned_voices.append(assigned_voice)
                resolved_speaker_map[spk] = {"voice": assigned_voice, "speed": 1.0}

        # 2. Synthesize each turn & construct continuous audio timeline
        pause_samples = int(SAMPLE_RATE * (max(100, min(2000, inter_turn_pause_ms)) / 1000.0))
        silence_gap = np.zeros(pause_samples, dtype=np.float32)

        fade_len = int(SAMPLE_RATE * 0.015) # 15ms linear fade
        fade_in = np.linspace(0.0, 1.0, fade_len, dtype=np.float32)
        fade_out = np.linspace(1.0, 0.0, fade_len, dtype=np.float32)

        TARGET_RMS = 0.08
        audio_segments: List[np.ndarray] = []
        segments_meta: List[dict] = []
        current_sample_cursor = 0

        with torch.inference_mode():
            for i, t in enumerate(turns):
                if isinstance(t, dict):
                    spk = t.get("speaker", "").strip()
                    raw_text = t.get("text", "").strip()
                    t_voice = t.get("voice")
                    t_speed = t.get("speed", 1.0)
                else:
                    spk = getattr(t, "speaker", "").strip()
                    raw_text = getattr(t, "text", "").strip()
                    t_voice = getattr(t, "voice", None)
                    t_speed = getattr(t, "speed", 1.0)

                text = self.strip_speaker_and_stage_directions(raw_text)
                if not text:
                    continue

                spk_upper = spk.upper()
                # Determine effective voice and speed for this turn
                spk_cfg = resolved_speaker_map.get(spk_upper, {"voice": DEFAULT_VOICE, "speed": 1.0})
                effective_voice = t_voice if (t_voice and t_voice in AVAILABLE_VOICES) else spk_cfg["voice"]
                effective_speed = t_speed if t_speed is not None else spk_cfg.get("speed", 1.0)

                # Synthesize turn audio
                turn_audio, _, _ = self.synthesize_audio_array(text, effective_voice, effective_speed)

                # RMS Loudness Normalization
                turn_rms = float(np.sqrt(np.mean(turn_audio**2))) if len(turn_audio) > 0 else 0.0
                if turn_rms > 1e-4:
                    scale = TARGET_RMS / turn_rms
                    # Clamp scaling factor to avoid extreme amplification of quiet segments
                    scale = max(0.5, min(2.0, scale))
                    turn_audio = turn_audio * scale

                # Apply smooth linear fade-in & fade-out to prevent boundary clicks
                if len(turn_audio) > fade_len * 2:
                    turn_audio[:fade_len] = turn_audio[:fade_len] * fade_in
                    turn_audio[-fade_len:] = turn_audio[-fade_len:] * fade_out

                turn_audio = np.clip(turn_audio, -0.98, 0.98)

                start_ms = int(round((current_sample_cursor / SAMPLE_RATE) * 1000.0))
                end_ms = start_ms + int(round((len(turn_audio) / SAMPLE_RATE) * 1000.0))

                segments_meta.append({
                    "speaker": spk,
                    "voice": effective_voice,
                    "text": text,
                    "startMs": start_ms,
                    "endMs": end_ms
                })

                audio_segments.append(turn_audio)
                current_sample_cursor += len(turn_audio)

                # Insert pause between turns (except after final turn)
                if i < len(turns) - 1:
                    audio_segments.append(silence_gap)
                    current_sample_cursor += len(silence_gap)

        if not audio_segments:
            raise RuntimeError("Không có âm thanh nào được tạo ra từ kịch bản hội thoại.")

        concatenated_audio = np.concatenate(audio_segments).astype(np.float32)
        total_duration_ms = int(round((len(concatenated_audio) / SAMPLE_RATE) * 1000.0))

        # Encode to WAV 16-bit PCM
        buffer = io.BytesIO()
        sf.write(buffer, concatenated_audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        wav_bytes = buffer.read()

        logger.info(
            "Synthesized dialogue successfully: %d turns, duration: %d ms, bytes: %d",
            len(turns), total_duration_ms, len(wav_bytes)
        )

        return wav_bytes, total_duration_ms, segments_meta

    @staticmethod
    def get_available_voices() -> List[Dict[str, str]]:
        """List metadata of all supported voices."""
        return [
            {
                "id": vid,
                "name": vdata["name"],
                "accent": vdata["accent"],
                "gender": vdata["gender"],
                "description": vdata["description"],
                "pipeline": vdata["pipeline"],
                "isDefault": vid == DEFAULT_VOICE
            }
            for vid, vdata in AVAILABLE_VOICES.items()
        ]


# Global singleton instance
tts_engine = KokoroTtsService()

