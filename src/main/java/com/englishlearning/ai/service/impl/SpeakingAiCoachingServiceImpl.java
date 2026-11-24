package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.AiCoachingAdvice;
import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.GeminiClientService;
import com.englishlearning.ai.service.GroqClientService;
import com.englishlearning.ai.service.SpeakingAiCoachingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Triển khai dịch vụ AI Coach tổng hợp dữ liệu âm học từ Python/Whisper
 * để đưa ra nhận xét và bài tập luyện sửa lỗi cụ thể bằng tiếng Việt.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpeakingAiCoachingServiceImpl implements SpeakingAiCoachingService {

    private static final int MAX_ACTION_TIPS = 4;
    private static final int WEAK_WORD_THRESHOLD = 80;

    private static final String COACHING_SYSTEM_INSTRUCTION = """
            Bạn là Huấn luyện viên Phát âm & Giao tiếp tiếng Anh chuẩn Cambridge/IELTS.
            Nhiệm vụ: Đọc KẾT QUẢ PHÂN TÍCH ÂM HỌC thực tế từ hệ thống chấm điểm Python (Wav2Vec2 + Formant F1/F2 / Whisper) để đưa ra lời khuyên sửa lỗi CÁ NHÂN HÓA bằng tiếng Việt cho học viên.

            QUY TẮC BẮT BUỘC:
            1. Trung thực tuyệt đối với dữ liệu Python cung cấp: chỉ trích đúng các từ điểm thấp, âm vị IPA yếu, lỗi nuốt âm đuôi/khẩu hình, từ bỏ sót hoặc tốc độ WPM có trong dữ liệu; tuyệt đối KHÔNG tự bịa lỗi không tồn tại trong số liệu.
            2. Nhất quán với điểm số: nếu Overall >= 85, hãy khen điểm mạnh trước rồi gợi ý tinh chỉnh nhẹ (ngữ điệu, nối âm, nhấn trọng âm); nếu điểm thấp, tập trung thẳng vào 2–3 lỗi nặng nhất giúp tăng điểm nhanh nhất.
            3. Ngắn gọn, trực diện, có tính thực hành cao:
               - "summary": 1–2 câu tổng quan bằng tiếng Việt tự nhiên, khích lệ nhưng chính xác.
               - "actionTips": 2–4 gạch đầu dòng cụ thể (nêu rõ tên từ, ký hiệu IPA nếu có, cách đặt lưỡi/môi hoặc điều chỉnh nhịp nói).
               - "practiceDrill": 1 bài tập luyện nhanh trong 30 giây áp dụng ngay cho câu/từ vừa nói.
            4. Trả về STRICTLY VALID JSON (không bọc markdown ```json):
            {
              "summary": "...",
              "actionTips": ["...", "..."],
              "practiceDrill": "..."
            }
            """;

    private final GroqClientService groqClientService;
    private final GeminiClientService geminiClientService;
    private final ObjectMapper objectMapper;

    @Value("${app.ai.speaking-coaching.enabled:true}")
    private boolean coachingEnabled = true;

    @Override
    public AiCoachingAdvice generateShadowingCoaching(
            ShadowingEvaluationResponse acousticResult,
            String referenceSentence,
            String speakingMode) {
        if (!coachingEnabled || acousticResult == null || acousticResult.getOverallScore() == null) {
            return null;
        }
        String modeLabel = (speakingMode != null && !speakingMode.isBlank()) ? speakingMode.trim() : "SHADOWING";
        String safeRef = (referenceSentence != null && !referenceSentence.isBlank())
                ? referenceSentence.trim()
                : "(Không có câu mẫu)";

        String acousticSummary = buildDetailedAcousticSummary(acousticResult);
        String userPrompt = String.format("""
                - Dạng bài luyện nói: %s
                - Câu mẫu / Nội dung học viên nói: "%s"
                - Trạng thái hệ thống: %s
                %s

                Hãy phân tích các số liệu âm học trên và trả về JSON lời khuyên sư phạm bằng tiếng Việt.
                """,
                modeLabel,
                safeRef,
                acousticResult.getStatusMessage() != null ? acousticResult.getStatusMessage() : "",
                acousticSummary);

        return invokeCoachLlm(userPrompt);
    }

    @Override
    public AiCoachingAdvice generatePronunciationCoaching(
            PhoneticEvaluationResponse phoneticResult,
            String referenceText) {
        if (!coachingEnabled || phoneticResult == null || phoneticResult.getOverallScore() == null) {
            return null;
        }
        List<PhoneticEvaluationResponse.WordScore> wordScores = phoneticResult.getWordScores();
        String weakWords = "Không có";
        String missedWords = "Không có";
        if (wordScores != null && !wordScores.isEmpty()) {
            String weak = wordScores.stream()
                    .filter(w -> w.getWord() != null && w.getScore() != null && w.getScore() > 0 && w.getScore() < WEAK_WORD_THRESHOLD)
                    .limit(6)
                    .map(w -> w.getWord() + " (" + w.getScore() + "% - " + (w.getNote() != null ? w.getNote() : "") + ")")
                    .collect(Collectors.joining("; "));
            if (!weak.isBlank()) {
                weakWords = weak;
            }
            String missed = wordScores.stream()
                    .filter(w -> w.getWord() != null && (w.getScore() == null || w.getScore() == 0))
                    .limit(8)
                    .map(PhoneticEvaluationResponse.WordScore::getWord)
                    .collect(Collectors.joining(", "));
            if (!missed.isBlank()) {
                missedWords = missed;
            }
        }

        String userPrompt = String.format("""
                - Dạng bài luyện nói: PRONUNCIATION_WHISPER
                - Câu mẫu: "%s"
                - Tổng điểm: %d/100 (%s)
                - Các từ phát âm chưa chuẩn: %s
                - Các từ bị đọc thiếu/nuốt từ: %s

                Hãy đưa ra nhận xét, gợi ý sửa cụ thể và bài tập luyện nhanh bằng tiếng Việt theo đúng JSON yêu cầu.
                """,
                referenceText != null ? referenceText.trim() : "",
                phoneticResult.getOverallScore(),
                phoneticResult.getFeedback() != null ? phoneticResult.getFeedback() : "",
                weakWords,
                missedWords);

        return invokeCoachLlm(userPrompt);
    }

    @Override
    public String buildDetailedAcousticSummary(ShadowingEvaluationResponse phoneticResult) {
        if (phoneticResult == null) {
            return "Không có dữ liệu âm học Python.";
        }
        ShadowingEvaluationResponse.KpiMetrics kpi = phoneticResult.getKpi();
        int overall = phoneticResult.getOverallScore() != null ? phoneticResult.getOverallScore() : 0;
        int pron = (kpi != null && kpi.getPronunciation() != null) ? kpi.getPronunciation() : 0;
        int flu = (kpi != null && kpi.getFluency() != null) ? kpi.getFluency() : 0;
        int comp = (kpi != null && kpi.getCompleteness() != null) ? kpi.getCompleteness() : 0;
        int prosody = (kpi != null && kpi.getProsody() != null) ? kpi.getProsody() : 0;
        int wpm = (kpi != null && kpi.getWordsPerMinute() != null) ? kpi.getWordsPerMinute() : 0;

        List<String> missingWords = collectMissingOrPartialWords(phoneticResult);
        String weakWordsDetail = collectWeakWordsWithPhonemes(phoneticResult);
        long pauseCount = phoneticResult.getSentenceTokens() == null ? 0
                : phoneticResult.getSentenceTokens().stream()
                        .filter(t -> Boolean.TRUE.equals(t.getHasPauseAfter()))
                        .count();
        long linkingCount = phoneticResult.getSentenceTokens() == null ? 0
                : phoneticResult.getSentenceTokens().stream()
                        .filter(t -> Boolean.TRUE.equals(t.getHasLinkingAfter()))
                        .count();

        return String.format("""
                - Overall Acoustic Score: %d/100 (%s) | Pronunciation: %d/100 | Fluency: %d/100 | Completeness: %d%% | Prosody: %d/100 | Speed: %d WPM
                - Nhịp điệu câu: %d điểm ngắt nghỉ, %d vị trí nối âm
                - Từ bỏ sót / đọc thiếu: %s
                - Chi tiết từ & âm vị IPA cần cải thiện (<%d%%): %s""",
                overall,
                Boolean.TRUE.equals(phoneticResult.getIsPassed()) ? "Đạt chuẩn" : "Chưa đạt chuẩn",
                pron, flu, comp, prosody, wpm,
                pauseCount, linkingCount,
                missingWords.isEmpty() ? "Không có" : String.join(", ", missingWords),
                WEAK_WORD_THRESHOLD,
                weakWordsDetail);
    }

    private List<String> collectMissingOrPartialWords(ShadowingEvaluationResponse phoneticResult) {
        List<String> out = new ArrayList<>();
        if (phoneticResult.getWordRows() != null) {
            for (ShadowingEvaluationResponse.WordPhonemeDetail w : phoneticResult.getWordRows()) {
                if (w.getWord() == null) {
                    continue;
                }
                boolean isMissing = "MISSING".equalsIgnoreCase(w.getWordStatus())
                        || (w.getScore() != null && w.getScore() == 0);
                boolean isPartial = "PARTIAL".equalsIgnoreCase(w.getWordStatus());
                if (isMissing) {
                    out.add(w.getWord() + " [BỎ SÓT]");
                } else if (isPartial) {
                    out.add(w.getWord() + " [CHƯA TRỌN VẸN]");
                }
                if (out.size() >= 10) {
                    break;
                }
            }
        }
        return out;
    }

    private String collectWeakWordsWithPhonemes(ShadowingEvaluationResponse phoneticResult) {
        if (phoneticResult.getWordRows() == null || phoneticResult.getWordRows().isEmpty()) {
            return "Không phát hiện lỗi âm vị đáng kể.";
        }
        List<String> formatted = phoneticResult.getWordRows().stream()
                .filter(w -> w.getWord() != null
                        && !"MISSING".equalsIgnoreCase(w.getWordStatus())
                        && w.getScore() != null
                        && w.getScore() > 0
                        && w.getScore() < WEAK_WORD_THRESHOLD)
                .sorted(Comparator.comparingInt(ShadowingEvaluationResponse.WordPhonemeDetail::getScore))
                .limit(6)
                .map(this::formatWordPhonemeDetail)
                .toList();
        return formatted.isEmpty() ? "Tất cả các từ đều đạt >= 80%." : String.join("; ", formatted);
    }

    private String formatWordPhonemeDetail(ShadowingEvaluationResponse.WordPhonemeDetail wordDetail) {
        StringBuilder sb = new StringBuilder();
        sb.append(wordDetail.getWord()).append(" (").append(wordDetail.getScore()).append("%)");
        if (wordDetail.getPhonemes() != null && !wordDetail.getPhonemes().isEmpty()) {
            String phDetails = wordDetail.getPhonemes().stream()
                    .filter(p -> p.getScore() != null && p.getScore() < WEAK_WORD_THRESHOLD)
                    .sorted(Comparator.comparingInt(ShadowingEvaluationResponse.PhonemeItem::getScore))
                    .limit(3)
                    .map(p -> {
                        String ipa = p.getIpa() != null ? p.getIpa() : "?";
                        String note = (p.getNote() != null && !p.getNote().isBlank()) ? " - " + p.getNote() : "";
                        return ipa + " " + p.getScore() + "%" + note;
                    })
                    .collect(Collectors.joining(", "));
            if (!phDetails.isBlank()) {
                sb.append(": [").append(phDetails).append("]");
            }
        }
        return sb.toString();
    }

    private AiCoachingAdvice invokeCoachLlm(String userPrompt) {
        try {
            String groqRaw = groqClientService.chatCompletionJson(COACHING_SYSTEM_INSTRUCTION, userPrompt, 0.3);
            AiCoachingAdvice parsed = parseCoachingResponse(GroqClientService.stripMarkdown(groqRaw), "GROQ_AI_COACH");
            if (parsed != null) {
                return parsed;
            }
        } catch (Exception groqEx) {
            log.warn("Groq AI Coach gặp sự cố ({}), chuyển sang Gemini AI Coach...", groqEx.getMessage());
        }

        try {
            String geminiRaw = geminiClientService.generateWithSystemInstruction(COACHING_SYSTEM_INSTRUCTION, userPrompt, 0.3);
            return parseCoachingResponse(GeminiClientService.stripMarkdown(geminiRaw), "GEMINI_AI_COACH");
        } catch (Exception geminiEx) {
            log.warn("Gemini AI Coach cũng không khả dụng, bỏ qua lời khuyên AI nâng cao: {}", geminiEx.getMessage());
            return null;
        }
    }

    private AiCoachingAdvice parseCoachingResponse(String cleanJson, String engineTag) {
        if (cleanJson == null || cleanJson.isBlank() || "{}".equals(cleanJson.trim())) {
            return null;
        }
        try {
            AiCoachingAdvice advice = objectMapper.readValue(cleanJson, AiCoachingAdvice.class);
            if (advice == null) {
                return null;
            }
            List<String> cleanedTips = advice.getActionTips() == null ? new ArrayList<>()
                    : advice.getActionTips().stream()
                            .filter(tip -> tip != null && !tip.isBlank())
                            .map(String::trim)
                            .limit(MAX_ACTION_TIPS)
                            .collect(Collectors.toList());
            advice.setActionTips(cleanedTips);
            advice.setSummary(advice.getSummary() != null ? advice.getSummary().trim() : "");
            if (advice.getPracticeDrill() != null) {
                advice.setPracticeDrill(advice.getPracticeDrill().trim());
            }
            if (advice.getSummary().isBlank() && cleanedTips.isEmpty()) {
                return null;
            }
            advice.setGeneratedBy(engineTag);
            return advice;
        } catch (Exception parseEx) {
            log.warn("Không thể parse JSON lời khuyên từ {}: {}", engineTag, parseEx.getMessage());
            return null;
        }
    }
}
