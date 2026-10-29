package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;

public interface KokoroTtsClientService {

    TtsResponse synthesizeSpeech(TtsRequest request);
}
