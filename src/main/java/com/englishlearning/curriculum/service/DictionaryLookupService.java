package com.englishlearning.curriculum.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class DictionaryLookupService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, DictionaryEntryDto> cache = new ConcurrentHashMap<>();

    public DictionaryLookupService() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(1500);
        factory.setReadTimeout(1500);
        this.restTemplate = new RestTemplate(factory);
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DictionaryEntryDto {
        private String word;
        private String ipa;
        private String audioUrl;
        private String partOfSpeech;
        private String meaning;
        private String exampleSentence;
    }

    /**
     * Tra cứu từ điển chuẩn qua Free Dictionary API với cơ chế Fallback sang Youdao Audio.
     * Tự động làm sạch từ vựng, lấy phiên âm IPA và audio phát âm bản xứ (ưu tiên giọng US).
     */
    public DictionaryEntryDto lookup(String rawWord) {
        if (rawWord == null || rawWord.isBlank()) {
            return null;
        }

        // Làm sạch từ vựng: bỏ dấu ngoặc, dấu chấm, phẩy, gạch chéo, markdown
        String cleanWord = rawWord.trim()
                .replaceAll("^[\"'“‘\\[\\(]+|[\"'”’\\]\\),.?!:;]+$", "")
                .trim()
                .toLowerCase();

        if (cleanWord.isBlank()) {
            return null;
        }

        // Kiểm tra bộ nhớ cache
        if (cache.containsKey(cleanWord)) {
            return cache.get(cleanWord);
        }

        DictionaryEntryDto entry = DictionaryEntryDto.builder()
                .word(cleanWord)
                .partOfSpeech("noun")
                .build();

        try {
            String encodedWord = URLEncoder.encode(cleanWord, StandardCharsets.UTF_8);
            String apiUrl = "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodedWord;
            String jsonStr = restTemplate.getForObject(apiUrl, String.class);

            if (jsonStr != null && !jsonStr.isBlank()) {
                JsonNode root = objectMapper.readTree(jsonStr);
                if (root.isArray() && !root.isEmpty()) {
                    JsonNode firstItem = root.get(0);

                    // 1. Trích xuất IPA
                    String ipa = firstItem.path("phonetic").asText(null);
                    JsonNode phonetics = firstItem.path("phonetics");
                    if (phonetics.isArray()) {
                        if (ipa == null || ipa.isBlank()) {
                            for (JsonNode p : phonetics) {
                                String text = p.path("text").asText(null);
                                if (text != null && !text.isBlank()) {
                                    ipa = text;
                                    break;
                                }
                            }
                        }

                        // 2. Trích xuất Audio MP3:
                        // Lưu ý: CDN media của api.dictionaryapi.dev thường xuyên gặp lỗi Cloudflare 522 Timeout.
                        // Do đó, chỉ chấp nhận file audio nếu từ nguồn bên ngoài ổn định khác (như wikimedia/oxford).
                        for (JsonNode p : phonetics) {
                            String audio = p.path("audio").asText(null);
                            if (audio != null && audio.endsWith(".mp3")
                                    && !audio.contains("api.dictionaryapi.dev")
                                    && (audio.contains("-us") || audio.contains("us."))) {
                                entry.setAudioUrl(audio);
                                break;
                            }
                        }
                    }
                    entry.setIpa(ipa);

                    // 3. Trích xuất Nghĩa, Từ loại & Ví dụ
                    JsonNode meanings = firstItem.path("meanings");
                    if (meanings.isArray() && !meanings.isEmpty()) {
                        JsonNode firstMeaning = meanings.get(0);
                        entry.setPartOfSpeech(firstMeaning.path("partOfSpeech").asText("noun"));

                        JsonNode defs = firstMeaning.path("definitions");
                        if (defs.isArray() && !defs.isEmpty()) {
                            entry.setMeaning(defs.get(0).path("definition").asText(""));
                            entry.setExampleSentence(defs.get(0).path("example").asText(""));
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Free Dictionary API lookup failed for word '{}': {}. Using fallback providers.", cleanWord, e.getMessage());
        }

        // Chuẩn hóa định dạng IPA /.../
        if (entry.getIpa() == null || entry.getIpa().isBlank()) {
            entry.setIpa("/" + cleanWord + "/");
        } else {
            String formattedIpa = entry.getIpa().replace("/", "").trim();
            entry.setIpa("/" + formattedIpa + "/");
        }

        // Fallback Audio giọng bản xứ chất lượng cao từ Youdao voice nếu chưa có audio
        if (entry.getAudioUrl() == null || entry.getAudioUrl().isBlank()) {
            entry.setAudioUrl("https://dict.youdao.com/dictvoice?audio="
                    + URLEncoder.encode(cleanWord, StandardCharsets.UTF_8)
                    + "&type=2");
        }

        if (entry.getMeaning() == null || entry.getMeaning().isBlank()) {
            entry.setMeaning("Nghĩa của từ: " + cleanWord);
        }

        if (entry.getExampleSentence() == null || entry.getExampleSentence().isBlank()) {
            entry.setExampleSentence("Practice using \"" + cleanWord + "\" in daily conversations.");
        }

        cache.put(cleanWord, entry);
        return entry;
    }
}

