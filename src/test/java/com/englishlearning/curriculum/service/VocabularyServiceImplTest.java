package com.englishlearning.curriculum.service;

import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.VocabularyItem;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import com.englishlearning.curriculum.service.impl.VocabularyServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VocabularyServiceImpl - CRUD Từ vựng & Tự động điền IPA/Audio từ DictionaryLookup")
class VocabularyServiceImplTest {

    @Mock
    private VocabularyItemRepository vocabularyRepository;

    @Mock
    private LessonRepository lessonRepository;

    @Mock
    private DictionaryLookupService dictionaryLookupService;

    @InjectMocks
    private VocabularyServiceImpl vocabularyService;

    @Test
    @DisplayName("addVocabulary - Ưu tiên dữ liệu giáo viên nhập nhưng vẫn lấy audioUrl từ từ điển")
    void addVocabulary_teacherProvidedFields_prefersRequestAndUsesDictionaryAudio() {
        UUID lessonId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        VocabularyRequest req = new VocabularyRequest();
        req.setWord("  resilient  ");
        req.setMeaning("  kiên cường  ");
        req.setIpa("/rɪˈzɪl.jənt/");
        req.setPartOfSpeech("adjective");
        req.setExampleSentence("She is resilient.");

        DictionaryLookupService.DictionaryEntryDto dictEntry = DictionaryLookupService.DictionaryEntryDto.builder()
                .word("resilient")
                .ipa("/rɪˈzɪliənt/")
                .meaning("able to recover quickly")
                .partOfSpeech("noun")
                .exampleSentence("Default example")
                .audioUrl("https://audio.test/resilient.mp3")
                .build();

        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(lesson));
        when(dictionaryLookupService.lookup("resilient")).thenReturn(dictEntry);
        when(vocabularyRepository.save(any(VocabularyItem.class))).thenAnswer(inv -> {
            VocabularyItem item = inv.getArgument(0);
            item.setId(UUID.randomUUID());
            return item;
        });

        VocabularyResponse res = vocabularyService.addVocabulary(lessonId, req);

        assertThat(res.getWord()).isEqualTo("resilient");
        assertThat(res.getMeaning()).isEqualTo("kiên cường");
        assertThat(res.getIpa()).isEqualTo("/rɪˈzɪl.jənt/");
        assertThat(res.getPartOfSpeech()).isEqualTo("adjective");
        assertThat(res.getExampleSentence()).isEqualTo("She is resilient.");
        assertThat(res.getAudioUrl()).isEqualTo("https://audio.test/resilient.mp3");
    }

    @Test
    @DisplayName("addVocabulary - Fallback toàn bộ trường bỏ trống sang từ điển, và fallback rỗng nếu lookup == null")
    void addVocabulary_blankOptionalFields_fallsBackToDictionaryOrDefaults() {
        UUID lessonId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(lesson));
        when(vocabularyRepository.save(any(VocabularyItem.class))).thenAnswer(inv -> {
            VocabularyItem item = inv.getArgument(0);
            item.setId(UUID.randomUUID());
            return item;
        });

        // 1. Dictionary trả về đầy đủ
        VocabularyRequest reqWithLookup = new VocabularyRequest();
        reqWithLookup.setWord("apple");
        reqWithLookup.setMeaning("   ");
        when(dictionaryLookupService.lookup("apple")).thenReturn(DictionaryLookupService.DictionaryEntryDto.builder()
                .ipa("/ˈæp.əl/")
                .meaning("a round fruit")
                .partOfSpeech("noun")
                .exampleSentence("Eat an apple.")
                .audioUrl("https://dict.youdao.com/dictvoice?audio=apple&type=2")
                .build());

        VocabularyResponse res1 = vocabularyService.addVocabulary(lessonId, reqWithLookup);
        assertThat(res1.getIpa()).isEqualTo("/ˈæp.əl/");
        assertThat(res1.getMeaning()).isEqualTo("a round fruit");
        assertThat(res1.getExampleSentence()).isEqualTo("Eat an apple.");
        assertThat(res1.getPartOfSpeech()).isEqualTo("noun");

        // 2. Dictionary trả null
        VocabularyRequest reqNullLookup = new VocabularyRequest();
        reqNullLookup.setWord("customterm");
        reqNullLookup.setMeaning("thuật ngữ riêng");
        when(dictionaryLookupService.lookup("customterm")).thenReturn(null);

        VocabularyResponse res2 = vocabularyService.addVocabulary(lessonId, reqNullLookup);
        assertThat(res2.getIpa()).isEmpty();
        assertThat(res2.getPartOfSpeech()).isEqualTo("noun");
        assertThat(res2.getAudioUrl()).isNull();
    }

    @Test
    @DisplayName("addVocabulary - Lesson không tồn tại ném ResourceNotFoundException")
    void addVocabulary_lessonNotFound_throws404() {
        UUID lessonId = UUID.randomUUID();
        VocabularyRequest req = new VocabularyRequest();
        req.setWord("test");
        req.setMeaning("kiểm tra");
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vocabularyService.addVocabulary(lessonId, req))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(dictionaryLookupService, vocabularyRepository);
    }

    @Test
    @DisplayName("getVocabulariesByLesson - Map đầy đủ VocabularyResponse")
    void getVocabulariesByLesson_returnsMappedResponses() {
        UUID lessonId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        VocabularyItem item = VocabularyItem.builder()
                .id(UUID.randomUUID())
                .lesson(lesson)
                .word("fluent")
                .ipa("/ˈfluː.ənt/")
                .meaning("trôi chảy")
                .audioUrl("https://cdn.test/fluent.mp3")
                .build();
        when(vocabularyRepository.findByLessonId(lessonId)).thenReturn(List.of(item));

        List<VocabularyResponse> list = vocabularyService.getVocabulariesByLesson(lessonId);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getLessonId()).isEqualTo(lessonId);
        assertThat(list.get(0).getWord()).isEqualTo("fluent");
    }

    @Test
    @DisplayName("updateVocabulary - Tự động bổ sung IPA & audio nếu đang trống, hoặc cập nhật trực tiếp từ request")
    void updateVocabulary_autoFillsMissingIpaOrUpdatesProvided() {
        UUID vocabId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(UUID.randomUUID()).build();
        VocabularyItem item = VocabularyItem.builder()
                .id(vocabId)
                .lesson(lesson)
                .word("fluent")
                .ipa("")
                .audioUrl("")
                .meaning("cũ")
                .partOfSpeech("noun")
                .build();

        when(vocabularyRepository.findById(vocabId)).thenReturn(Optional.of(item));
        when(vocabularyRepository.save(any(VocabularyItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(dictionaryLookupService.lookup("articulate")).thenReturn(DictionaryLookupService.DictionaryEntryDto.builder()
                .ipa("/ɑːrˈtɪk.jə.lət/")
                .audioUrl("https://audio.test/articulate.mp3")
                .build());

        VocabularyRequest reqAutoFill = new VocabularyRequest();
        reqAutoFill.setWord("  articulate ");
        reqAutoFill.setMeaning("  lưu loát ");
        reqAutoFill.setPartOfSpeech("adjective");
        reqAutoFill.setExampleSentence("An articulate speaker.");

        VocabularyResponse res = vocabularyService.updateVocabulary(vocabId, reqAutoFill);
        assertThat(res.getWord()).isEqualTo("articulate");
        assertThat(res.getIpa()).isEqualTo("/ɑːrˈtɪk.jə.lət/");
        assertThat(res.getAudioUrl()).isEqualTo("https://audio.test/articulate.mp3");
        assertThat(res.getMeaning()).isEqualTo("lưu loát");
        assertThat(res.getPartOfSpeech()).isEqualTo("adjective");

        // Khi IPA mới được truyền tường minh -> ghi đè không gọi lookup nữa
        VocabularyRequest reqExplicitIpa = new VocabularyRequest();
        reqExplicitIpa.setWord("articulate");
        reqExplicitIpa.setIpa("/custom/");
        reqExplicitIpa.setMeaning("rõ ràng");
        VocabularyResponse res2 = vocabularyService.updateVocabulary(vocabId, reqExplicitIpa);
        assertThat(res2.getIpa()).isEqualTo("/custom/");
        verify(dictionaryLookupService, times(1)).lookup(any());
    }

    @Test
    @DisplayName("updateVocabulary & deleteVocabulary - Ném ResourceNotFoundException khi không tìm thấy")
    void updateAndDeleteVocabulary_notFound_throwsException() {
        UUID missingId = UUID.randomUUID();
        when(vocabularyRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vocabularyService.updateVocabulary(missingId, new VocabularyRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> vocabularyService.deleteVocabulary(missingId))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID existingId = UUID.randomUUID();
        VocabularyItem item = VocabularyItem.builder().id(existingId).build();
        when(vocabularyRepository.findById(existingId)).thenReturn(Optional.of(item));
        vocabularyService.deleteVocabulary(existingId);

        ArgumentCaptor<VocabularyItem> captor = ArgumentCaptor.forClass(VocabularyItem.class);
        verify(vocabularyRepository).delete(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(existingId);
    }
}
