import json
import numpy as np
import torch
from transformers import Wav2Vec2ForCTC
from huggingface_hub import hf_hub_download
import torchaudio
import gtts
import os
import soundfile as sf

model_name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
cache_dir = "cache/huggingface"

vocab_path = hf_hub_download(repo_id=model_name, filename="vocab.json", cache_dir=cache_dir)
with open(vocab_path, "r", encoding="utf-8") as f:
    vocab = json.load(f)
idx2vocab = {v: k for k, v in vocab.items()}

model = Wav2Vec2ForCTC.from_pretrained(model_name, cache_dir=cache_dir)
model.eval()

words_to_test = ["bus", "new", "motor", "water", "city"]

for w in words_to_test:
    audio_path = f"{w}.wav" # changed to .wav so torchaudio on windows can read it without torchcodec
    if not os.path.exists(audio_path):
        tts = gtts.gTTS(w, lang='en', tld='us')
        tts.save(f"{w}.mp3")
        # convert to wav
        import pydub
        sound = pydub.AudioSegment.from_mp3(f"{w}.mp3")
        sound.export(audio_path, format="wav")

    waveform, sr = torchaudio.load(audio_path)
    if sr != 16000:
        waveform = torchaudio.functional.resample(waveform, orig_freq=sr, new_freq=16000)
    audio = waveform[0].numpy()
    audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)

    input_values = torch.tensor(audio).unsqueeze(0).float()
    with torch.no_grad():
        logits = model(input_values).logits
        log_probs = torch.log_softmax(logits, dim=-1)

    predicted_ids = torch.argmax(log_probs, dim=-1)[0].tolist()
    predicted_symbols = []
    for idx in predicted_ids:
        if idx != 0 and (not predicted_symbols or predicted_symbols[-1] != idx):
            predicted_symbols.append(idx)
            
    print(f"Word: {w} ->", [idx2vocab[i] for i in predicted_symbols])

