import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'd:\codes\doanchuyennganh\false2trung.mp3', 'rb') as f:
    res = requests.post(
        'http://localhost:8000/api/v1/audio/evaluate-phonetics',
        files={'audio': f},
        data={'script': 'hello my name is Trung'}
    )

d = res.json()
print("Overall:", d.get('overallScore'))
print("Pronunciation:", d.get('pronunciationScore'))
print("Fluency:", d.get('fluencyScore'))
print("Speed:", d.get('speedScore'))
print("KPI:", d.get('kpi'))
for i, w in enumerate(d['words']):
    print(f"Word {i}: {w['word']} ({w.get('startTime')} -> {w.get('endTime')}) - Score: {w['score']}")
    for p in w['phonemes']:
        print(f"   {p['symbol']}: score={p['score']}, conf={p['confidence']}")
    if i < len(d['words']) - 1:
        next_w = d['words'][i+1]
        if next_w.get('startTime') and w.get('endTime'):
            gap = next_w['startTime'] - w['endTime']
            print(f"   --> Gap to next word: {gap:.3f}s")
