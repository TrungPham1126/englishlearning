package com.englishlearning.curriculum.service;

import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.VocabularyItem;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VocabularyService {

    private final VocabularyItemRepository vocabularyRepository;
    private final LessonRepository lessonRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public VocabularyResponse addVocabulary(UUID lessonId, VocabularyRequest request) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        String cleanWord = request.getWord() != null ? request.getWord().trim() : "";
        CrawledVocabInfo info = crawlVocabInfo(cleanWord);

        // Ưu tiên dữ liệu giáo viên nhập, nếu bỏ trống thì dùng dữ liệu tự động cào
        String ipa = (request.getIpa() != null && !request.getIpa().isBlank())
                ? request.getIpa().trim()
                : info.ipa;

        String meaning = (request.getMeaning() != null && !request.getMeaning().isBlank())
                ? request.getMeaning().trim()
                : info.meaning;

        String partOfSpeech = (request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank())
                ? request.getPartOfSpeech().trim()
                : info.partOfSpeech;

        String exampleSentence = (request.getExampleSentence() != null && !request.getExampleSentence().isBlank())
                ? request.getExampleSentence().trim()
                : info.exampleSentence;

        VocabularyItem vocabulary = VocabularyItem.builder()
                .lesson(lesson)
                .word(cleanWord)
                .meaning(meaning)
                .ipa(ipa)
                .audioUrl(info.audioUrl)
                .exampleSentence(exampleSentence)
                .partOfSpeech(partOfSpeech)
                .build();

        return mapToResponse(vocabularyRepository.save(vocabulary));
    }

    public List<VocabularyResponse> getVocabulariesByLesson(UUID lessonId) {
        return vocabularyRepository.findByLessonId(lessonId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public VocabularyResponse updateVocabulary(UUID id, VocabularyRequest request) {
        VocabularyItem item = vocabularyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy từ vựng"));

        String cleanWord = request.getWord() != null ? request.getWord().trim() : item.getWord();
        item.setWord(cleanWord);

        // Nếu IPA hoặc Audio đang trống, tự động bổ sung
        if (request.getIpa() != null && !request.getIpa().isBlank()) {
            item.setIpa(request.getIpa().trim());
        } else if (item.getIpa() == null || item.getIpa().isBlank()) {
            CrawledVocabInfo info = crawlVocabInfo(cleanWord);
            item.setIpa(info.ipa);
            if (item.getAudioUrl() == null || item.getAudioUrl().isBlank()) {
                item.setAudioUrl(info.audioUrl);
            }
        }

        if (request.getMeaning() != null && !request.getMeaning().isBlank()) {
            item.setMeaning(request.getMeaning().trim());
        }
        if (request.getExampleSentence() != null && !request.getExampleSentence().isBlank()) {
            item.setExampleSentence(request.getExampleSentence().trim());
        }
        if (request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank()) {
            item.setPartOfSpeech(request.getPartOfSpeech().trim());
        }

        return mapToResponse(vocabularyRepository.save(item));
    }

    @Transactional
    public void deleteVocabulary(UUID id) {
        VocabularyItem item = vocabularyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy từ vựng"));
        vocabularyRepository.delete(item);
    }

    /**
     * Tự động truy vấn Free Dictionary API để lấy IPA và File Audio MP3 bản xứ
     */
    private CrawledVocabInfo crawlVocabInfo(String word) {
        CrawledVocabInfo info = new CrawledVocabInfo();
        if (word == null || word.isBlank()) {
            return info;
        }

        try {
            String encodedWord = URLEncoder.encode(word.toLowerCase(), StandardCharsets.UTF_8);
            String apiUrl = "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodedWord;
            String jsonStr = restTemplate.getForObject(apiUrl, String.class);

            if (jsonStr != null && !jsonStr.isBlank()) {
                JsonNode root = objectMapper.readTree(jsonStr);
                if (root.isArray() && !root.isEmpty()) {
                    JsonNode entry = root.get(0);

                    // 1. Lấy phiên âm IPA
                    String ipa = entry.path("phonetic").asText(null);
                    if (ipa == null || ipa.isBlank()) {
                        JsonNode phonetics = entry.path("phonetics");
                        if (phonetics.isArray()) {
                            for (JsonNode p : phonetics) {
                                String text = p.path("text").asText(null);
                                if (text != null && !text.isBlank()) {
                                    ipa = text;
                                    break;
                                }
                            }
                        }
                    }
                    info.ipa = ipa;

                    // 2. Lấy link file Audio phát âm MP3 (ưu tiên bản US)
                    JsonNode phonetics = entry.path("phonetics");
                    if (phonetics.isArray()) {
                        for (JsonNode p : phonetics) {
                            String audio = p.path("audio").asText(null);
                            if (audio != null && audio.endsWith(".mp3")
                                    && (audio.contains("-us") || audio.contains("us."))) {
                                info.audioUrl = audio;
                                break;
                            }
                        }
                        if (info.audioUrl == null) {
                            for (JsonNode p : phonetics) {
                                String audio = p.path("audio").asText(null);
                                if (audio != null && audio.endsWith(".mp3")) {
                                    info.audioUrl = audio;
                                    break;
                                }
                            }
                        }
                    }

                    // 3. Lấy Từ loại, Định nghĩa và Câu ví dụ
                    JsonNode meanings = entry.path("meanings");
                    if (meanings.isArray() && !meanings.isEmpty()) {
                        JsonNode firstMeaning = meanings.get(0);
                        info.partOfSpeech = firstMeaning.path("partOfSpeech").asText(info.partOfSpeech);

                        JsonNode defs = firstMeaning.path("definitions");
                        if (defs.isArray() && !defs.isEmpty()) {
                            info.meaning = defs.get(0).path("definition").asText(info.meaning);
                            info.exampleSentence = defs.get(0).path("example").asText(info.exampleSentence);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Không tìm thấy từ '{}' trên Free Dictionary API ({}) -> chuyển sang nguồn fallback.", word,
                    e.getMessage());
        }

        // Chuẩn hóa IPA theo dạng /.../
        if (info.ipa == null || info.ipa.isBlank()) {
            info.ipa = "/" + word + "/";
        } else {
            String clean = info.ipa.replace("/", "").trim();
            info.ipa = "/" + clean + "/";
        }

        // Fallback Audio giọng US chuẩn
        if (info.audioUrl == null || info.audioUrl.isBlank()) {
            info.audioUrl = "https://dict.youdao.com/dictvoice?audio=" + URLEncoder.encode(word, StandardCharsets.UTF_8)
                    + "&type=2";
        }

        if (info.meaning == null || info.meaning.isBlank()) {
            info.meaning = "Nghĩa của từ: " + word;
        }

        if (info.exampleSentence == null || info.exampleSentence.isBlank()) {
            info.exampleSentence = "Practice using \"" + word + "\" in daily conversations.";
        }

        return info;
    }

    private VocabularyResponse mapToResponse(VocabularyItem item) {
        return VocabularyResponse.builder()
                .id(item.getId())
                .lessonId(item.getLesson().getId())
                .word(item.getWord())
                .meaning(item.getMeaning())
                .ipa(item.getIpa())
                .audioUrl(item.getAudioUrl())
                .exampleSentence(item.getExampleSentence())
                .partOfSpeech(item.getPartOfSpeech())
                .build();
    }

    private static class CrawledVocabInfo {
        String ipa;
        String audioUrl;
        String partOfSpeech = "noun";
        String meaning;
        String exampleSentence;
    }
}