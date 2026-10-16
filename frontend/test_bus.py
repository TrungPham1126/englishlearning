import sys
import json
import librosa
import numpy as np
import torch
from transformers import Wav2Vec2ForCTC
from huggingface_hub import hf_hub_download

model_name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
vocab_path = hf_hub_download(repo_id=model_name, filename="vocab.json")
with open(vocab_path, "r", encoding="utf-8") as f:
    vocab = json.load(f)
idx2vocab = {v: k for k, v in vocab.items()}

model = Wav2Vec2ForCTC.from_pretrained(model_name)
model.eval()

# Download a sample of someone saying 'bus' or we just generate a TTS of bus
import pyttsx3
engine = pyttsx3.init()
engine.save_to_file("bus", "bus.wav")
engine.runAndWait()

audio, sr = librosa.load("bus.wav", sr=16000)
# Wav2Vec2 requires zero-mean unit-variance
audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)

input_values = torch.tensor(audio).unsqueeze(0).float()
with torch.no_grad():
    logits = model(input_values).logits
    probs = torch.softmax(logits, dim=-1)[0] # (T, V)

# print the top 3 tokens for each frame
for i in range(probs.shape[0]):
    top3 = torch.topk(probs[i], 3)
    vals = top3.values.numpy()
    inds = top3.indices.numpy()
    tokens = [idx2vocab.get(idx, str(idx)) for idx in inds]
    if vals[0] > 0.1 and tokens[0] not in ['<pad>', '<s>', '</s>']:
        print(f"Frame {i}:", [f"{tok}: {v:.3f}" for tok, v in zip(tokens, vals)])
