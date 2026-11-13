package com.englishlearning.curriculum.service;

import com.englishlearning.auth.entity.User;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.GlobalResourceResponse;
import com.englishlearning.curriculum.entity.GlobalResource;
import com.englishlearning.curriculum.repository.GlobalResourceRepository;
import com.englishlearning.curriculum.service.impl.GlobalResourceServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("GlobalResourceServiceImpl - Kho tài nguyên dùng chung Admin/Giáo viên")
class GlobalResourceServiceImplTest {

    @Mock
    private GlobalResourceRepository repository;

    @Mock
    private DocumentStorageService storageService;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private GlobalResourceServiceImpl service;

    @Test
    @DisplayName("getResourcesByType - Chuẩn hóa 'DOCUMENT' -> DOC, null -> DOC và format size/timestamp")
    void getResourcesByType_aliasesAndFormatting_returnsMappedList() {
        UUID resId1 = UUID.randomUUID();
        UUID resId2 = UUID.randomUUID();
        GlobalResource r1 = GlobalResource.builder()
                .id(resId1)
                .name("grammar.pdf")
                .storageUrl("https://cdn.test/grammar.pdf")
                .resourceType(GlobalResource.ResourceType.DOC)
                .sizeBytes(1024L * 1024L)
                .usedCount(4)
                .createdAt(Instant.parse("2026-10-01T08:30:00Z"))
                .build();
        GlobalResource r2 = GlobalResource.builder()
                .id(resId2)
                .name("notes.txt")
                .storageUrl("https://cdn.test/notes.txt")
                .resourceType(GlobalResource.ResourceType.DOC)
                .sizeBytes(null)
                .usedCount(0)
                .createdAt(null)
                .build();

        when(repository.findByResourceTypeOrderByCreatedAtDesc(GlobalResource.ResourceType.DOC))
                .thenReturn(List.of(r1, r2));

        List<GlobalResourceResponse> resDocAlias = service.getResourcesByType(" document ");
        assertThat(resDocAlias).hasSize(2);
        assertThat(resDocAlias.get(0).getSize()).matches("1[.,]00 MB");
        assertThat(resDocAlias.get(0).getUploadedAt()).isNotBlank();
        assertThat(resDocAlias.get(1).getSize()).isEqualTo("0 MB");
        assertThat(resDocAlias.get(1).getUploadedAt()).isEmpty();

        service.getResourcesByType(null);
        verify(repository, times(2)).findByResourceTypeOrderByCreatedAtDesc(GlobalResource.ResourceType.DOC);
    }

    @Test
    @DisplayName("getResourcesByType - Type không hợp lệ ném BadRequestException")
    void getResourcesByType_invalidType_throwsBadRequest() {
        assertThatThrownBy(() -> service.getResourcesByType("ARCHIVE"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Loại tài nguyên không hợp lệ");
    }

    @Test
    @DisplayName("uploadResource - Upload lên Storage và lưu metadata GlobalResource")
    void uploadResource_validInput_savesResource() {
        UUID adminId = UUID.randomUUID();
        User admin = User.builder().id(adminId).email("admin@test.com").build();
        MockMultipartFile file = new MockMultipartFile("file", "mock_test.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(storageService.uploadFile(file)).thenReturn("https://cdn.test/documents/mock_test.pdf");
        when(entityManager.getReference(User.class, adminId)).thenReturn(admin);

        service.uploadResource(file, "exam", adminId);

        ArgumentCaptor<GlobalResource> captor = ArgumentCaptor.forClass(GlobalResource.class);
        verify(repository).save(captor.capture());
        GlobalResource saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("mock_test.pdf");
        assertThat(saved.getStorageUrl()).isEqualTo("https://cdn.test/documents/mock_test.pdf");
        assertThat(saved.getResourceType()).isEqualTo(GlobalResource.ResourceType.EXAM);
        assertThat(saved.getSizeBytes()).isEqualTo(3L);
        assertThat(saved.getUploadedBy()).isEqualTo(admin);
    }

    @Test
    @DisplayName("uploadResource - Type trống hoặc không hợp lệ ném BadRequestException trước khi upload")
    void uploadResource_invalidOrBlankType_throwsBadRequestWithoutUploading() {
        MockMultipartFile file = new MockMultipartFile("file", "test.pdf", "application/pdf", new byte[]{1});

        assertThatThrownBy(() -> service.uploadResource(file, "   ", UUID.randomUUID()))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.uploadResource(file, "UNKNOWN", UUID.randomUUID()))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(storageService, repository);
    }

    @Test
    @DisplayName("deleteResource - Xóa thành công và ném ResourceNotFoundException khi không tìm thấy")
    void deleteResource_foundAndMissing_behavesCorrectly() {
        UUID id = UUID.randomUUID();
        GlobalResource resource = GlobalResource.builder().id(id).build();
        when(repository.findById(id)).thenReturn(Optional.of(resource));

        service.deleteResource(id);
        verify(repository).delete(resource);

        UUID missingId = UUID.randomUUID();
        when(repository.findById(missingId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteResource(missingId))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(repository, never()).deleteById(any());
    }
}
