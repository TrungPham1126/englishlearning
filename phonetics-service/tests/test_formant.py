import numpy as np
from app.services.formant_service import formant_service


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
