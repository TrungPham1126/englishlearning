package com.englishlearning.curriculum.service.impl;

import com.englishlearning.curriculum.service.DictionaryLookupService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DictionaryLookupServiceImpl - Tra cứu IPA, Audio & Cache với Fallback Youdao")
class DictionaryLookupServiceImplTest {

    @Mock
    private RestTemplate restTemplate;

    private DictionaryLookupServiceImpl lookupService;

    @BeforeEach
    void setUp() {
        lookupService = new DictionaryLookupServiceImpl(restTemplate);
    }

    @Test
    @DisplayName("lookup - Input null, rỗng hoặc chỉ chứa dấu câu trả về null")
    void lookup_nullBlankOrPunctuationOnly_returnsNull() {
        assertThat(lookupService.lookup(null)).isNull();
        assertThat(lookupService.lookup("   ")).isNull();
        assertThat(lookupService.lookup("...\"!?()")).isNull();
        verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("lookup - Làm sạch dấu câu, phân tích IPA/MP3 hợp lệ từ phonetics và hit cache ở lần gọi thứ 2")
    void lookup_validResponse_parsesFieldsAndCachesResult() {
        String apiJson = """
                [
                  {
                    "word": "hello",
                    "phonetic": "",
                    "phonetics": [
                      { "text": "", "audio": "https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3" },
                      { "text": "həˈloʊ", "audio": "https://upload.wikimedia.org/wikipedia/commons/hello-us.mp3" }
                    ],
                    "meanings": [
                      {
                        "partOfSpeech": "interjection",
                        "definitions": [
                          {
                            "definition": "Used as a greeting.",
                            "example": "Hello there!"
                          }
                        ]
                      }
                    ]
                  }
                ]
                """;
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/hello", String.class))
                .thenReturn(apiJson);

        DictionaryLookupService.DictionaryEntryDto first = lookupService.lookup("  \"Hello!\" ");

        assertThat(first).isNotNull();
        assertThat(first.getWord()).isEqualTo("hello");
        assertThat(first.getIpa()).isEqualTo("/həˈloʊ/");
        // Bỏ qua domain api.dictionaryapi.dev (Cloudflare 522), chọn wikimedia -us mp3
        assertThat(first.getAudioUrl()).isEqualTo("https://upload.wikimedia.org/wikipedia/commons/hello-us.mp3");
        assertThat(first.getPartOfSpeech()).isEqualTo("interjection");
        assertThat(first.getMeaning()).isEqualTo("Used as a greeting.");
        assertThat(first.getExampleSentence()).isEqualTo("Hello there!");

        // Lần gọi thứ 2 dùng cache, không gọi lại RestTemplate
        DictionaryLookupService.DictionaryEntryDto cached = lookupService.lookup("HELLO");
        assertThat(cached).isSameAs(first);
        verify(restTemplate, times(1)).getForObject(anyString(), eq(String.class));
    }

    @Test
    @DisplayName("lookup - API lỗi hoặc JSON thiếu trường -> fallback IPA /word/, audio Youdao và meaning tiếng Việt")
    void lookup_apiExceptionOrIncompleteJson_usesFallbacks() {
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/resilience", String.class))
                .thenThrow(new RestClientException("404 Not Found"));

        DictionaryLookupService.DictionaryEntryDto fallback = lookupService.lookup("resilience");

        assertThat(fallback).isNotNull();
        assertThat(fallback.getIpa()).isEqualTo("/resilience/");
        assertThat(fallback.getAudioUrl()).isEqualTo("https://dict.youdao.com/dictvoice?audio=resilience&type=2");
        assertThat(fallback.getPartOfSpeech()).isEqualTo("noun");
        assertThat(fallback.getMeaning()).isEqualTo("Nghĩa của từ: resilience");
        assertThat(fallback.getExampleSentence()).contains("resilience");

        // JSON hợp lệ nhưng thiếu example & audio hợp lệ -> bổ sung fallback từng trường
        String partialJson = """
                [
                  {
                    "word": "brave",
                    "phonetic": "/breɪv/",
                    "phonetics": [],
                    "meanings": []
                  }
                ]
                """;
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/brave", String.class))
                .thenReturn(partialJson);

        DictionaryLookupService.DictionaryEntryDto partial = lookupService.lookup("brave");
        assertThat(partial.getIpa()).isEqualTo("/breɪv/");
        assertThat(partial.getAudioUrl()).isEqualTo("https://dict.youdao.com/dictvoice?audio=brave&type=2");
        assertThat(partial.getMeaning()).isEqualTo("Nghĩa của từ: brave");
    }
}
