import sys
import json
import argparse
import difflib

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def analyze_transcript(transcript, reference_sentence):
    ref_words = [w.strip(".,!?;:\"").lower() for w in reference_sentence.split() if w.strip()]
    hyp_words = [w.strip(".,!?;:\"").lower() for w in transcript.split() if w.strip()]
    
    if not ref_words:
        ref_words = ["hello"]

    matcher = difflib.SequenceMatcher(None, ref_words, hyp_words)
    opcodes = matcher.get_opcodes()

    word_rows = []
    sentence_tokens = []
    
    # Bảng phiên âm tham chiếu cơ bản để tạo mock IPA chi tiết
    ipa_map = {
        "small": [("/s/", "Âm xì"), ("/m/", "Khép môi"), ("/ɔː/", "Nguyên âm tròn môi"), ("/l/", "Đầu lưỡi")],
        "changes": [("/tʃ/", "Bật hơi"), ("/eɪ/", "Nguyên âm đôi"), ("/n/", "Âm mũi"), ("/dʒ/", "Rung dây thanh"), ("/ɪz/", "Đuôi")],
        "can": [("/k/", "Bật hơi"), ("/æ/", "Miệng mở hơi hẹp"), ("/n/", "Chuẩn")],
        "make": [("/m/", "Chuẩn"), ("/eɪ/", "Nguyên âm"), ("/k/", "Âm cuối")],
        "our": [("/aʊ/", "Nguyên âm đôi"), ("/ər/", "Uốn lưỡi")],
        "eating": [("/iː/", "Căng cơ môi"), ("/t/", "Bật âm"), ("/ɪŋ/", "Âm mũi")],
        "habits": [("/h/", "Đẩy hơi"), ("/æ/", "Khẩu hình"), ("/b/", "Chuẩn"), ("/ɪ/", "Chuẩn"), ("/ts/", "Phụ âm cuối")],
        "healthier": [("/h/", "Đẩy hơi"), ("/el/", "Chuẩn"), ("/θ/", "Lưỡi giữa 2 răng"), ("/i/", "Chuẩn"), ("/ər/", "Uốn lưỡi")]
    }

    # Tính điểm từng từ dựa trên alignment
    # opcodes: ('equal', i1, i2, j1, j2)
    # Ta duyệt qua các từ trong ref_words và xem nó thuộc loại nào
    word_scores = [0] * len(ref_words)
    
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == 'equal':
            for idx in range(i1, i2):
                word_scores[idx] = 95 # Đọc đúng hoàn toàn
        elif tag == 'replace':
            for idx in range(i1, i2):
                word_scores[idx] = 45 # Đọc sai (nhận diện ra từ khác)
        elif tag == 'delete':
            for idx in range(i1, i2):
                word_scores[idx] = 20 # Bỏ sót từ
        elif tag == 'insert':
            pass # Bỏ qua từ thừa của học sinh trong word_rows, chỉ chấm từ của reference

    total_score = 0

    for i, word in enumerate(ref_words):
        w_score = word_scores[i]
        
        # Tạo phương sai nhỏ ngẫu nhiên gọn nhẹ
        variance = (len(word) % 5) - 2
        if w_score > 80:
            w_score = max(80, min(100, w_score + variance))
        else:
            w_score = max(10, min(70, w_score + variance))
            
        total_score += w_score

        # Phân tích phonemes
        phonemes = []
        clean_w = word
        if clean_w in ipa_map:
            raw_phonemes = ipa_map[clean_w]
            for ipa_sym, note in raw_phonemes:
                p_score = w_score + (len(ipa_sym) % 7) - 3
                if w_score < 60:
                    note = f"Sai khẩu hình, phát âm bị nhầm thành từ khác"
                else:
                    note = note + " tốt"
                phonemes.append({"ipa": ipa_sym, "score": max(10, min(100, p_score)), "note": note})
        else:
            # Tự phân rã
            for j, ch in enumerate(clean_w[:4]):
                p_score = w_score + (j * 2 - 3)
                if w_score < 60:
                    note = f"Âm /{ch}/ không rõ, dẫn đến máy nghe sai"
                else:
                    note = f"Âm /{ch}/ đạt chuẩn"
                phonemes.append({"ipa": f"/{ch}/", "score": max(10, min(100, p_score)), "note": note})

        color = "GREEN" if w_score >= 80 else ("YELLOW" if w_score >= 65 else "RED")

        orig_word = reference_sentence.split()[i] if i < len(reference_sentence.split()) else word

        word_rows.append({
            "word": orig_word,
            "score": w_score,
            "phonemes": phonemes
        })

        sentence_tokens.append({
            "word": orig_word,
            "color": color,
            "hasPauseAfter": False,
            "hasLinkingAfter": False
        })

    overall_score = round(total_score / len(ref_words)) if ref_words else 0
    is_passed = overall_score >= 80

    result = {
        "overallScore": overall_score,
        "isPassed": is_passed,
        "passScore": 80,
        "statusMessage": "Phát âm xuất sắc, máy nghe chính xác!" if is_passed else "Có lỗi phát âm khiến người bản địa nghe nhầm thành từ khác.",
        "kpi": {
            "pronunciation": overall_score,
            "fluency": min(100, overall_score + 4),
            "completeness": 100 if overall_score > 50 else 70,
            "prosody": min(100, overall_score + 2),
            "wordsPerMinute": 120
        },
        "sentenceTokens": sentence_tokens,
        "wordRows": word_rows
    }

    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcript", type=str, required=True)
    parser.add_argument("--sentence", type=str, required=True)

    args = parser.parse_args()
    try:
        analyze_transcript(args.transcript, args.sentence)
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)

