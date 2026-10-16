import json
import numpy as np
import torch
import torchaudio
from gtts import gTTS
from transformers import Wav2Vec2ForCTC
from huggingface_hub import hf_hub_download

model_name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
cache_dir = "cache/huggingface"

vocab_path = hf_hub_download(repo_id=model_name, filename="vocab.json", cache_dir=cache_dir)
with open(vocab_path, "r", encoding="utf-8") as f:
    vocab = json.load(f)
idx2vocab = {v: k for k, v in vocab.items()}

model = Wav2Vec2ForCTC.from_pretrained(model_name, cache_dir=cache_dir)
model.eval()

tts = gTTS('bus', lang='en', tld='com')
tts.save('bus_gtts.mp3')

waveform, sr = torchaudio.load('bus_gtts.mp3')
if sr != 16000:
    resampler = torchaudio.transforms.Resample(sr, 16000)
    waveform = resampler(waveform)

audio = waveform[0].numpy()
audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)

input_values = torch.tensor(audio).unsqueeze(0).float()
with torch.no_grad():
    logits = model(input_values).logits
    probs = torch.softmax(logits, dim=-1)[0] # (T, V)

with open('output_bus.txt', 'w', encoding='utf-8') as out:
    for i in range(probs.shape[0]):
        top3 = torch.topk(probs[i], 3)
        vals = top3.values.numpy()
        inds = top3.indices.numpy()
        tokens = [idx2vocab.get(idx, str(idx)) for idx in inds]
        if vals[0] > 0.05 and tokens[0] not in ['<pad>', '<s>', '</s>']:
            out.write(f"Frame {i}: {[f'{tok}: {v:.3f}' for tok, v in zip(tokens, vals)]}\n")
