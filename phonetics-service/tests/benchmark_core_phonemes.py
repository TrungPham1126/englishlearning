import os
import sys
import math
import wave
from pathlib import Path
import numpy as np
import gtts
import soundfile as sf
import scipy.signal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

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
                mp3_path = os.path.join("test_audio_cache", f"{word}.mp3")
                if not os.path.exists(mp3_path):
                    tts = gtts.gTTS(word, lang='en', tld='com')
                    tts.save(mp3_path)
                data, orig_sr = sf.read(mp3_path, dtype="float32")
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                if orig_sr != 16000:
                    g = math.gcd(orig_sr, 16000)
                    data = scipy.signal.resample_poly(data, 16000 // g, orig_sr // g).astype(np.float32)
                pcm = (np.clip(data, -1.0, 1.0) * 32767).astype(np.int16)
                with wave.open(wav_path, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(16000)
                    wf.writeframes(pcm.tobytes())
                
            with open(wav_path, "rb") as f:
                files = {"audio": (f"{word}.wav", f, "audio/wav")}
                data = {"script": word}
                res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
                
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
