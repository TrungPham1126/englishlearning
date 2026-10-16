import os
import requests
import gtts
import pydub

TEST_WORDS = [
    # Monophthongs
    ("sheep", "iː"),
    ("ship", "ɪ"),
    ("bed", "e"),
    ("bad", "æ"),
    ("dark", "ɑː"),
    ("bird", "ɜː"),
    ("look", "ʊ"),
    ("food", "uː"),
    ("cup", "ʌ"),
    ("about", "ə"),
    # Diphthongs
    ("day", "eɪ"),
    ("time", "aɪ"),
    ("boy", "ɔɪ"),
    ("out", "aʊ"),
    ("go", "oʊ"),
    # Consonants
    ("think", "θ"),
    ("this", "ð"),
    ("she", "ʃ"),
    ("chair", "tʃ"),
    ("job", "dʒ"),
    ("sing", "ŋ"),
]

def run_benchmark():
    os.makedirs("test_audio_cache", exist_ok=True)
    results = []
    
    with open("benchmark_report.txt", "w", encoding="utf-8") as out_f:
        out_f.write("=================================================================\n")
        out_f.write(f"{'WORD':<10} | {'TARGET':<8} | {'WORD SCORE':<12} | {'PHONEME DETAILS'}\n")
        out_f.write("=================================================================\n")

        for word, target_ph in TEST_WORDS:
            wav_path = os.path.join("test_audio_cache", f"{word}.wav")
            if not os.path.exists(wav_path):
                tts = gtts.gTTS(word, lang='en', tld='com')
                mp3_path = os.path.join("test_audio_cache", f"{word}.mp3")
                tts.save(mp3_path)
                sound = pydub.AudioSegment.from_mp3(mp3_path)
                sound.export(wav_path, format="wav")
                
            with open(wav_path, "rb") as f:
                files = {"audio": (f"{word}.wav", f, "audio/wav")}
                data = {"script": word}
                res = requests.post("http://127.0.0.1:8000/api/v1/audio/evaluate-phonetics", files=files, data=data)
                
            if res.status_code == 200:
                payload = res.json()
                word_obj = payload.get("words", [{}])[0]
                w_score = word_obj.get("score", 0.0)
                ph_scores = [f"{p['symbol']}:{p['score']}" for p in word_obj.get("phonemes", [])]
                ph_str = ", ".join(ph_scores)
                line = f"{word:<10} | {target_ph:<8} | {w_score:<12.1f} | {ph_str}\n"
                out_f.write(line)
                results.append((word, target_ph, w_score, word_obj.get("phonemes", [])))
            else:
                out_f.write(f"{word:<10} | {target_ph:<8} | ERROR {res.status_code}\n")

        scores = [r[2] for r in results]
        avg_score = sum(scores) / len(scores) if scores else 0
        passed_count = sum(1 for s in scores if s >= 80)
        out_f.write("=================================================================\n")
        out_f.write(f"BENCHMARK COMPLETED: {passed_count}/{len(TEST_WORDS)} words passed >= 80. Avg Word Score: {avg_score:.1f}\n")
        out_f.write("=================================================================\n")
    print("Benchmark finished! Check benchmark_report.txt")

if __name__ == "__main__":
    run_benchmark()
