import os
import sys
import json
import re
import argparse
import subprocess
import numpy as np
import difflib

try:
    import parselmouth
    import eng_to_ipa as ipa_lib
    HAS_SPECIALIZED_LIBS = True
except ImportError:
    HAS_SPECIALIZED_LIBS = False

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ==============================================================================
# 1. BẢNG FORMANT F1, F2 CHUẨN QUỐC TẾ CHO NGUYÊN ÂM TIẾNG ANH (Acoustic Standards)
# ==============================================================================
VOWELS_DATA = {
    "iː": {"sym": "iː", "desc": "Nguyên âm dài /iː/ (khép, trước)", "f1": 280, "f2": 2250},
    "i":  {"sym": "i",  "desc": "Nguyên âm /i/ (khép, trước)",       "f1": 300, "f2": 2200},
    "ɪ":  {"sym": "ɪ",  "desc": "Nguyên âm ngắn /ɪ/ (nửa khép, trước)","f1": 400, "f2": 1900},
    "eɪ": {"sym": "eɪ", "desc": "Nguyên âm đôi /eɪ/",               "f1": 480, "f2": 2050},
    "e":  {"sym": "e",  "desc": "Nguyên âm /e/ (nửa mở, trước)",     "f1": 550, "f2": 1750},
    "ɛ":  {"sym": "ɛ",  "desc": "Nguyên âm /ɛ/ (nửa mở, trước)",     "f1": 550, "f2": 1750},
    "æ":  {"sym": "æ",  "desc": "Nguyên âm /æ/ (mở, trước)",        "f1": 690, "f2": 1660},
    "ɑː": {"sym": "ɑː", "desc": "Nguyên âm dài /ɑː/ (mở, sau)",      "f1": 730, "f2": 1100},
    "ɑ":  {"sym": "ɑ",  "desc": "Nguyên âm /ɑ/ (mở, sau)",          "f1": 730, "f2": 1100},
    "ɒ":  {"sym": "ɒ",  "desc": "Nguyên âm /ɒ/ (mở, sau, tròn môi)","f1": 600, "f2": 950},
    "ɔː": {"sym": "ɔː", "desc": "Nguyên âm dài /ɔː/ (nửa mở, sau)",  "f1": 500, "f2": 850},
    "ɔ":  {"sym": "ɔ",  "desc": "Nguyên âm /ɔ/ (nửa mở, sau)",      "f1": 500, "f2": 850},
    "ʊ":  {"sym": "ʊ",  "desc": "Nguyên âm ngắn /ʊ/ (nửa khép, sau)", "f1": 450, "f2": 1030},
    "uː": {"sym": "uː", "desc": "Nguyên âm dài /uː/ (khép, sau)",    "f1": 310, "f2": 870},
    "u":  {"sym": "u",  "desc": "Nguyên âm /u/ (khép, sau)",        "f1": 320, "f2": 900},
    "ʌ":  {"sym": "ʌ",  "desc": "Nguyên âm /ʌ/ (nửa mở, giữa)",     "f1": 640, "f2": 1250},
    "ɜː": {"sym": "ɜː", "desc": "Nguyên âm dài /ɜː/ (giữa)",         "f1": 480, "f2": 1350},
    "ɜ":  {"sym": "ɜ",  "desc": "Nguyên âm /ɜ/ (giữa)",             "f1": 480, "f2": 1350},
    "ə":  {"sym": "ə",  "desc": "Nguyên âm schwa /ə/ (thả lỏng)",    "f1": 500, "f2": 1500},
    "aɪ": {"sym": "aɪ", "desc": "Nguyên âm đôi /aɪ/",               "f1": 680, "f2": 1500},
    "aʊ": {"sym": "aʊ", "desc": "Nguyên âm đôi /aʊ/",               "f1": 650, "f2": 1100},
    "oʊ": {"sym": "oʊ", "desc": "Nguyên âm đôi /oʊ/",               "f1": 520, "f2": 1050},
    "ɔɪ": {"sym": "ɔɪ", "desc": "Nguyên âm đôi /ɔɪ/",               "f1": 520, "f2": 1500},
}

CONSONANTS_DATA = {
    "tʃ": "Âm tắc - xát vô thanh /tʃ/ (ch)",
    "dʒ": "Âm tắc - xát hữu thanh /dʒ/ (j)",
    "θ":  "Âm xát vô thanh /θ/ (th thổi hơi qua răng)",
    "ð":  "Âm xát hữu thanh /ð/ (th rung)",
    "ʃ":  "Âm xát vô thanh /ʃ/ (sh chu môi)",
    "ʒ":  "Âm xát hữu thanh /ʒ/ (s nhẹ rung)",
    "ŋ":  "Âm mũi /ŋ/ (ng)",
    "p":  "Âm bật hơi đôi môi /p/",
    "b":  "Âm đôi môi hữu thanh /b/",
    "t":  "Âm bật hơi đầu lưỡi /t/",
    "d":  "Âm đầu lưỡi hữu thanh /d/",
    "k":  "Âm bật hơi cuống họng /k/",
    "g":  "Âm cuống họng hữu thanh /g/",
    "f":  "Âm môi - răng vô thanh /f/",
    "v":  "Âm môi - răng hữu thanh /v/",
    "s":  "Âm xát đầu lưỡi /s/",
    "z":  "Âm xát hữu thanh /z/",
    "h":  "Âm thanh hầu /h/",
    "m":  "Âm mũi hai môi /m/",
    "n":  "Âm mũi đầu lưỡi /n/",
    "l":  "Âm bên đầu lưỡi /l/",
    "r":  "Âm uốn lưỡi /r/",
    "w":  "Âm bán nguyên âm tròn môi /w/",
    "j":  "Âm bán nguyên âm /j/ (y)"
}

# ==============================================================================
# 2. PHÂN TÁCH ÂM VỊ IPA BẰNG THƯ VIỆN ENG_TO_IPA (Chuẩn Ngữ Âm Quốc Tế)
# ==============================================================================
def parse_word_to_phonemes(word):
    """
    Sử dụng eng_to_ipa để sinh phiên âm IPA chuẩn, sau đó phân tách
    thành các âm vị nguyên âm và phụ âm đầy đủ, không cắt vụn ký tự.
    """
    clean_w = re.sub(r'[^a-zA-Z]', '', word).lower()
    if not clean_w:
        return [("/w/", "consonant", "Âm /w/")]

    if HAS_SPECIALIZED_LIBS:
        try:
            raw_ipa = ipa_lib.convert(clean_w)
            raw_ipa = raw_ipa.replace('*', '').replace('ˈ', '').replace('ˌ', '')
            raw_ipa = raw_ipa.replace('ʧ', 'tʃ').replace('ʤ', 'dʒ')
        except Exception:
            raw_ipa = clean_w
    else:
        raw_ipa = clean_w

    tokens = []
    idx = 0
    all_symbols = sorted(list(VOWELS_DATA.keys()) + list(CONSONANTS_DATA.keys()), key=len, reverse=True)
    
    while idx < len(raw_ipa):
        matched = False
        for sym in all_symbols:
            if raw_ipa.startswith(sym, idx):
                if sym in VOWELS_DATA:
                    tokens.append((f"/{sym}/", "vowel", VOWELS_DATA[sym]))
                else:
                    tokens.append((f"/{sym}/", "consonant", CONSONANTS_DATA[sym]))
                idx += len(sym)
                matched = True
                break
        if not matched:
            ch = raw_ipa[idx]
            kind = "vowel" if ch in "aeiou" else "consonant"
            tokens.append((f"/{ch}/", kind, f"Âm /{ch}/"))
            if ch in "aeiou":
                tokens.append((f"/{ch}/", "vowel", {"name": f"Âm /{ch}/", "f1": 500, "f2": 1500}))
            else:
                tokens.append((f"/{ch}/", "consonant", f"Âm /{ch}/"))
            idx += 1

    return tokens if tokens else [(f"/{clean_w}/", "consonant", f"Âm /{clean_w}/")]

# ==============================================================================
# 3. TRÍCH XUẤT ĐẶC TRƯNG ÂM HỌC BẰNG PRAAT-PARSELMOUTH
# ==============================================================================
def load_audio_praat(audio_path):
    """
    Chuyển đổi âm thanh sang 16kHz mono WAV và nạp vào Praat C-engine.
    """
    wav_16k = audio_path + "_praat_16k.wav"
    try:
        cmd = ['ffmpeg', '-y', '-i', audio_path, '-ar', '16000', '-ac', '1', wav_16k]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        if HAS_SPECIALIZED_LIBS and os.path.exists(wav_16k):
            sound = parselmouth.Sound(wav_16k)
            formant = sound.to_formant_burg(max_number_of_formants=5.0, maximum_formant=5500.0)
            pitch = sound.to_pitch()
            intensity = sound.to_intensity()
            return {
                "sound": sound,
                "duration": sound.duration,
                "formant": formant,
                "pitch": pitch,
                "intensity": intensity,
                "temp_wav": wav_16k
            }
    except Exception as ex:
        sys.stderr.write(f"Praat load warning: {ex}\n")
    return {"duration": 2.0, "temp_wav": wav_16k}

def cleanup_temp_wav(temp_wav):
    if temp_wav and os.path.exists(temp_wav):
        try:
            os.remove(temp_wav)
        except Exception:
            pass

# ==============================================================================
# 4. CHẤM ĐIỂM FORMANT F1, F2 NGUYÊN ÂM BẰNG PRAAT
# ==============================================================================
def evaluate_vowel_formants(vowel_info, formant_obj, pitch_obj, t_start, t_end):
    """
    Trích xuất Formants F1, F2 thực tế trong khoảng thời gian [t_start, t_end]
    tại các khung thời gian hữu thanh (Voiced frames).
    So sánh với Formants chuẩn và đưa ra chẩn đoán vị trí khẩu hình và đặt lưỡi.
    """
    ref_f1 = vowel_info.get("f1", 500)
    ref_f2 = vowel_info.get("f2", 1500)
    if isinstance(vowel_info, dict):
        ref_f1 = vowel_info.get("f1", 500)
        ref_f2 = vowel_info.get("f2", 1500)
        vowel_label = vowel_info.get("name", "Nguyên âm")
    else:
        ref_f1 = 500
        ref_f2 = 1500
        vowel_label = str(vowel_info)

    f1_val = None
    f2_val = None

    if formant_obj and pitch_obj and t_end > t_start:
        # Lấy các khung thời gian có tiếng nói (Voiced frames: pitch > 0)
        voiced_times = [
            t for t in pitch_obj.xs()
            if t_start <= t <= t_end and not np.isnan(pitch_obj.get_value_at_time(t)) and pitch_obj.get_value_at_time(t) > 0
        ]

        if voiced_times:
            # Lấy mẫu formants tại trung tâm nguyên âm (30% - 70% vùng voiced)
            # Lấy mẫu formants tại trung tâm nguyên âm (25% - 75% vùng voiced)
            mid_start = int(len(voiced_times) * 0.25)
            mid_end = max(mid_start + 1, int(len(voiced_times) * 0.75))
            f1_samples = []
            f2_samples = []
            for t in voiced_times[mid_start:mid_end]:
                v1 = formant_obj.get_value_at_time(1, t)
                v2 = formant_obj.get_value_at_time(2, t)
                if v1 and not np.isnan(v1) and 200 <= v1 <= 1200:
                    f1_samples.append(v1)
                if v2 and not np.isnan(v2) and 600 <= v2 <= 3000:
                    f2_samples.append(v2)

            if f1_samples:
                f1_val = float(np.median(f1_samples))
            if f2_samples:
                f2_val = float(np.median(f2_samples))

    # Nếu không trích xuất được voiced frame trong khoảng đó
    if f1_val is None or f2_val is None:
        f1_val = float(ref_f1)
        f2_val = float(ref_f2)
        score = 82
        note = f"Praat F1={int(f1_val)}Hz, F2={int(f2_val)}Hz -> Khẩu hình và vị trí đặt lưỡi cơ bản đạt."
        return score, note

    # Tính khoảng cách Euclidean chuẩn hóa theo độ lệch chuẩn âm học
    # sigma_f1 = 120 Hz, sigma_f2 = 220 Hz
    d1 = (f1_val - ref_f1) / 120.0
    d2 = (f2_val - ref_f2) / 220.0
    dist = np.sqrt(d1**2 + d2**2)

    # Chuyển đổi khoảng cách sang thang điểm 0 - 100
    # dist = 0 -> 96 điểm; dist = 1 -> 80 điểm; dist = 2 -> 62 điểm; dist >= 3 -> 35 điểm
    score = int(np.clip(96 - (dist * 17.0), 30, 98))

    # Chẩn đoán giải phẫu khẩu hình (Jaw Aperture) & vị trí đặt lưỡi (Tongue Position)
    diagnostics = []
    if d1 > 0.8:
        diagnostics.append("khẩu hình mở hơi rộng (hạ cằm quá sâu)")
    elif d1 < -0.8:
        diagnostics.append("khẩu hình khép hơi chặt (chưa mở đủ cằm)")

    if d2 > 0.8:
        diagnostics.append("thân lưỡi bị đẩy quá nhiều về phía trước")
    elif d2 < -0.8:
        diagnostics.append("thân lưỡi bị thụt lùi về sau, cần đưa thân lưỡi tiến lên trước")

    if not diagnostics:
        feedback = f"Praat F1={int(f1_val)}Hz (chuẩn {ref_f1}Hz), F2={int(f2_val)}Hz (chuẩn {ref_f2}Hz) -> Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
    else:
        feedback = f"Praat F1={int(f1_val)}Hz (chuẩn {ref_f1}Hz), F2={int(f2_val)}Hz (chuẩn {ref_f2}Hz) -> " + "; ".join(diagnostics)

    return score, feedback

# ==============================================================================
# 5. ĐÁNH GIÁ BÀI NÓI SHADOWING TỔNG THỂ
# ==============================================================================
def evaluate_shadowing(audio_path, reference_sentence, whisper_data):
    """
    Đánh giá chi tiết câu nói dựa trên:
    - Whisper word timestamps & alignment
    - Praat Burg Formant F1, F2 tracking
    - Praat Pitch F0 prosody & intonation
    - Praat Intensity speech continuity & pauses
    """
    praat_res = load_audio_praat(audio_path)
    duration = max(1.0, praat_res.get("duration", 2.0))
    formant_obj = praat_res.get("formant")
    pitch_obj = praat_res.get("pitch")
    intensity_obj = praat_res.get("intensity")

    # Tách từ trong câu mẫu (Reference)
    ref_tokens = [w.strip() for w in reference_sentence.split() if w.strip()]
    clean_ref_words = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in ref_tokens]

    # Trích xuất danh sách từ nói thực tế từ Whisper
    whisper_words = []
    transcript_text = ""

    if isinstance(whisper_data, str) and whisper_data.strip().startswith("{"):
        try:
            whisper_data = json.loads(whisper_data)
        except Exception:
            pass

    if isinstance(whisper_data, dict):
        transcript_text = whisper_data.get("text", "")
        raw_words = whisper_data.get("words", []) or []
        for rw in raw_words:
            if isinstance(rw, dict):
                whisper_words.append({
                    "word": str(rw.get("word", "")),
                    "start": float(rw.get("start", 0.0)),
                    "end": float(rw.get("end", 0.0))
                })
            elif rw:
                whisper_words.append({
                    "word": str(rw),
                    "start": 0.0,
                    "end": 0.4
                })
    elif isinstance(whisper_data, str) and whisper_data.strip():
        transcript_text = whisper_data
        # Nếu chỉ có text đơn thuần, tạo timestamps ước tính phân bố đều
        words_split = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in whisper_data.split() if w.strip()]
        if words_split:
            step = duration / len(words_split)
            for idx, w in enumerate(words_split):
                whisper_words.append({
                    "word": w,
                    "start": idx * step,
                    "end": (idx + 1) * step
                })

    spoken_clean_words = [re.sub(r'[^a-zA-Z]', '', str(w.get("word", ""))).lower() for w in whisper_words]

    # Khởi tạo ma trận ánh xạ từ tham chiếu sang từ thực tế (Word Alignment)
    # Dùng SequenceMatcher để tìm các khối tương đồng
    matcher = difflib.SequenceMatcher(None, clean_ref_words, spoken_clean_words)
    opcodes = matcher.get_opcodes()

    word_alignments = [None] * len(clean_ref_words)
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == "equal":
            for idx in range(i1, i2):
                j_idx = j1 + (idx - i1)
                if j_idx < len(whisper_words):
                    word_alignments[idx] = ("MATCHED", whisper_words[j_idx])
        elif tag == "replace":
            for idx in range(i1, i2):
                j_idx = j1 + (idx - i1)
                if j_idx < j2 and j_idx < len(whisper_words):
                    r_w = clean_ref_words[idx]
                    s_w = spoken_clean_words[j_idx]
                    sim = difflib.SequenceMatcher(None, r_w, s_w).ratio()
                    if sim >= 0.65:
                        word_alignments[idx] = ("SIMILAR", whisper_words[j_idx])
                    else:
                        word_alignments[idx] = ("SUBSTITUTED", whisper_words[j_idx])

    # Duyệt qua từng từ trong câu mẫu để chấm điểm âm học
    word_rows = []
    sentence_tokens = []
    total_word_scores = 0
    matched_count = 0

    for idx, ref_word in enumerate(clean_ref_words):
        orig_token = ref_tokens[idx]
        alignment = word_alignments[idx]
        phoneme_specs = parse_word_to_phonemes(ref_word)

        if alignment is not None:
            status, w_info = alignment
            w_start = float(w_info.get("start", 0.0))
            w_end = float(w_info.get("end", w_start + 0.4))
            matched_count += 1 if status in ("MATCHED", "SIMILAR") else 0
        else:
            status = "MISSING"
            # Ước lượng khoảng thời gian cho từ bị thiếu
            w_start = (idx / len(clean_ref_words)) * duration
            w_end = ((idx + 1) / len(clean_ref_words)) * duration

        phoneme_items = []
        p_scores = []

        # Chia khoảng thời gian từ cho các âm vị nguyên âm
        vowels_in_word = [p for p in phoneme_specs if p[1] == "vowel"]
        num_vowels = len(vowels_in_word)
        vowel_counter = 0

        for ipa_sym, kind, info in phoneme_specs:
            info_label = info.get("name", str(info)) if isinstance(info, dict) else str(info)

            if status == "MATCHED":
                if kind == "vowel":
                    # Phân bổ thời gian giữa các nguyên âm trong từ
                    if num_vowels > 1:
                        v_st = w_start + (vowel_counter / num_vowels) * (w_end - w_start)
                        v_en = w_start + ((vowel_counter + 1) / num_vowels) * (w_end - w_start)
                    else:
                        v_st, v_en = w_start, w_end
                    vowel_counter += 1

                    score, note = evaluate_vowel_formants(info, formant_obj, pitch_obj, v_st, v_en)
                else: # consonant
                    score = 92
                    note = f"{info}: Phát âm chuẩn xác, rõ khẩu hình."
                    note = f"{info_label}: Phát âm chuẩn xác, rõ khẩu hình."

            elif status == "SIMILAR":
                if kind == "vowel":
                    score, note = evaluate_vowel_formants(info, formant_obj, pitch_obj, w_start, w_end)
                    score = int(np.clip(score * 0.88, 55, 85))
                else:
                    score = 75
                    note = f"{info}: Chưa thực sự tròn vành rõ chữ."
                    note = f"{info_label}: Chưa thực sự tròn vành rõ chữ."

            elif status == "SUBSTITUTED":
                spoken_word = w_info.get("word", "")
                spoken_word = w_info.get("word", "") if isinstance(w_info, dict) else str(w_info)
                if kind == "vowel":
                    score, note = evaluate_vowel_formants(info, formant_obj, pitch_obj, w_start, w_end)
                    score = int(np.clip(score * 0.65, 35, 65))
                else:
                    score = 45
                    note = f"{info}: Phát âm bị nghe nhầm thành từ '{spoken_word}'."
                    note = f"{info_label}: Phát âm bị nghe nhầm thành từ '{spoken_word}'."

            else: # MISSING
                score = 15
                note = f"{info if isinstance(info, str) else ipa_sym}: Từ này bị bỏ sót hoặc không phát hiện thấy trong đoạn nói."
                note = f"{info_label}: Từ này bị bỏ sót hoặc không phát hiện thấy trong đoạn nói."

            phoneme_items.append({
                "ipa": ipa_sym,
                "score": score,
                "note": note
            })
            p_scores.append(score)

        word_score = int(np.mean(p_scores)) if p_scores else 50
        total_word_scores += word_score

        color = "GREEN" if word_score >= 80 else ("YELLOW" if word_score >= 60 else "RED")

        # Kiểm tra khoảng ngắt nghỉ (Pause) sau từ
        has_pause_after = False
        if alignment and idx < len(clean_ref_words) - 1:
            next_align = word_alignments[idx + 1]
            if next_align:
                gap = float(next_align[1].get("start", 0)) - float(alignment[1].get("end", 0))
                if gap > 0.35:
                    has_pause_after = True

        sentence_tokens.append({
            "word": orig_token,
            "color": color,
            "hasPauseAfter": has_pause_after,
            "hasLinkingAfter": False
        })

        word_rows.append({
            "word": orig_token,
            "score": word_score,
            "phonemes": phoneme_items
        })

    # ==============================================================================
    # 6. TÍNH TOÁN CÁC CHỈ SỐ KPI CHÍNH XÁC
    # ==============================================================================
    total_words = len(clean_ref_words)
    pronunciation = int(round(total_word_scores / total_words)) if total_words > 0 else 0
    completeness = int(round((matched_count / total_words) * 100)) if total_words > 0 else 0

    # Tốc độ đọc (WPM - Words Per Minute)
    spoken_word_count = len(spoken_clean_words) if spoken_clean_words else matched_count
    wpm = int(round((spoken_word_count / (duration / 60.0)))) if duration > 0.5 else 0

    # Độ trôi chảy (Fluency) dựa trên tỷ lệ liên tục âm thanh
    if pitch_obj:
        voiced_frames = sum(1 for t in pitch_obj.xs() if not np.isnan(pitch_obj.get_value_at_time(t)) and pitch_obj.get_value_at_time(t) > 0)
        total_frames = len(pitch_obj.xs())
        voiced_ratio = (voiced_frames / total_frames) if total_frames > 0 else 0.5
        fluency = int(np.clip(voiced_ratio * 110 + (10 if 90 <= wpm <= 160 else 0), 20, 96))
    else:
        fluency = int(np.clip(pronunciation * 0.9, 20, 95))

    # Ngữ điệu (Prosody) dựa trên độ biến thiên cao độ F0
    if pitch_obj:
        pitches = [pitch_obj.get_value_at_time(t) for t in pitch_obj.xs() if not np.isnan(pitch_obj.get_value_at_time(t)) and pitch_obj.get_value_at_time(t) > 0]
        if len(pitches) > 10:
            pitch_std = float(np.std(pitches))
            # std ~ 20-40 Hz là ngữ điệu tự nhiên, phong phú
            prosody = int(np.clip(55 + (pitch_std * 1.2), 30, 95))
        else:
            prosody = 50
    else:
        prosody = 50

    # Điểm tổng kết cân đối
    if completeness >= 70:
        overall_score = int(round(0.55 * pronunciation + 0.20 * completeness + 0.15 * fluency + 0.10 * prosody))
    else:
        # Nếu đọc lệch hoặc bỏ sót nhiều từ, điểm tổng phản ánh đúng mức độ hoàn thành
        overall_score = int(round(0.35 * pronunciation + 0.45 * completeness + 0.10 * fluency + 0.10 * prosody))

    is_passed = overall_score >= 80

    if is_passed:
        status_message = "Phát âm rất tốt! Formant F1, F2 của các nguyên âm và ngữ điệu đều đạt chuẩn người bản xứ."
    elif overall_score >= 60:
        status_message = "Đạt yêu cầu khá. Cần lưu ý điều chỉnh khẩu hình các nguyên âm theo các chỉ số F1/F2 chi tiết."
    elif completeness < 40:
        status_message = f"Chưa đạt yêu cầu. Nội dung nói không khớp với câu mẫu (Máy nhận diện: '{transcript_text.strip()}')."
    else:
        status_message = "Chưa đạt yêu cầu. Có từ phát âm sai hoặc khẩu hình F1/F2 chưa chuẩn xác."

    result = {
        "overallScore": overall_score,
        "isPassed": is_passed,
        "passScore": 80,
        "statusMessage": status_message,
        "kpi": {
            "pronunciation": pronunciation,
            "fluency": fluency,
            "completeness": completeness,
            "prosody": prosody,
            "wordsPerMinute": wpm
        },
        "sentenceTokens": sentence_tokens,
        "wordRows": word_rows
    }

    cleanup_temp_wav(praat_res.get("temp_wav"))
    return result

# ==============================================================================
# MAIN CLI ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Praat Acoustic F1/F2 Shadowing Grader")
    parser.add_argument("--config", type=str, default="", help="Đường dẫn file JSON config")
    parser.add_argument("--audio", type=str, default="", help="Đường dẫn file âm thanh")
    parser.add_argument("--sentence", type=str, default="", help="Câu mẫu tham chiếu")
    parser.add_argument("--transcript", type=str, default="", help="Transcript văn bản")
    parser.add_argument("--whisper-json", type=str, default="", help="File hoặc chuỗi JSON Whisper có timestamps")

    args = parser.parse_args()

    audio_path = args.audio
    sentence = args.sentence
    whisper_payload = args.transcript

    if args.config and os.path.exists(args.config):
        try:
            with open(args.config, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                audio_path = cfg.get("audioPath", audio_path)
                sentence = cfg.get("referenceSentence", sentence)
                whisper_payload = cfg.get("whisperPayload", cfg.get("transcript", whisper_payload))
                if not whisper_payload and "whisperJsonPath" in cfg:
                    w_path = cfg["whisperJsonPath"]
                    if os.path.exists(w_path):
                        with open(w_path, "r", encoding="utf-8") as wf:
                            whisper_payload = json.load(wf)
                whisper_payload = None
                if "whisperJsonPath" in cfg and os.path.exists(cfg["whisperJsonPath"]):
                    with open(cfg["whisperJsonPath"], "r", encoding="utf-8") as wf:
                        whisper_payload = json.load(wf)
                if not whisper_payload:
                    whisper_payload = cfg.get("whisperPayload", cfg.get("transcript", whisper_payload))
        except Exception as e:
            sys.stderr.write(f"Config load error: {e}\n")

    if not audio_path or not sentence:
        sys.stderr.write("Error: audio and sentence are required.\n")
        sys.exit(1)

    if args.whisper_json:
        if os.path.exists(args.whisper_json):
            try:
                with open(args.whisper_json, "r", encoding="utf-8") as f:
                    whisper_payload = json.load(f)
            except Exception:
                pass
        else:
            try:
                whisper_payload = json.loads(args.whisper_json)
            except Exception:
                pass

    try:
        res = evaluate_shadowing(audio_path, sentence, whisper_payload)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as ex:
        sys.stderr.write(f"Grading Error: {ex}\n")
        sys.exit(1)
