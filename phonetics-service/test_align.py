import json
import numpy as np
import torch
import torchaudio
from transformers import Wav2Vec2ForCTC
from huggingface_hub import hf_hub_download

model_name = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
cache_dir = "cache/huggingface"

vocab_path = hf_hub_download(repo_id=model_name, filename="vocab.json", cache_dir=cache_dir)
with open(vocab_path, "r", encoding="utf-8") as f:
    vocab = json.load(f)

model = Wav2Vec2ForCTC.from_pretrained(model_name, cache_dir=cache_dir)
model.eval()

waveform, sr = torchaudio.load('bus_gtts.mp3')
if sr != 16000:
    resampler = torchaudio.transforms.Resample(sr, 16000)
    waveform = resampler(waveform)

audio = waveform[0].numpy()
audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)

input_values = torch.tensor(audio).unsqueeze(0).float()
with torch.no_grad():
    logits = model(input_values).logits
    log_probs = torch.log_softmax(logits, dim=-1) # (1, T, V)

with open('align_results.txt', 'w', encoding='utf-8') as out:
    def test_align(target_symbols):
        target_ids = [vocab[s] for s in target_symbols]
        targets_tensor = torch.tensor([target_ids], dtype=torch.int32)
        aligned_tokens, scores = torchaudio.functional.forced_align(log_probs, targets_tensor, blank=0)
        aligned_path = aligned_tokens[0].numpy()
        scores_path = scores[0].numpy()
        
        out.write(f"Targets: {target_symbols}\n")
        non_blank_scores = [np.exp(s) for s, t in zip(scores_path, aligned_path) if t != 0]
        out.write(f"Posteriors: {non_blank_scores}\n")

    test_align(['b', '\u028c', 's'])
    test_align(['b', '\u0259', 's'])
    test_align(['b', 'a', 's'])
