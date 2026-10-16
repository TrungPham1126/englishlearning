import base64
import logging
import re
from typing import List, Optional, Dict
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
    detect_spoken_prefix_count
)

logger = logging.getLogger("phonetics-service")
router = APIRouter()


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

    # 6. Spoken Word Sequence Alignment & Truncation Detection
    expected_words_list = clean_script.split()
    spoken_prefix_k = detect_spoken_prefix_count(audio_data, expected_words_list)
    logger.info("Spoken word prefix count: %d / %d", spoken_prefix_k, len(expected_words_list))

    if spoken_prefix_k == 0:
        raise EmptySpeechError("Không tìm thấy phát âm khớp với các từ trong câu mẫu.")

    # 7. Neural Forced Alignment on spoken prefix
    if spoken_prefix_k < len(expected_words_list):
        spoken_script = " ".join(expected_words_list[:spoken_prefix_k])
    else:
        spoken_script = clean_script

    alignment_result = await forced_aligner.align(audio_data, spoken_script)
    align_conf = alignment_result.alignment_confidence

    if align_conf < settings.MIN_ALIGNMENT_CONFIDENCE:
        raise LowAlignmentConfidenceError(
            round(align_conf, 2),
            settings.MIN_ALIGNMENT_CONFIDENCE,
            f"Độ tin cậy căn chỉnh âm thanh đạt {align_conf:.2f}, dưới ngưỡng {settings.MIN_ALIGNMENT_CONFIDENCE:.2f}."
        )

    # 7b. Append unspoken words as skipped words
    if spoken_prefix_k < len(expected_words_list):
        unspoken_words = expected_words_list[spoken_prefix_k:]
        unspoken_script = " ".join(unspoken_words)
        unspoken_phonemes = forced_aligner.g2p.convert_text(unspoken_script)

        for w_text, ph_list in unspoken_phonemes:
            ph_aligned = [
                AlignedPhoneme(
                    symbol=ph.symbol,
                    start=quality_metrics.duration,
                    end=quality_metrics.duration,
                    posterior=0.0,
                    confidence=0.0,
                    phoneme_type=ph.phoneme_type,
                    is_stress=ph.is_stress,
                    is_word_final=(p_i == len(ph_list) - 1),
                    raw_posterior=0.0,
                    has_frames=False
                )
                for p_i, ph in enumerate(ph_list)
            ]
            alignment_result.words.append(
                AlignedWord(
                    word=w_text,
                    start=quality_metrics.duration,
                    end=quality_metrics.duration,
                    phonemes=ph_aligned,
                    confidence=0.0,
                    skipped=True
                )
            )

    # 8. Speaker Pitch & Gender Detection
    speaker_gender, mean_f0 = formant_service.detect_gender(audio_data)
    logger.info("Detected speaker F0: %.1f Hz -> Profile: %s", mean_f0, speaker_gender)

    # 9. Acoustic Phoneme & Word Scoring
    words_schema: List[WordSchema] = []
    total_syllables = 0
    all_word_scores: List[float] = []
    spoken_word_count = 0
    partial_word_count = 0
    missing_triggered = False

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

        is_missing = False
        if getattr(word_obj, "skipped", False):
            is_missing = True
            missing_triggered = True
        elif missing_triggered:
            is_missing = True
        elif is_past_speech_end:
            is_missing = True
            missing_triggered = True
        elif overlap_ratio < 0.15 and (
            energy_ratio < settings.MISSING_WORD_MIN_ENERGY_RATIO or mean_raw_post < settings.MISSING_WORD_MIN_RAW_POSTERIOR
        ):
            is_missing = True
            if word_obj.start >= last_speech_time - 0.10:
                missing_triggered = True
        elif mean_raw_post < settings.MISSING_WORD_MIN_RAW_POSTERIOR and energy_ratio < settings.MISSING_WORD_MIN_ENERGY_RATIO:
            is_missing = True
            if word_obj.start >= last_speech_time - 0.10:
                missing_triggered = True

        if is_missing:
            phonemes_schema: List[PhonemeSchema] = []
            for p_obj in word_obj.phonemes:
                p_feedback = generate_phoneme_pedagogical_feedback(
                    symbol=p_obj.symbol,
                    score=0.0,
                    phoneme_type=p_obj.phoneme_type,
                    is_word_final=p_obj.is_word_final,
                    is_missing=True
                )
                phonemes_schema.append(
                    PhonemeSchema(
                        symbol=p_obj.symbol,
                        type=PhonemeType.VOWEL if p_obj.phoneme_type == "vowel" else PhonemeType.CONSONANT,
                        score=0.0,
                        feedback=p_feedback,
                        measured_f1=None,
                        measured_f2=None,
                        target_f1=None,
                        target_f2=None,
                        confidence=0.0,
                        status=MeasurementStatus.INSUFFICIENT_EVIDENCE
                    )
                )

            all_word_scores.append(0.0)
            words_schema.append(
                WordSchema(
                    word=word_obj.word,
                    start_time=word_obj.start,
                    end_time=word_obj.end,
                    score=0.0,
                    phonemes=phonemes_schema,
                    confidence=0.0,
                    status=WordStatus.NOT_SPOKEN,
                    word_status=SpokenWordStatus.MISSING,
                    is_oov=word_obj.is_oov
                )
            )
            continue

        phonemes_schema: List[PhonemeSchema] = []

        for p_idx, p_obj in enumerate(word_obj.phonemes):
            prec_ph = word_obj.phonemes[p_idx - 1].symbol if p_idx > 0 else (
                alignment_result.words[w_idx - 1].phonemes[-1].symbol if (w_idx > 0 and alignment_result.words[w_idx - 1].phonemes) else None
            )

            if p_obj.phoneme_type == "vowel":
                total_syllables += 1
                p_symbol = p_obj.symbol

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
                    word=word_obj.word
                )

                p_score = scorer.score_vowel(
                    formant_score,
                    p_obj.confidence,
                    align_conf,
                    p_obj.posterior,
                    symbol=p_symbol
                )
                p_conf = confidence_estimator.estimate_phoneme_confidence(p_obj, m_f1, status_str)

                p_feedback = generate_phoneme_pedagogical_feedback(
                    symbol=p_symbol,
                    score=p_score,
                    phoneme_type="vowel",
                    formant_feedback=p_formant_feedback
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

                if not has_evidence and p_obj.is_word_final and not is_coda_r:
                    p_score = 0.0
                    p_status = MeasurementStatus.INSUFFICIENT_EVIDENCE
                else:
                    p_score = scorer.score_consonant_gop(
                        p_obj.posterior,
                        p_obj.duration,
                        align_conf,
                        symbol=p_obj.symbol,
                        is_word_final=p_obj.is_word_final,
                        is_coda_r=is_coda_r,
                        acoustic_multiplier=acoustic_mult
                    )
                    p_status = MeasurementStatus.OK if has_evidence else MeasurementStatus.INSUFFICIENT_EVIDENCE

                p_feedback = generate_phoneme_pedagogical_feedback(
                    symbol=p_obj.symbol,
                    score=p_score,
                    phoneme_type="consonant",
                    acoustic_detail=acoustic_note,
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

        w_score = scorer.score_word(phonemes_schema, word_obj.phonemes, is_oov=word_obj.is_oov)
        evidence_count = sum(1 for p in phonemes_schema if p.score >= 30.0)
        evidence_ratio = evidence_count / float(max(1, len(phonemes_schema)))
        if w_score >= 60.0 or evidence_ratio >= settings.PARTIAL_WORD_MIN_EVIDENCE_RATIO:
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

        if gap >= 0.25:
            total_pause_duration += gap
            if not has_punc:
                awkward_pause_count += 1
        elif 0.0 <= gap < 0.035 and not has_punc:
            linking_count += 1

    pause_ratio = min(1.0, total_pause_duration / total_speech_duration)
    linking_ratio = linking_count / float(total_transitions)

    punctuation_timestamps = [w.end_time for w in words_schema if w.end_time is not None]
    speaking_time, articulation_time, pause_events = speech_detector.analyze_temporal_metrics(
        quality_metrics.duration, valid_speech, punctuation_timestamps
    )

    syllable_count = max(1, total_syllables if total_syllables > 0 else len(spoken_words))
    articulation_rate = round(syllable_count / max(0.2, articulation_time), 2)

    fluency_score = scorer.calculate_fluency_score(
        pause_events=pause_events,
        awkward_pause_count=awkward_pause_count,
        pause_ratio=pause_ratio,
        wpm=float(wpm),
        speech_ratio=quality_metrics.speech_ratio
    )

    # 11. Weighted Pronunciation (Softens impact of Vietnamese proper names / OOV words)
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

    f0_std = formant_service.extract_f0_variation(audio_data, settings.SAMPLE_RATE)
    prosody_score = scorer.calculate_prosody_score(
        f0_std=f0_std,
        fluency_score=fluency_score,
        pronunciation_score=pronunciation_score,
        linking_ratio=linking_ratio
    )
    speed_score = prosody_score

    overall_score = round(
        scorer.calculate_overall_score(
            pronunciation=pronunciation_score,
            fluency=fluency_score,
            prosody=prosody_score,
            completeness=float(completeness_score)
        ),
        1
    )

    if pronunciation_score < 75.0:
        overall_score = min(overall_score, pronunciation_score + 4.0)

    if completeness_score >= 90 and align_conf >= 0.70 and quality_metrics.is_acceptable:
        if pronunciation_score >= 82.0 and fluency_score >= 80.0:
            overall_score = max(overall_score, 90.0)

    overall_conf = confidence_estimator.estimate_overall_confidence(audio_conf, align_conf, alignment_result.words)
    eval_status = confidence_estimator.determine_evaluation_status(overall_conf, align_conf, quality_metrics)

    fluency_feedback = feedback_generator.generate_fluency_feedback(
        pause_events, articulation_rate, settings.SPEED_TARGET_MIN, settings.SPEED_TARGET_MAX, overall_conf
    )

    is_passed_val = bool(overall_score >= 80.0 and pronunciation_score >= 78.0 and completeness_score >= 80)
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
        missing_count = total_expected - spoken_count
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
                    if inter_gap >= 0.25:
                        has_pause = True
                    elif 0.0 <= inter_gap < 0.035:
                        has_linking = True

        sentence_tokens_list.append({
            "word": w.word,
            "color": color,
            "hasPauseAfter": has_pause,
            "hasLinkingAfter": has_linking,
            "wordStatus": word_st,
        })

    word_rows_list = []
    for w in words_schema:
        raw_st = w.word_status.value if hasattr(w.word_status, "value") else str(w.word_status or "SPOKEN")
        phonemes_list = []
        if raw_st == "MISSING" or w.status == WordStatus.NOT_SPOKEN or w.score is None:
            for p in w.phonemes:
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
            content=f'{{"detail": {{"message": "Lỗi sinh giọng đọc âm thanh: {str(exc)}"}}}}\n'.encode("utf-8"),
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
            inter_turn_pause_ms=request.inter_turn_pause_ms or 450
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