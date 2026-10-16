import json
import numpy as np
import torch
import torch
from transformers import Wav2Vec2ForCTC
from huggingface_hub import hf_hub_download

model_name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
cache_dir = "cache/huggingface"

vocab_path = hf_hub_download(repo_id=model_name, filename="vocab.json", cache_dir=cache_dir)
with open(vocab_path, "r", encoding="utf-8") as f:
    vocab = json.load(f)

model = Wav2Vec2ForCTC.from_pretrained(model_name, cache_dir=cache_dir)
model.eval()

import torchaudio

waveform, sr = torchaudio.load('bus_gtts.mp3')
if sr != 16000:
    waveform = torchaudio.functional.resample(waveform, orig_freq=sr, new_freq=16000)
waveform_np = waveform[0].numpy()

audio = waveform_np
audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)

input_values = torch.tensor(audio).unsqueeze(0).float()
with torch.no_grad():
    logits = model(input_values).logits
    log_probs = torch.log_softmax(logits, dim=-1) # (1, T, V)

predicted_ids = torch.argmax(log_probs, dim=-1)[0].tolist()
predicted_symbols = []
for idx in predicted_ids:
    if idx != 0 and (not predicted_symbols or predicted_symbols[-1] != idx):
        predicted_symbols.append(idx)
        
idx2vocab = {v: k for k, v in vocab.items()}
print("Model Output:", [idx2vocab[i] for i in predicted_symbols])
