import json
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.services.formant_service import FormantService, formant_service


def test_formant_profile_loaded():
    assert len(formant_service.reference_profiles) >= 5
    assert "iː" in formant_service.reference_profiles
    assert "æ" in formant_service.reference_profiles


def test_mahalanobis_scoring():
    ref = formant_service.reference_profiles["iː"]
    # Perfect match at mean: F1=300, F2=2300
    score_perfect, feedback_perfect = formant_service._score_mahalanobis(
        300.0, 2300.0, 300.0, 2300.0, ref
    )
    assert score_perfect >= 95.0
    assert "chuẩn xác" in feedback_perfect.lower()

    # Deviant match: F1=500 (too open/hạ cằm), F2=1500 (tongue too back)
    score_dev, feedback_dev = formant_service._score_mahalanobis(
        500.0, 1500.0, 300.0, 2300.0, ref
    )
    assert score_dev < 60.0
    assert "hạ hàm" in feedback_dev.lower() or "đưa lưỡi" in feedback_dev.lower()


def test_normalize_loaded_entry_and_load_profiles_from_disk(tmp_path):
    assert FormantService._normalize_loaded_entry("iː", "not_a_dict") is None
    assert FormantService._normalize_loaded_entry("iː", {"std": [50, 100]}) is None

    # Singular covariance (det <= 1e-3) gets regularized cleanly to positive diagonal
    parsed = FormantService._normalize_loaded_entry(
        "iː",
        {"mean": [300.0, 2300.0], "std": [10.0, 20.0], "covariance": [[0.0, 0.0], [0.0, 0.0]]},
    )
    assert parsed is not None
    assert parsed["std"] == [20.0, 50.0]
    assert parsed["cov"][0][0] >= 400.0 and parsed["cov"][1][1] >= 2500.0

    # Missing file & corrupt JSON fall back gracefully to built-ins
    svc_missing = FormantService(profiles_path=tmp_path / "does_not_exist.json")
    assert len(svc_missing.reference_profiles) >= 5

    bad_json = tmp_path / "corrupt.json"
    bad_json.write_text("{not valid json", encoding="utf-8")
    svc_bad = FormantService(profiles_path=bad_json)
    assert len(svc_bad.reference_profiles) >= 5

    # Valid custom JSON populates loaded_gender_profiles
    good_json = tmp_path / "custom_vowels.json"
    good_json.write_text(
        json.dumps({"en-US-male": {"iː": {"mean": [290.0, 2240.0], "std": [50.0, 180.0]}}}),
        encoding="utf-8",
    )
    svc_good = FormantService(profiles_path=good_json)
    assert "iː" in svc_good.loaded_gender_profiles["MALE"]


def test_detect_gender_and_extract_utterance_acoustics_paths():
    sr = 16000
    t = np.linspace(0, 0.5, int(0.5 * sr), endpoint=False)
    male_wave = (0.4 * np.sin(2 * np.pi * 115.0 * t)).astype(np.float32)
    female_wave = (0.4 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)

    g_m, f0_m = formant_service.detect_gender(male_wave, sr)
    g_f, f0_f = formant_service.detect_gender(female_wave, sr)
    assert g_m == "MALE" and f0_m < 165.0
    assert g_f == "FEMALE" and f0_f >= 165.0

    # Empty/too-short fallback
    assert formant_service.detect_gender(np.array([], dtype=np.float32), sr) == ("FEMALE", 200.0)
    short_acoustics = formant_service.extract_utterance_acoustics(np.zeros(100, dtype=np.float32), sr)
    assert short_acoustics.formants is None

    utt_f = formant_service.extract_utterance_acoustics(female_wave, sr)
    assert utt_f.gender == "FEMALE" and utt_f.formants is not None
    assert formant_service.extract_f0_variation(np.zeros(200, dtype=np.float32), sr) == 25.0


def test_get_target_profile_fronted_u_ambiguous_f0_and_unknown_vowel():
    # Fronted /uː/ after palatal/in 'you' chooses centroid[1]
    back_u = formant_service._get_target_profile("uː", "FEMALE", is_fronted_u=False)
    front_u = formant_service._get_target_profile("uː", "FEMALE", is_fronted_u=True)
    assert back_u is not None and front_u is not None
    assert front_u["mean"][1] > back_u["mean"][1]

    # Ambiguous F0 in [145, 185] includes both MALE and FEMALE centroids
    formant_service._last_mean_f0 = 160.0
    merged = formant_service._get_target_centroids("ɪ", "FEMALE")
    formant_service._last_mean_f0 = 200.0
    single_gender = formant_service._get_target_centroids("ɪ", "FEMALE")
    assert len(merged) > len(single_gender)

    # Unknown symbol falls back to generic profile
    unknown = formant_service._get_target_profile("ɶ_unknown", "MALE")
    assert unknown is not None and unknown["mean"] == [550.0, 1400.0]


def test_score_mahalanobis_singular_cov_and_all_feedback_directions():
    ref_singular = {"mean": [500.0, 1500.0], "std": [50.0, 150.0], "cov": [[0.0, 0.0], [0.0, 0.0]]}
    sc_high_f1, fb_high_f1 = formant_service._score_mahalanobis(750.0, 1500.0, 500.0, 1500.0, ref_singular)
    assert sc_high_f1 < 75.0 and "hạ hàm" in fb_high_f1.lower()

    _, fb_low_f1 = formant_service._score_mahalanobis(300.0, 1500.0, 500.0, 1500.0, ref_singular)
    assert "mở rộng khẩu hình" in fb_low_f1.lower()

    _, fb_high_f2 = formant_service._score_mahalanobis(500.0, 2200.0, 500.0, 1500.0, ref_singular)
    assert "kéo lưỡi về phía sau" in fb_high_f2.lower()

    _, fb_low_f2 = formant_service._score_mahalanobis(500.0, 800.0, 500.0, 1500.0, ref_singular)
    assert "đưa lưỡi về phía trước" in fb_low_f2.lower()

    # Zero-contradiction rule: score >= 75 must emit positive feedback
    sc_good, fb_good = formant_service._score_mahalanobis(500.0, 1500.0, 500.0, 1500.0, ref_singular)
    assert sc_good >= 95.0 and "chuẩn xác" in fb_good.lower()


def test_analyze_vowel_short_gate_and_real_ship_vs_sheep():
    sr = 16000
    dummy = np.zeros(sr, dtype=np.float32)

    # Too short (< 25ms for non-function word) -> FORMANT_NOT_RELIABLE
    _, _, _, _, sc_short, _, st_short = formant_service.analyze_vowel(dummy, 0.1, 0.115, "iː", gender="FEMALE", word="sheep")
    assert sc_short == 75.0 and st_short == "FORMANT_NOT_RELIABLE"

    # Real fixtures ship.wav vs sheep.wav: align first to get exact vowel windows
    from app.services.aligner import forced_aligner

    cache_dir = Path(__file__).resolve().parents[1] / "test_audio_cache"
    sheep_audio, _ = sf.read(str(cache_dir / "sheep.wav"), dtype="float32")
    ship_audio, _ = sf.read(str(cache_dir / "ship.wav"), dtype="float32")

    al_sheep = forced_aligner._align_sync(sheep_audio, "sheep")
    ph_iy = [p for p in al_sheep.words[0].phonemes if p.symbol == "iː"][0]
    al_ship = forced_aligner._align_sync(ship_audio, "ship")
    ph_ih = [p for p in al_ship.words[0].phonemes if p.symbol == "ɪ"][0]

    f1_sheep, f2_sheep, _, _, sc_sheep, _, st_sheep = formant_service.analyze_vowel(
        sheep_audio, ph_iy.start, ph_iy.end, "iː", word="sheep"
    )
    f1_ship, f2_ship, _, _, _, _, st_ship = formant_service.analyze_vowel(
        ship_audio, ph_ih.start, ph_ih.end, "ɪ", word="ship"
    )
    assert st_sheep == "OK" and f1_sheep is not None and f2_sheep is not None
    assert st_ship == "OK" and f1_ship is not None and f2_ship is not None
    assert sc_sheep >= 75.0
    assert f2_sheep > f2_ship  # /iː/ is more front than lax /ɪ/


def test_male_vs_female_mahalanobis_centroids_and_zero_contradiction_rule():
    # 1. So sánh tâm formant Nam vs Nữ cho cùng nguyên âm /iː/ (FLEECE): Nữ có F1, F2 mục tiêu cao hơn Nam
    male_centroids = formant_service._get_target_centroids("iː", "MALE")
    female_centroids = formant_service._get_target_centroids("iː", "FEMALE")
    assert male_centroids[0]["mean"][0] < female_centroids[0]["mean"][0]
    assert male_centroids[0]["mean"][1] < female_centroids[0]["mean"][1]

    # Mẫu F1=330, F2=2900 nằm sát tâm Nữ (330, 2750) nhưng vượt ngoài ngưỡng dung sai tâm Nam (280, 2250)
    sc_female, fb_female = formant_service._score_mahalanobis(
        330.0, 2900.0, female_centroids[0]["mean"][0], female_centroids[0]["mean"][1], female_centroids[0]
    )
    sc_male, fb_male = formant_service._score_mahalanobis(
        330.0, 2900.0, male_centroids[0]["mean"][0], male_centroids[0]["mean"][1], male_centroids[0]
    )
    assert sc_female > sc_male + 15.0
    assert sc_female >= 95.0 and "chuẩn xác" in fb_female.lower()

    # 2. Zero-contradiction feedback: khi điểm < 75 nhưng cả |z1| và |z2| chưa vượt ngưỡng z_threshold riêng lẻ (lệch chéo)
    ref_diag = {"mean": [500.0, 1500.0], "std": [100.0, 200.0], "cov": [[2500.0, 0.0], [0.0, 10000.0]]}
    sc_diag, fb_diag = formant_service._score_mahalanobis(
        670.0, 1840.0, 500.0, 1500.0, ref_diag, is_flexible_vowel=True
    )
    assert sc_diag < 75.0
    assert "cần chú ý điều chỉnh khẩu hình" in fb_diag.lower()

