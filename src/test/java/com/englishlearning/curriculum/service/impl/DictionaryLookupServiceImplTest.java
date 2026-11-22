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

    @Test
    @DisplayName("lookup_whenNetworkFailsThenRecovers_doesNotCacheTransientErrorAndSucceedsOnRetry")
    void lookup_whenNetworkFailsThenRecovers_doesNotCacheTransientErrorAndSucceedsOnRetry() {
        // Given
        String url = "https://api.dictionaryapi.dev/api/v2/entries/en/fluent";
        String validJson = """
                [
                  {
                    "word": "fluent",
                    "phonetic": "/ˈfluːənt/",
                    "phonetics": [],
                    "meanings": [
                      {
                        "partOfSpeech": "adjective",
                        "definitions": [
                          { "definition": "Able to speak easily.", "example": "He is fluent in English." }
                        ]
                      }
                    ]
                  }
                ]
                """;
        when(restTemplate.getForObject(url, String.class))
                .thenThrow(new RestClientException("Read timed out"))
                .thenReturn(validJson);

        // When: Lần 1 lỗi mạng -> trả fallback nhưng KHÔNG cache
        DictionaryLookupService.DictionaryEntryDto first = lookupService.lookup("fluent");
        assertThat(first.getIpa()).isEqualTo("/fluent/");
        assertThat(first.getMeaning()).isEqualTo("Nghĩa của từ: fluent");

        // Lần 2 mạng hồi phục -> gọi lại API thành công và lưu cache
        DictionaryLookupService.DictionaryEntryDto retried = lookupService.lookup("fluent");
        assertThat(retried.getIpa()).isEqualTo("/ˈfluːənt/");
        assertThat(retried.getPartOfSpeech()).isEqualTo("adjective");
        assertThat(retried.getMeaning()).isEqualTo("Able to speak easily.");

        // Lần 3 lấy từ cache
        DictionaryLookupService.DictionaryEntryDto cached = lookupService.lookup("FLUENT");
        assertThat(cached).isSameAs(retried);
        verify(restTemplate, times(2)).getForObject(url, String.class);
    }

    @Test
    @DisplayName("lookup_whenApiReturnsMalformedJson_usesFallbacksWithoutCaching")
    void lookup_whenApiReturnsMalformedJson_usesFallbacksWithoutCaching() {
        // Given
        String url = "https://api.dictionaryapi.dev/api/v2/entries/en/clarity";
        String recoveredJson = """
                [
                  {
                    "word": "clarity",
                    "phonetic": "ˈklærəti",
                    "phonetics": [],
                    "meanings": []
                  }
                ]
                """;
        when(restTemplate.getForObject(url, String.class))
                .thenReturn("{invalid-json")
                .thenReturn(recoveredJson);

        // When
        DictionaryLookupService.DictionaryEntryDto first = lookupService.lookup("clarity");
        DictionaryLookupService.DictionaryEntryDto second = lookupService.lookup("clarity");

        // Then
        assertThat(first.getIpa()).isEqualTo("/clarity/");
        assertThat(second.getIpa()).isEqualTo("/ˈklærəti/");
        verify(restTemplate, times(2)).getForObject(url, String.class);
    }

    @Test
    @DisplayName("lookup_whenApiReturnsBlankOrEmptyArray_usesFallbacksAndCachesValidEmptyResponse")
    void lookup_whenApiReturnsBlankOrEmptyArray_usesFallbacksAndCachesValidEmptyResponse() {
        // Given
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/blankword", String.class))
                .thenReturn("   ");
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/emptyarray", String.class))
                .thenReturn("[]");

        // When
        DictionaryLookupService.DictionaryEntryDto blankResp = lookupService.lookup("blankword");
        DictionaryLookupService.DictionaryEntryDto emptyResp = lookupService.lookup("emptyarray");
        DictionaryLookupService.DictionaryEntryDto emptyCached = lookupService.lookup("EMPTYARRAY");

        // Then
        assertThat(blankResp.getIpa()).isEqualTo("/blankword/");
        assertThat(blankResp.getPartOfSpeech()).isEqualTo("noun");
        assertThat(emptyResp.getIpa()).isEqualTo("/emptyarray/");
        assertThat(emptyCached).isSameAs(emptyResp);
        verify(restTemplate, times(1)).getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/emptyarray", String.class);
    }

    @Test
    @DisplayName("lookup_whenPhoneticIsSlashOnlyAndPartOfSpeechBlank_fallsBackToWordIpaAndNoun")
    void lookup_whenPhoneticIsSlashOnlyAndPartOfSpeechBlank_fallsBackToWordIpaAndNoun() {
        // Given
        String json = """
                [
                  {
                    "word": "focus",
                    "phonetic": "///",
                    "phonetics": [{ "text": "//", "audio": "" }],
                    "meanings": [
                      {
                        "partOfSpeech": "   ",
                        "definitions": []
                      }
                    ]
                  }
                ]
                """;
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/focus", String.class))
                .thenReturn(json);

        // When
        DictionaryLookupService.DictionaryEntryDto entry = lookupService.lookup("focus");

        // Then
        assertThat(entry.getIpa()).isEqualTo("/focus/");
        assertThat(entry.getPartOfSpeech()).isEqualTo("noun");
        assertThat(entry.getMeaning()).isEqualTo("Nghĩa của từ: focus");
        assertThat(entry.getExampleSentence()).isEqualTo("Practice using \"focus\" in daily conversations.");
    }

    @Test
    @DisplayName("lookup_whenAudioIsNonUsOrNonMp3_fallsBackToYoudaoAudio")
    void lookup_whenAudioIsNonUsOrNonMp3_fallsBackToYoudaoAudio() {
        // Given
        String json = """
                [
                  {
                    "word": "schedule",
                    "phonetic": "ˈskedʒuːl",
                    "phonetics": [
                      { "audio": "https://cdn.example.com/schedule-uk.mp3" },
                      { "audio": "https://cdn.example.com/schedule-us.ogg" }
                    ],
                    "meanings": []
                  }
                ]
                """;
        when(restTemplate.getForObject("https://api.dictionaryapi.dev/api/v2/entries/en/schedule", String.class))
                .thenReturn(json);

        // When
        DictionaryLookupService.DictionaryEntryDto entry = lookupService.lookup("schedule");

        // Then
        assertThat(entry.getIpa()).isEqualTo("/ˈskedʒuːl/");
        assertThat(entry.getAudioUrl()).isEqualTo("https://dict.youdao.com/dictvoice?audio=schedule&type=2");
    }

    @Test
    @DisplayName("lookup_whenMultiWordPhrase_encodesUrlAndUsesFallbackAudio")
    void lookup_whenMultiWordPhrase_encodesUrlAndUsesFallbackAudio() {
        // Given
        String expectedApiUrl = "https://api.dictionaryapi.dev/api/v2/entries/en/ice+cream";
        when(restTemplate.getForObject(expectedApiUrl, String.class)).thenReturn("[]");

        // When
        DictionaryLookupService.DictionaryEntryDto entry = lookupService.lookup("  Ice Cream! ");

        // Then
        assertThat(entry.getWord()).isEqualTo("ice cream");
        assertThat(entry.getAudioUrl()).isEqualTo("https://dict.youdao.com/dictvoice?audio=ice+cream&type=2");
        verify(restTemplate).getForObject(expectedApiUrl, String.class);
    }
}
