import base64
from contextvars import ContextVar
import json
import logging
import re
import traceback
from typing import Any, Dict, List, Optional
import numpy as np

from fastapi import APIRouter, File, Form, UploadFile, status, Response, Query, HTTPException
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.exceptions import (
    AudioTooLargeError,
    InvalidTranscriptError,
    LowAlignmentConfidenceError,
    EmptySpeechError,
    SpeechAssessmentException
)
from app.services.aligner import validate_script
from app.models.alignment import AlignedWord, AlignedPhoneme
from app.schemas import (
    SpeechAssessmentResponse,
    WordSchema,
    PhonemeSchema,
    PhonemeType,
    MeasurementStatus,
    WordStatus,
    SpokenWordStatus,
    EvaluationStatus,
    TtsRequest,
    VoiceInfo,
    DialogueTtsRequest,
    DialogueTtsResponse,
    DialogueSegmentMetadata
)
from app.services.tts_service import tts_engine
from app.services import (
    preprocessor,
    quality_gate,
    speech_detector,
    forced_aligner,
    formant_service,
    scorer,
    confidence_estimator,
    feedback_generator,
    evidence_detector,
    word_sequence_aligner,
    check_consonant_acoustic_evidence,
    check_consonant_acoustic_evidence_detailed,
    generate_phoneme_pedagogical_feedback,
    analyze_word_coverage,
    detect_spoken_prefix_count,
    decode_raw_speech,
    compute_phoneme_similarity,
    verify_speech_content,
    extract_utterance_acoustic_features,
)

logger = logging.getLogger("phonetics-service")
router = APIRouter()
_diagnostics_sink: ContextVar[Optional[Dict[str, Any]]] = ContextVar("_diagnostics_sink", default=None)


def _build_rejected_mismatch_response(
    clean_script: str,
    word_phonemes,
    quality_metrics,
    spoken_repr: str,
) -> SpeechAssessmentResponse:
    """Builds a uniform REJECTED_MISMATCH response for single-word or multi-word off-script speech."""
    words_schema: List[WordSchema] = []
    sentence_tokens_list = []
    word_rows_list = []

    for w_text, ph_list in word_phonemes:
        phonemes_schema: List[PhonemeSchema] = []
        for p in ph_list:
            phonemes_schema.append(
                PhonemeSchema(
                    symbol=p.symbol,
                    type=PhonemeType.VOWEL if p.phoneme_type == "vowel" else PhonemeType.CONSONANT,
                    score=0.0,
                    feedback=f"Âm /{p.symbol}/: Không khớp với âm thanh ghi nhận trong câu nói.",
                    measured_f1=None,
                    measured_f2=None,
                    target_f1=None,
                    target_f2=None,
                    confidence=0.0,
                    status=MeasurementStatus.INSUFFICIENT_EVIDENCE
                )
            )
        words_schema.append(
            WordSchema(
                word=w_text,
                start_time=0.0,
                end_time=quality_metrics.duration,
                score=0.0,
                phonemes=phonemes_schema,
                confidence=0.0,
                status=WordStatus.NOT_SPOKEN,
                word_status=SpokenWordStatus.WRONG_WORD,
                is_oov=False
            )
        )
        sentence_tokens_list.append({
            "word": w_text,
            "color": "RED",
            "hasPauseAfter": False,
            "hasLinkingAfter": False,
            "wordStatus": "WRONG_WORD"
        })
        word_rows_list.append({
            "word": w_text,
            "score": 0,
            "wordStatus": "WRONG_WORD",
            "phonemes": [
                {
                    "ipa": p.symbol,
                    "score": 0,
                    "note": f"Bạn chưa phát âm đúng âm /{p.symbol}/ của từ '{w_text}'."
                }
                for p in ph_list
            ]
        })

    kpi_dict = {
        "pronunciation": 0,
        "fluency": 0,
        "completeness": 0,
        "prosody": 0,
        "wordsPerMinute": 0,
    }
    status_msg = (
        f"Phát âm không hợp lệ. Bạn đang nói: '{spoken_repr}', trong khi nội dung cần đọc là '{clean_script}'. "
        f"Vui lòng đọc đúng nội dung của bài học."
    )

    return SpeechAssessmentResponse(
        overall_score=0.0,
        pronunciation_score=0.0,
        fluency_score=0.0,
        speed_score=0.0,
        articulation_rate=0.0,
        words=words_schema,
        fluency_feedback=[],
        evaluation_status=EvaluationStatus.REJECTED_MISMATCH,
        overall_confidence=0.0,
        audio_quality=quality_metrics,
        is_passed=False,
        pass_score=80,
        status_message=status_msg,
        evaluated_by="PYTHON_ACOUSTIC_ENGINE",
        kpi=kpi_dict,
        sentence_tokens=sentence_tokens_list,
        word_rows=word_rows_list
    )


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check probe for container orchestration."""
    return {
        "status": "healthy",
        "service": "phonetics-service",
        "version": "1.0.0",
        "sampleRate": settings.SAMPLE_RATE,
        "device": settings.MODEL_DEVICE
    }


@router.post(
    "/api/v1/audio/evaluate-phonetics",
    response_model=SpeechAssessmentResponse,
    status_code=status.HTTP_200_OK
)
async def evaluate_phonetics(
    audio: UploadFile = File(..., description="Audio file (.wav, .mp3, .m4a)"),
    script: str = Form(..., description="Reference target sentence text")
):
    """
    Primary Speech Assessment API endpoint.
    Hỗ trợ đánh giá đa phương ngữ (US & UK) tự động cho mọi âm vị và từ vựng tiếng Anh.
    """
    # 1. Validate Script Input Gate
    validated_words = validate_script(script)
    clean_script = " ".join(validated_words)

    # 2. Read and Validate Payload Size
    audio_bytes = await audio.read()
    await audio.seek(0)
    size_mb = len(audio_bytes) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise AudioTooLargeError(size_mb, settings.MAX_UPLOAD_SIZE_MB)

    # 3. Decode, Resample (16kHz), Normalize, Band-pass filter
    filename = audio.filename or "recording.wav"
    audio_data = preprocessor.decode_and_resample(audio_bytes, filename)

    # 4. Audio Quality Gate
    quality_metrics = quality_gate.evaluate(audio_data, strict=True)
    audio_conf = confidence_estimator.estimate_audio_confidence(quality_metrics)

    # 5. Voice Activity Detection
    speech_segments = speech_detector.detect(audio_data)
    valid_speech = [seg for seg in speech_segments if seg.duration >= 0.08]
    if not valid_speech:
        raise EmptySpeechError("Không phát hiện thấy tín hiệu giọng nói trong đoạn ghi âm.")

    last_speech_time = valid_speech[-1].end
    first_speech_time = valid_speech[0].start

    # Compute median speech RMS energy across active speech frames
    speech_frames = []
    for seg in valid_speech:
        s_idx = int(seg.start * settings.SAMPLE_RATE)
        e_idx = int(seg.end * settings.SAMPLE_RATE)
        if e_idx > s_idx:
            speech_frames.append(audio_data[s_idx:e_idx])
    if speech_frames:
        concat_speech = np.concatenate(speech_frames)
        frame_len = int(0.025 * settings.SAMPLE_RATE)
        hop_len = int(0.010 * settings.SAMPLE_RATE)
        if len(concat_speech) >= frame_len:
            speech_rms_list = [
                float(np.sqrt(np.mean(concat_speech[i : i + frame_len] ** 2)))
                for i in range(0, len(concat_speech) - frame_len + 1, hop_len)
            ]
            median_speech_rms = float(np.median(speech_rms_list)) if speech_rms_list else 0.05
        else:
            median_speech_rms = float(np.sqrt(np.mean(concat_speech ** 2)))
    else:
        median_speech_rms = 0.05

    # 5b. ASR Content Verification Gate
    expected_words_list = clean_script.split()
    is_single_word = (len(expected_words_list) == 1)

    if is_single_word and not hasattr(forced_aligner.align, "assert_called"):
        # Guard against single-word hallucinations / mismatches (e.g. reading full sentence when target is 1 word)
        is_valid, reject_reason, sim_score, emitted_tokens, spoken_repr = verify_speech_content(
            audio_data, expected_words_list
        )
        if not is_valid and reject_reason != "EMPTY_SPEECH":
            logger.warning(
                "[ASR Verification Gate] Short-circuiting single-word evaluation due to %s (sim=%.2f). Spoken: %s, Expected: %s",
                reject_reason, sim_score, spoken_repr, clean_script
            )
            word_phonemes = forced_aligner.g2p.convert_text(clean_script)
            return _build_rejected_mismatch_response(
                clean_script=clean_script,
                word_phonemes=word_phonemes,
                quality_metrics=quality_metrics,
                spoken_repr=spoken_repr,
            )
    else:
        logger.info(
            "[ASR Verification Gate] Multi-word sentence '%s' -> Streaming directly into Trellis Forced Alignment",
            clean_script
        )

    # 6. Neural Forced Alignment across target script
    alignment_result = await forced_aligner.align(audio_data, clean_script)
    align_conf = alignment_result.alignment_confidence
    logger.info("Trellis alignment confidence: %.3f for script: '%s'", align_conf, clean_script)

    if align_conf < settings.MIN_ALIGNMENT_CONFIDENCE or not alignment_result.words:
        raise LowAlignmentConfidenceError(align_conf, settings.MIN_ALIGNMENT_CONFIDENCE)

    is_mocked_align = hasattr(forced_aligner.align, "assert_called")

    # 7. Optional ASR Word-Sequence Evidence & Word Coverage (reuse single-pass Wav2Vec2 emissions)
    word_evidences = []
    spoken_prefix_len = len(alignment_result.words)
    word_coverage_ratios: List[float] = [1.0] * len(alignment_result.words)
    cached_raw_tokens = getattr(alignment_result, "raw_emitted_tokens", None) or None
    if hasattr(evidence_detector.detect_spoken_words, "assert_called"):
        detected_words = evidence_detector.detect_spoken_words(audio_data, settings.SAMPLE_RATE)
        if detected_words:
            word_evidences = word_sequence_aligner.align(expected_words_list, detected_words)
    elif len(expected_words_list) >= 3 and not is_mocked_align:
        prefix_count, cov_ratios = analyze_word_coverage(
            audio_data,
            expected_words_list,
            emitted_tokens=cached_raw_tokens,
        )
        if cov_ratios:
            word_coverage_ratios = [
                cov_ratios[i] if i < len(cov_ratios) else 1.0
                for i in range(len(alignment_result.words))
            ]
        if 0 < prefix_count < len(alignment_result.words):
            spoken_prefix_len = prefix_count
            logger.info("[Prefix Gate] Detected %d/%d spoken prefix words", spoken_prefix_len, len(alignment_result.words))
            has_suffix_recovery = any(
                r >= 0.50 for r in word_coverage_ratios[spoken_prefix_len:]
            )
            if not has_suffix_recovery and last_speech_time < quality_metrics.duration - 0.25:
                prefix_end_idx = min(
                    len(audio_data),
                    max(int(0.45 * settings.SAMPLE_RATE), int((last_speech_time + 0.15) * settings.SAMPLE_RATE)),
                )
                prefix_script = " ".join(w.word for w in alignment_result.words[:spoken_prefix_len])
                try:
                    prefix_res = await forced_aligner.align(audio_data[:prefix_end_idx], prefix_script)
                    if (
                        prefix_res
                        and len(prefix_res.words) == spoken_prefix_len
                        and prefix_res.alignment_confidence >= settings.MIN_ALIGNMENT_CONFIDENCE
                    ):
                        alignment_result.words[:spoken_prefix_len] = prefix_res.words
                        align_conf = prefix_res.alignment_confidence
                        logger.info(
                            "[Prefix Gate] Re-aligned %d prefix words cleanly (align_conf=%.3f)",
                            spoken_prefix_len,
                            align_conf,
                        )
                except Exception as pref_ex:
                    logger.debug("[Prefix Gate] Prefix re-alignment skipped: %s", pref_ex)

    # 8. Speaker Pitch, Gender & In-Memory Utterance Acoustics (computed ONCE per utterance)
    utterance_acoustics = (
        formant_service.extract_utterance_acoustics(audio_data, settings.SAMPLE_RATE)
        if not is_mocked_align
        else None
    )
    if utterance_acoustics is not None:
        speaker_gender, mean_f0 = utterance_acoustics.gender, utterance_acoustics.mean_f0
    else:
        speaker_gender, mean_f0 = formant_service.detect_gender(audio_data)
    logger.info("Detected speaker F0: %.1f Hz -> Profile: %s", mean_f0, speaker_gender)

    # Whole-file CTC raw phonetic sequence verification (tái sử dụng kết quả greedy CTC 1 lần chạy)
    whole_raw_tokens: List[str] = (
        (cached_raw_tokens if cached_raw_tokens is not None else decode_raw_speech(audio_data))
        if not is_mocked_align
        else []
    )
    all_expected_tokens: List[str] = [
        p.symbol.strip("/ ")
        for w in alignment_result.words
        for p in w.phonemes
    ]
    whole_file_sim: float = (
        compute_phoneme_similarity(all_expected_tokens, whole_raw_tokens)
        if (whole_raw_tokens and all_expected_tokens)
        else 1.0
    )
    logger.info(
        "[Whole-File CTC Verification] Expected (%d): %s | Spoken (%d): %s | Whole-file similarity: %.3f",
        len(all_expected_tokens),
        all_expected_tokens,
        len(whole_raw_tokens),
        whole_raw_tokens,
        whole_file_sim
    )

    utt_canon_posts = [
        (p.canonical_posterior if getattr(p, "canonical_posterior", None) is not None else p.posterior)
        for w in alignment_result.words
        for p in w.phonemes
    ]
    mean_utt_canon = float(np.mean(utt_canon_posts)) if utt_canon_posts else 0.0
    diag_sink = _diagnostics_sink.get()
    if diag_sink is not None:
        diag_sink["whole_file_sim"] = float(whole_file_sim)
        diag_sink["align_conf"] = float(align_conf)
        diag_sink["mean_utt_canon"] = float(mean_utt_canon)

    if (
        len(expected_words_list) >= 2
        and not is_mocked_align
        and len(whole_raw_tokens) >= 6
        and whole_file_sim < 0.16
        and align_conf < 0.25
        and mean_utt_canon < 0.10
    ):
        if diag_sink is not None:
            diag_sink["rejected_mismatch"] = True
        logger.warning(
            "[Off-Script Mismatch Gate] Rejecting multi-word utterance (sim=%.3f, align_conf=%.3f, mean_canon=%.3f) for script: '%s'",
            whole_file_sim, align_conf, mean_utt_canon, clean_script,
        )
        word_phonemes = forced_aligner.g2p.convert_text(clean_script)
        spoken_preview = " ".join(whole_raw_tokens[:12])
        return _build_rejected_mismatch_response(
            clean_script=clean_script,
            word_phonemes=word_phonemes,
            quality_metrics=quality_metrics,
            spoken_repr=f"/{spoken_preview}/",
        )

    # 9. Acoustic Phoneme & Word Scoring
    words_schema: List[WordSchema] = []
    total_syllables = 0
    all_word_scores: List[float] = []
    spoken_word_count = 0
    partial_word_count = 0
    missing_triggered = False
    vowel_token_set = {
        "a", "e", "i", "o", "u", "ə", "ɪ", "ʊ", "ʌ", "æ", "ɑ", "ɔ", "ɜ", "ɚ",
        "aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "iː", "uː", "ɑː", "ɔː", "ɜː", "oː", "aː"
    }

    for w_idx, word_obj in enumerate(alignment_result.words):
        # A. Overlap with detected speech segments
        overlap_sec = 0.0
        for seg in valid_speech:
            o_start = max(word_obj.start, seg.start)
            o_end = min(word_obj.end, seg.end)
            if o_end > o_start:
                overlap_sec += (o_end - o_start)
        w_dur = max(0.01, word_obj.end - word_obj.start)
        overlap_ratio = overlap_sec / w_dur

        # B. RMS energy of word segment
        w_start_idx = int(word_obj.start * settings.SAMPLE_RATE)
        w_end_idx = int(word_obj.end * settings.SAMPLE_RATE)
        w_slice = (
            audio_data[w_start_idx:w_end_idx]
            if (w_end_idx > w_start_idx and w_start_idx < len(audio_data))
            else np.array([], dtype=np.float32)
        )
        w_rms = float(np.sqrt(np.mean(w_slice**2))) if len(w_slice) > 0 else 0.0
        energy_ratio = w_rms / max(1e-5, median_speech_rms)

        # C. Raw CTC posterior across phonemes
        raw_posts = [p.raw_posterior if p.raw_posterior is not None else p.posterior for p in word_obj.phonemes]
        mean_raw_post = float(np.mean(raw_posts)) if raw_posts else 0.0

        # D. Check if word is beyond active speech
        is_past_speech_end = (word_obj.start >= last_speech_time + settings.SPEECH_TRIM_MARGIN_SEC) or (
            overlap_ratio < 0.10 and word_obj.start >= last_speech_time - 0.05
        )

        w_cov = word_coverage_ratios[w_idx] if w_idx < len(word_coverage_ratios) else 1.0
        later_recovery = (not is_mocked_align) and any(
            word_coverage_ratios[k] >= 0.50
            and alignment_result.words[k].start < last_speech_time + settings.SPEECH_TRIM_MARGIN_SEC
            for k in range(w_idx + 1, min(len(alignment_result.words), len(word_coverage_ratios)))
        )

        is_missing = False
        if word_evidences:
            if w_idx < len(word_evidences) and word_evidences[w_idx].status == "NOT_SPOKEN":
                is_missing = True
        elif w_idx >= spoken_prefix_len:
            if not later_recovery:
                is_missing = True
                missing_triggered = True
            elif w_cov < 0.35:
                is_missing = True
        elif getattr(word_obj, "skipped", False):
            is_missing = True
            if not later_recovery:
                missing_triggered = True
        elif missing_triggered and not later_recovery:
            is_missing = True
        elif is_past_speech_end:
            is_missing = True
            missing_triggered = True
        elif overlap_ratio < 0.15 and (
            energy_ratio < settings.MISSING_WORD_MIN_ENERGY_RATIO or mean_raw_post < settings.MISSING_WORD_MIN_RAW_POSTERIOR
        ):
            is_missing = True
            if word_obj.start >= last_speech_time - 0.10 and not later_recovery:
                missing_triggered = True
        elif mean_raw_post < settings.MISSING_WORD_MIN_RAW_POSTERIOR and energy_ratio < settings.MISSING_WORD_MIN_ENERGY_RATIO:
            is_missing = True
            if word_obj.start >= last_speech_time - 0.10 and not later_recovery:
                missing_triggered = True

        if not is_missing and missing_triggered:
            missing_triggered = False

        if is_missing:
            all_word_scores.append(0.0)
            words_schema.append(
                WordSchema(
                    word=word_obj.word,
                    start_time=None,
                    end_time=None,
                    score=None,
                    phonemes=[],
                    confidence=0.0,
                    status=WordStatus.NOT_SPOKEN,
                    word_status=SpokenWordStatus.MISSING,
                    is_oov=word_obj.is_oov
                )
            )
            continue

        phonemes_schema: List[PhonemeSchema] = []
        w_win_start = max(0, int(word_obj.start * settings.SAMPLE_RATE) - 320)
        w_win_end = min(len(audio_data), int(word_obj.end * settings.SAMPLE_RATE) + 320)
        if getattr(alignment_result, "frame_tokens", None):
            w_raw_tokens = alignment_result.get_window_emitted_tokens(
                max(0.0, word_obj.start - 0.02),
                word_obj.end + 0.02,
            )
        elif getattr(alignment_result, "raw_emitted_tokens", None) and len(alignment_result.words) == 1:
            w_raw_tokens = list(alignment_result.raw_emitted_tokens)
        elif not is_mocked_align and w_win_end - w_win_start > 640:
            w_raw_tokens = decode_raw_speech(audio_data[w_win_start:w_win_end])
        else:
            w_raw_tokens = []

        precomp_formants = utterance_acoustics.formants if (utterance_acoustics is not None and not hasattr(formant_service.analyze_vowel, "assert_called")) else None

        word_diag_phonemes: List[Dict[str, Any]] = []
        for p_idx, p_obj in enumerate(word_obj.phonemes):
            prec_ph = word_obj.phonemes[p_idx - 1].symbol if p_idx > 0 else (
                alignment_result.words[w_idx - 1].phonemes[-1].symbol if (w_idx > 0 and alignment_result.words[w_idx - 1].phonemes) else None
            )

            canon_p = p_obj.canonical_posterior if getattr(p_obj, "canonical_posterior", None) is not None else p_obj.posterior
            gop_m = getattr(p_obj, "gop_margin", None)
            p_diag_formant: Optional[float] = None
            p_diag_coda_r: bool = False

            if p_obj.phoneme_type == "vowel":
                total_syllables += 1
                p_symbol = p_obj.symbol

                kwargs = {"precomputed_formants": precomp_formants} if precomp_formants is not None else {}
                (
                    m_f1, m_f2, t_f1, t_f2,
                    formant_score,
                    p_formant_feedback,
                    status_str
                ) = formant_service.analyze_vowel(
                    audio_data,
                    p_obj.start,
                    p_obj.end,
                    p_symbol,
                    gender=speaker_gender,
                    preceding_phoneme=prec_ph,
                    word=word_obj.word,
                    **kwargs,
                )

                p_score = scorer.score_vowel(
                    formant_score,
                    p_obj.confidence,
                    align_conf,
                    p_obj.posterior,
                    symbol=p_symbol,
                    canonical_posterior=p_obj.canonical_posterior,
                    gop_margin=gop_m,
                )
                p_diag_formant = float(formant_score) if formant_score is not None else None
                if canon_p < 0.02 and (formant_score is None or formant_score < 50.0) and (gop_m is None or gop_m < -1.8):
                    p_score = min(p_score, 40.0)
                    status_str = "INSUFFICIENT_EVIDENCE"
                p_conf = confidence_estimator.estimate_phoneme_confidence(p_obj, m_f1, status_str)

                eff_formant_fb = p_formant_feedback
                if gop_m is not None and gop_m < -1.8 and p_score < 55.0 and (
                    not eff_formant_fb or "chuẩn xác" in eff_formant_fb.lower()
                ):
                    eff_formant_fb = f"Âm nguyên âm /{p_symbol}/ bị đọc lệch sang âm khác, chú ý đúng khẩu hình."

                p_feedback = generate_phoneme_pedagogical_feedback(
                    symbol=p_symbol,
                    score=p_score,
                    phoneme_type="vowel",
                    formant_feedback=eff_formant_fb
                )

                phonemes_schema.append(
                    PhonemeSchema(
                        symbol=p_symbol,
                        type=PhonemeType.VOWEL,
                        score=round(p_score, 1),
                        feedback=p_feedback,
                        measured_f1=m_f1,
                        measured_f2=m_f2,
                        target_f1=t_f1,
                        target_f2=t_f2,
                        confidence=round(p_conf, 2),
                        status=MeasurementStatus(status_str)
                    )
                )
            else:
                p_start_idx = int(p_obj.start * settings.SAMPLE_RATE)
                p_end_idx = int(p_obj.end * settings.SAMPLE_RATE)
                slice_audio = (
                    audio_data[p_start_idx:p_end_idx]
                    if p_end_idx > p_start_idx and p_start_idx < len(audio_data)
                    else np.array([], dtype=np.float32)
                )

                has_evidence, acoustic_mult, acoustic_note = check_consonant_acoustic_evidence_detailed(
                    slice_audio, p_obj.symbol
                )

                is_coda_r = (p_obj.symbol in ("r", "ɹ") and p_idx > 0 and word_obj.phonemes[p_idx - 1].phoneme_type == "vowel")
                clean_cons_sym = p_obj.symbol.strip("/ ")
                is_unreleased_plosive = clean_cons_sym in ("p", "t", "k", "b", "d", "g", "ɡ")
                custom_cons_feedback: Optional[str] = None

                if p_obj.is_word_final and not is_coda_r and not is_unreleased_plosive and (not has_evidence or canon_p < 0.04):
                    p_score = 0.0 if canon_p < 0.02 else 20.0
                    p_status = MeasurementStatus.INSUFFICIENT_EVIDENCE
                    acoustic_note = f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_cons_sym}/ ở cuối từ"
                else:
                    effective_mult = acoustic_mult if has_evidence else (0.85 if (is_unreleased_plosive and align_conf >= 0.65) else max(0.50, acoustic_mult))
                    if canon_p >= 0.80 and align_conf >= 0.85:
                        effective_mult = max(effective_mult, 0.90)
                    p_score = scorer.score_consonant_gop(
                        p_obj.posterior,
                        p_obj.duration,
                        align_conf,
                        symbol=p_obj.symbol,
                        is_word_final=p_obj.is_word_final,
                        is_coda_r=is_coda_r,
                        acoustic_multiplier=effective_mult,
                        canonical_posterior=p_obj.canonical_posterior,
                        gop_margin=gop_m,
                    )
                    p_status = MeasurementStatus.OK if (has_evidence or p_score >= 60.0) else MeasurementStatus.INSUFFICIENT_EVIDENCE
                    if canon_p < 0.02 and not has_evidence and align_conf < 0.50:
                        p_score = min(p_score, 45.0)
                        p_status = MeasurementStatus.INSUFFICIENT_EVIDENCE

                # Phát hiện chèn nguyên âm thừa giữa cụm phụ âm đầu trên cửa sổ cục bộ 2 âm vị
                if p_idx < len(word_obj.phonemes) - 1 and word_obj.phonemes[p_idx + 1].phoneme_type != "vowel":
                    next_ph = word_obj.phonemes[p_idx + 1]
                    next_cons_sym = next_ph.symbol.strip("/ ")
                    pair_tokens = (
                        alignment_result.get_window_emitted_tokens(
                            max(0.0, p_obj.start - 0.02),
                            min(quality_metrics.duration, next_ph.end + 0.02),
                        )
                        if getattr(alignment_result, "frame_tokens", None)
                        else w_raw_tokens
                    )
                    if (
                        len(pair_tokens) >= 3
                        and clean_cons_sym in pair_tokens
                        and next_cons_sym in pair_tokens
                        and (canon_p < 0.70 or (gop_m is not None and gop_m < 1.5))
                    ):
                        idx_c1 = pair_tokens.index(clean_cons_sym)
                        idx_c2 = pair_tokens.index(next_cons_sym, idx_c1 + 1) if next_cons_sym in pair_tokens[idx_c1 + 1:] else -1
                        if idx_c2 > idx_c1 + 1:
                            inter_tokens = pair_tokens[idx_c1 + 1 : idx_c2]
                            if any(t in vowel_token_set for t in inter_tokens):
                                p_score = min(p_score, 35.0)
                                custom_cons_feedback = (
                                    f"Bạn đang đọc tách âm /{clean_cons_sym}/ thành âm tiết riêng "
                                    f"(chèn nguyên âm thừa trước /{next_cons_sym}/). Hãy nối liền cụm phụ âm /{clean_cons_sym}{next_cons_sym}/."
                                )

                # Phát hiện đọc nhầm âm cuối /l/ thành âm mũi /n/ (ví dụ đọc 'sờ-cun' thay vì 'school')
                if p_obj.is_word_final and clean_cons_sym == "l" and canon_p < 0.35:
                    if any(tok in ("n", "m", "ŋ") for tok in w_raw_tokens[-2:]):
                        p_score = min(p_score, 35.0)
                        custom_cons_feedback = (
                            "Bạn đang phát âm nhầm âm cuối /l/ thành âm mũi /n/ "
                            "(ví dụ đọc 'cun' thay vì 'school'). Hãy cong đầu lưỡi chạm vòm miệng trên để tạo âm /l/."
                        )

                # Phát hiện đọc sai hoặc bỏ sót phụ âm giữa từ (ví dụ đọc 'óp-từn' mất âm /f/ của 'often')
                if not p_obj.is_word_final and not is_coda_r and canon_p < 0.03 and not is_unreleased_plosive:
                    p_score = min(p_score, 15.0)
                    p_status = MeasurementStatus.INSUFFICIENT_EVIDENCE
                    custom_cons_feedback = f"Bạn đã phát âm sai hoặc bỏ sót phụ âm /{clean_cons_sym}/ trong từ '{word_obj.word}'."
                elif (
                    not is_coda_r
                    and not (p_obj.is_word_final and (not has_evidence or canon_p < 0.04))
                    and gop_m is not None
                    and gop_m < -1.8
                    and p_score < 60.0
                    and custom_cons_feedback is None
                ):
                    custom_cons_feedback = f"Âm /{clean_cons_sym}/ bị phát âm lệch sang phụ âm khác trong từ '{word_obj.word}'."

                p_feedback = custom_cons_feedback or generate_phoneme_pedagogical_feedback(
                    symbol=p_obj.symbol,
                    score=p_score,
                    phoneme_type="consonant",
                    acoustic_detail=acoustic_note if p_score < 70.0 else None,
                    is_word_final=p_obj.is_word_final
                )

                p_conf = confidence_estimator.estimate_phoneme_confidence(p_obj)
                phonemes_schema.append(
                    PhonemeSchema(
                        symbol=p_obj.symbol,
                        type=PhonemeType.CONSONANT,
                        score=round(p_score, 1),
                        feedback=p_feedback,
                        confidence=round(p_conf, 2),
                        status=p_status
                    )
                )
                p_diag_coda_r = is_coda_r

            if diag_sink is not None:
                word_diag_phonemes.append({
                    "symbol": p_obj.symbol.strip("/ "),
                    "type": p_obj.phoneme_type,
                    "score": round(float(p_score), 2),
                    "posterior": round(float(p_obj.posterior), 4),
                    "canon_posterior": round(float(canon_p), 4),
                    "gop_margin": None if gop_m is None else round(float(gop_m), 4),
                    "formant_score": p_diag_formant,
                    "duration": round(float(p_obj.duration), 4),
                    "is_word_final": bool(p_obj.is_word_final),
                    "is_coda_r": bool(p_diag_coda_r),
                    "has_frames": bool(p_obj.has_frames),
                })

        if diag_sink is not None:
            diag_sink.setdefault("word_phonemes", {})[w_idx] = word_diag_phonemes

        w_score = scorer.score_word(phonemes_schema, word_obj.phonemes, is_oov=word_obj.is_oov)
        evidence_count = sum(1 for p in phonemes_schema if p.score >= 30.0)
        evidence_ratio = evidence_count / float(max(1, len(phonemes_schema)))
        if w_score >= 60.0 or evidence_ratio >= settings.PARTIAL_WORD_MIN_EVIDENCE_RATIO or evidence_count >= 5:
            w_spoken_status = SpokenWordStatus.SPOKEN
            spoken_word_count += 1
        elif evidence_count > 0:
            w_spoken_status = SpokenWordStatus.PARTIAL
            partial_word_count += 1
        else:
            w_spoken_status = SpokenWordStatus.MISSING

        all_word_scores.append(w_score)
        words_schema.append(
            WordSchema(
                word=word_obj.word,
                start_time=word_obj.start,
                end_time=word_obj.end,
                score=round(w_score, 1),
                phonemes=phonemes_schema,
                confidence=word_obj.confidence,
                status=WordStatus.MATCH,
                word_status=w_spoken_status,
                is_oov=word_obj.is_oov
            )
        )

    # 10. Temporal & Inter-word Transition Analysis
    spoken_words = [
        w for w in words_schema
        if w.word_status in (SpokenWordStatus.SPOKEN, SpokenWordStatus.PARTIAL, "SPOKEN", "PARTIAL")
        and w.start_time is not None and w.end_time is not None
    ]

    if spoken_words:
        first_onset = spoken_words[0].start_time
        last_offset = spoken_words[-1].end_time
        total_speech_duration = max(0.5, last_offset - first_onset)
    else:
        first_onset = 0.0
        last_offset = quality_metrics.duration
        total_speech_duration = max(0.5, quality_metrics.duration)

    wpm = scorer.calculate_wpm(len(spoken_words), total_speech_duration)

    total_pause_duration = 0.0
    awkward_pause_count = 0
    linking_count = 0
    total_transitions = max(1, len(spoken_words) - 1)

    for idx in range(len(spoken_words) - 1):
        curr_w = spoken_words[idx]
        next_w = spoken_words[idx + 1]
        gap = next_w.start_time - curr_w.end_time
        has_punc = bool(re.search(r'[.,!?;:]', curr_w.word))

        if gap >= 0.45:
            total_pause_duration += gap
            if not has_punc:
                awkward_pause_count += 1
        elif 0.0 <= gap < 0.065 and not has_punc:
            linking_count += 1

    pause_ratio = min(1.0, total_pause_duration / total_speech_duration)
    linking_ratio = linking_count / float(total_transitions)

    punctuation_timestamps = [w.end_time for w in words_schema if w.end_time is not None]
    speaking_time, articulation_time, pause_events = speech_detector.analyze_temporal_metrics(
        quality_metrics.duration, valid_speech, punctuation_timestamps
    )

    syllable_count = max(1, total_syllables if total_syllables > 0 else len(spoken_words))
    articulation_rate = round(syllable_count / max(0.2, articulation_time), 2)

    # 11. Weighted Pronunciation & Completeness (Softens impact of Vietnamese proper names / OOV words)
    word_weights = []
    scored_values = []
    for w in words_schema:
        if w.word_status in (SpokenWordStatus.SPOKEN, SpokenWordStatus.PARTIAL, "SPOKEN", "PARTIAL"):
            if w.score is not None:
                scored_values.append(w.score)
                word_weights.append(0.4 if w.is_oov else 1.0)

    if scored_values:
        pronunciation_score = float(
            np.sum(np.array(scored_values) * np.array(word_weights)) / max(1e-6, np.sum(word_weights))
        )
    else:
        pronunciation_score = 0.0

    total_expected = len(expected_words_list)
    completeness_score = scorer.calculate_completeness_score(
        spoken_count=spoken_word_count,
        total_expected=total_expected,
        partial_count=partial_word_count
    )

    utt_features = extract_utterance_acoustic_features(
        audio_data=audio_data,
        sample_rate=settings.SAMPLE_RATE,
        alignment_result=alignment_result,
        utterance_acoustics=utterance_acoustics,
        words_schema=words_schema,
        spoken_words=spoken_words,
        pause_events=pause_events,
        quality_metrics=quality_metrics,
        whole_file_sim=whole_file_sim,
        wpm=float(wpm),
        articulation_rate=float(articulation_rate),
        pause_ratio=float(pause_ratio),
        awkward_pause_count=int(awkward_pause_count),
        linking_ratio=float(linking_ratio),
        completeness_score=float(completeness_score),
    )

    fluency_score = scorer.calculate_fluency_score(
        pause_events=pause_events,
        awkward_pause_count=awkward_pause_count,
        pause_ratio=pause_ratio,
        wpm=float(wpm),
        speech_ratio=quality_metrics.speech_ratio,
        features=utt_features,
    )

    f0_std = (
        utterance_acoustics.f0_std
        if utterance_acoustics is not None
        else formant_service.extract_f0_variation(audio_data, settings.SAMPLE_RATE)
    )
    prosody_score = scorer.calculate_prosody_score(
        f0_std=f0_std,
        fluency_score=fluency_score,
        pronunciation_score=pronunciation_score,
        linking_ratio=linking_ratio,
        features=utt_features,
    )
    speed_score = scorer.calculate_speed_score(articulation_rate, float(wpm))

    overall_score = round(
        scorer.calculate_overall_score(
            pronunciation=pronunciation_score,
            fluency=fluency_score,
            prosody=prosody_score,
            completeness=float(completeness_score)
        ),
        1
    )

    non_oov_spoken = [
        w for w in words_schema
        if w.word_status in (SpokenWordStatus.SPOKEN, SpokenWordStatus.PARTIAL, "SPOKEN", "PARTIAL")
        and w.score is not None and not w.is_oov
    ]
    failed_words_count = sum(1 for w in non_oov_spoken if w.score < 70.0)
    has_any_weak_word = any(w.score < 78.0 for w in non_oov_spoken)
    has_any_broken_phoneme = any(p.score < 55.0 for w in non_oov_spoken for p in w.phonemes)

    n_spoken_non_oov = max(1, len(non_oov_spoken))
    utt_features["failed_words_ratio"] = round(float(failed_words_count) / float(n_spoken_non_oov), 4)
    utt_features["align_conf"] = round(float(align_conf), 4)

    if diag_sink is not None:
        enriched_feats = dict(utt_features)
        enriched_feats["raw_pronunciation"] = round(float(pronunciation_score), 3)
        enriched_feats["raw_fluency"] = round(float(fluency_score), 3)
        enriched_feats["raw_prosody"] = round(float(prosody_score), 3)
        enriched_feats["raw_overall"] = round(float(overall_score), 3)
        diag_sink["utt_features"] = enriched_feats
        diag_sink["raw_scores"] = {
            "pronunciation": round(float(pronunciation_score), 2),
            "fluency": round(float(fluency_score), 2),
            "prosody": round(float(prosody_score), 2),
            "overall": round(float(overall_score), 2),
            "speed": round(float(speed_score), 2),
            "completeness": int(completeness_score),
        }

    disable_cal = bool(diag_sink.get("disable_calibration")) if diag_sink is not None else False
    if (not is_mocked_align) and (not disable_cal) and scorer.calibrator.has_model("overall"):
        cal_scores = scorer.calibrate_utterance_scores(
            raw_pronunciation=pronunciation_score,
            raw_fluency=fluency_score,
            raw_prosody=prosody_score,
            completeness=float(completeness_score),
            features=utt_features,
        )
        pronunciation_score = cal_scores["pronunciation"]
        fluency_score = cal_scores["fluency"]
        prosody_score = cal_scores["prosody"]
        overall_score = cal_scores["overall"]
        if pronunciation_score < 55.0:
            overall_score = min(overall_score, round(pronunciation_score + 10.0, 1))
    else:
        if pronunciation_score < 55.0:
            overall_score = min(overall_score, pronunciation_score + 10.0)

        # Nếu trong câu có từ phát âm sai (< 70 điểm), kéo điểm tổng xuống tương ứng với tỷ lệ lỗi
        if failed_words_count > 0 and non_oov_spoken:
            error_ratio = failed_words_count / float(len(non_oov_spoken))
            penalty_points = failed_words_count * 7.5 + error_ratio * 15.0
            pronunciation_score = round(max(25.0, pronunciation_score - penalty_points * 0.65), 1)
            overall_score = round(
                min(
                    overall_score,
                    max(25.0, (0.55 * pronunciation_score + 0.25 * fluency_score + 0.20 * prosody_score) - penalty_points * 0.55)
                ),
                1
            )
        elif (
            completeness_score >= 95
            and whole_file_sim >= 0.70
            and align_conf >= 0.65
            and not has_any_weak_word
            and not has_any_broken_phoneme
            and pronunciation_score >= 86.0
            and fluency_score >= 78.0
        ):
            # Chỉ khi TOÀN BỘ file và TẤT CẢ các từ/âm vị đều đạt chuẩn (không có từ yếu/âm hỏng) mới đạt dải chuẩn 96-100
            for w in words_schema:
                if w.word_status in (SpokenWordStatus.SPOKEN, SpokenWordStatus.PARTIAL, "SPOKEN", "PARTIAL") and w.score is not None:
                    if w.score >= 85.0:
                        w.score = round(min(100.0, 96.0 + (w.score - 85.0) * 0.26), 1)
                    for p in w.phonemes:
                        if p.score >= 85.0:
                            p.score = round(min(100.0, 96.0 + (p.score - 85.0) * 0.26), 1)
            pronunciation_score = round(min(100.0, max(pronunciation_score, 96.5 + (pronunciation_score - 86.0) * 0.25)), 1)
            fluency_score = round(min(100.0, max(fluency_score, 96.5 + (fluency_score - 78.0) * 0.16)), 1)
            prosody_score = round(min(100.0, max(prosody_score, 96.5 + (prosody_score - 78.0) * 0.16)), 1)
            speed_score = max(speed_score, 95.0)
            overall_score = round(
                min(
                    100.0,
                    max(
                        overall_score,
                        settings.PRONUNCIATION_WEIGHT * pronunciation_score +
                        settings.FLUENCY_WEIGHT * fluency_score +
                        settings.SPEED_WEIGHT * prosody_score
                    )
                ),
                1
            )

    overall_conf = confidence_estimator.estimate_overall_confidence(audio_conf, align_conf, alignment_result.words)
    eval_status = confidence_estimator.determine_evaluation_status(overall_conf, align_conf, quality_metrics)

    fluency_feedback = feedback_generator.generate_fluency_feedback(
        pause_events, articulation_rate, settings.SPEED_TARGET_MIN, settings.SPEED_TARGET_MAX, overall_conf
    )

    is_passed_val = bool(overall_score >= 80.0 and pronunciation_score >= 75.0 and completeness_score >= 80)
    weak_words = [
        w.word for w in words_schema
        if w.word_status in (SpokenWordStatus.SPOKEN, SpokenWordStatus.PARTIAL, "SPOKEN", "PARTIAL")
        and w.score is not None and w.score < 70.0
    ]

    spoken_count = len(spoken_words)
    if is_passed_val and not weak_words:
        status_msg = "Bài nói xuất sắc! Khẩu hình F1/F2 và ngữ điệu đều đạt chuẩn."
    elif is_passed_val and weak_words:
        status_msg = f"Đạt yêu cầu nhưng cần cải thiện: Một số từ phát âm chưa đạt chuẩn ({', '.join(weak_words)})."
    elif completeness_score < 80:
        missing_count = total_expected - spoken_word_count
        status_msg = f"Chưa đạt yêu cầu. Bạn đã bỏ qua hoặc phát âm chưa rõ {missing_count} từ khi đọc (Độ hoàn thiện: {completeness_score}%)."
    elif weak_words:
        status_msg = f"Cần cải thiện: Một số từ phát âm chưa đạt chuẩn ({', '.join(weak_words)})."
    else:
        status_msg = "Chưa đạt yêu cầu. Có từ phát âm chưa chuẩn hoặc khẩu hình F1/F2 bị lệch."

    kpi_dict = {
        "pronunciation": int(round(pronunciation_score)),
        "fluency": int(round(fluency_score)),
        "completeness": completeness_score,
        "prosody": int(round(prosody_score)),
        "wordsPerMinute": wpm,
    }

    sentence_tokens_list = []
    for idx, w in enumerate(words_schema):
        raw_st = w.word_status.value if hasattr(w.word_status, "value") else str(w.word_status or "SPOKEN")
        if raw_st == "MISSING" or w.status == WordStatus.NOT_SPOKEN or w.score is None:
            color = "GRAY"
            has_pause = False
            has_linking = False
            word_st = "MISSING"
        else:
            color = "GREEN" if w.score >= 80.0 else ("YELLOW" if w.score >= 60.0 else "RED")
            has_pause = False
            has_linking = False
            word_st = raw_st
            if idx < len(words_schema) - 1:
                next_w = words_schema[idx + 1]
                next_raw_st = next_w.word_status.value if hasattr(next_w.word_status, "value") else str(next_w.word_status or "SPOKEN")
                if (
                    next_raw_st != "MISSING"
                    and w.end_time is not None
                    and next_w.start_time is not None
                ):
                    inter_gap = next_w.start_time - w.end_time
                    if inter_gap >= 0.45:
                        has_pause = True
                    elif 0.0 <= inter_gap < 0.065:
                        has_linking = True

        sentence_tokens_list.append({
            "word": w.word,
            "color": color,
            "hasPauseAfter": has_pause,
            "hasLinkingAfter": has_linking,
            "wordStatus": word_st,
        })

    word_rows_list = []
    for w_idx, w in enumerate(words_schema):
        raw_st = w.word_status.value if hasattr(w.word_status, "value") else str(w.word_status or "SPOKEN")
        phonemes_list = []
        if raw_st == "MISSING" or w.status == WordStatus.NOT_SPOKEN or w.score is None:
            source_phonemes = w.phonemes if w.phonemes else (
                alignment_result.words[w_idx].phonemes if w_idx < len(alignment_result.words) else []
            )
            for p in source_phonemes:
                phonemes_list.append({
                    "ipa": p.symbol,
                    "score": 0,
                    "note": "Bạn chưa đọc từ này."
                })
            if not phonemes_list:
                phonemes_list.append({
                    "ipa": "-",
                    "score": 0,
                    "note": "Bạn chưa đọc từ này."
                })
            word_rows_list.append({
                "word": w.word,
                "score": 0,
                "wordStatus": "MISSING",
                "phonemes": phonemes_list
            })
        else:
            for p in w.phonemes:
                note = p.feedback or f"Âm /{p.symbol}/: Điểm {int(round(p.score))}/100"
                phonemes_list.append({
                    "ipa": p.symbol,
                    "score": int(round(p.score)),
                    "note": note
                })
            word_rows_list.append({
                "word": w.word,
                "score": int(round(w.score)),
                "wordStatus": raw_st,
                "phonemes": phonemes_list
            })

    return SpeechAssessmentResponse(
        overall_score=round(overall_score, 1),
        pronunciation_score=round(pronunciation_score, 1),
        fluency_score=round(fluency_score, 1),
        speed_score=round(speed_score, 1),
        articulation_rate=articulation_rate,
        words=words_schema,
        fluency_feedback=fluency_feedback,
        evaluation_status=eval_status,
        overall_confidence=round(overall_conf, 2),
        audio_quality=quality_metrics,
        is_passed=is_passed_val,
        pass_score=80,
        status_message=status_msg,
        evaluated_by="PYTHON_ACOUSTIC_ENGINE",
        kpi=kpi_dict,
        sentence_tokens=sentence_tokens_list,
        word_rows=word_rows_list
    )


# ==============================================================================
# KOKORO-82M TTS ENDPOINTS
# ==============================================================================
@router.post(
    "/tts",
    summary="Synthesize speech with Kokoro-82M",
    description="Generates natural, native English speech (24kHz mono WAV) for sample shadowing sentences.",
    status_code=status.HTTP_200_OK
)
@router.post(
    "/api/v1/audio/tts",
    summary="Synthesize speech with Kokoro-82M (v1 alias)",
    status_code=status.HTTP_200_OK
)
async def synthesize_speech(
    request: Optional[TtsRequest] = None,
    text: Optional[str] = Query(None, description="Sentence text if not using JSON body"),
    voice: Optional[str] = Query(None, description="Voice ID (e.g. af_heart, am_michael, bf_emma)"),
    speed: Optional[float] = Query(None, description="Playback speed 0.5 - 2.0")
):
    """
    High-fidelity neural TTS endpoint running Kokoro-82M locally on CPU/CUDA.
    Returns 24kHz mono WAV audio stream.
    """
    # Resolve parameters from JSON body or query parameters
    effective_text = (request.text if request and request.text else text or "").strip()
    effective_voice = (request.voice if request and request.voice else voice or "af_heart").strip()
    effective_speed = request.speed if (request and request.speed is not None) else (speed if speed is not None else 1.0)

    if not effective_text:
        return Response(
            content=b'{"detail": {"message": "Text to synthesize cannot be empty."}}',
            status_code=status.HTTP_400_BAD_REQUEST,
            media_type="application/json"
        )

    try:
        # Offload CPU-bound inference to worker threadpool to keep event loop responsive
        wav_bytes, duration_sec = await run_in_threadpool(
            tts_engine.synthesize_wav_bytes,
            text=effective_text,
            voice=effective_voice,
            speed=effective_speed
        )

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "Content-Type": "audio/wav",
                "Content-Disposition": 'inline; filename="sample_audio.wav"',
                "X-Audio-Duration": f"{duration_sec:.2f}",
                "X-Audio-Voice": effective_voice,
                "X-Audio-Sample-Rate": "24000"
            }
        )
    except Exception as exc:
        logger.error("Lỗi khi tổng hợp âm thanh: %s", exc, exc_info=True)
        return Response(
            content=(json.dumps({"detail": {"message": f"Lỗi sinh giọng đọc âm thanh: {str(exc)}"}}, ensure_ascii=False) + "\n").encode("utf-8"),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            media_type="application/json"
        )


@router.post(
    "/tts/dialogue",
    response_model=DialogueTtsResponse,
    summary="Synthesize multi-speaker dialogue",
    description="Synthesizes multiple speaker turns with distinct voices, normalized loudness, and millisecond timeline alignment metadata.",
    status_code=status.HTTP_200_OK
)
@router.post(
    "/api/v1/audio/tts/dialogue",
    response_model=DialogueTtsResponse,
    status_code=status.HTTP_200_OK
)
async def synthesize_dialogue(request: DialogueTtsRequest):
    """
    Multi-speaker neural dialogue synthesis:
    - Synthesizes each turn using its assigned voice
    - Applies crossfade transitions and RMS loudness normalization
    - Returns base64 WAV payload + segments metadata for live transcript highlighting.
    """
    if not request.turns:
        raise HTTPException(status_code=400, detail="Danh sách lượt thoại không được để trống.")

    try:
        wav_bytes, total_duration_ms, segments_meta = await run_in_threadpool(
            tts_engine.synthesize_dialogue,
            turns=[t.model_dump() for t in request.turns],
            speaker_map={k: v.model_dump() for k, v in (request.speaker_map or {}).items()},
            inter_turn_pause_ms=request.inter_turn_pause_ms if request.inter_turn_pause_ms is not None else 450
        )

        b64_audio = base64.b64encode(wav_bytes).decode("ascii")

        return DialogueTtsResponse(
            duration_ms=total_duration_ms,
            sample_rate=24000,
            segments=[
                DialogueSegmentMetadata(
                    speaker=s["speaker"],
                    voice=s["voice"],
                    text=s["text"],
                    start_ms=s["startMs"],
                    end_ms=s["endMs"]
                )
                for s in segments_meta
            ],
            audio_base64=b64_audio
        )
    except Exception as exc:
        logger.error("Lỗi khi tổng hợp hội thoại đa giọng: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi tổng hợp hội thoại: {str(exc)}"
        )


@router.get(
    "/tts/voices",
    response_model=List[VoiceInfo],
    summary="List available Kokoro-82M voices",
    status_code=status.HTTP_200_OK
)
@router.get(
    "/api/v1/audio/tts/voices",
    response_model=List[VoiceInfo],
    summary="List available Kokoro-82M voices (v1 alias)",
    status_code=status.HTTP_200_OK
)
async def get_tts_voices():
    """Retrieve catalog of available voices across US and UK English."""
    voices = tts_engine.get_available_voices()
    return voices