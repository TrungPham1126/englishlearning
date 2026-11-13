package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.impl.UserServiceImpl;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl - Kiểm thử upload và xác thực ảnh đại diện")
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserServiceImpl userService;

    private final List<UUID> trackedUserIds = new ArrayList<>();

    @AfterEach
    void cleanupAvatarFiles() throws IOException {
        Path uploadDir = Paths.get("uploads", "avatars");
        if (!trackedUserIds.isEmpty() && Files.exists(uploadDir)) {
            for (UUID uid : trackedUserIds) {
                String prefix = "avatar_" + uid + "_";
                try (Stream<Path> files = Files.list(uploadDir)) {
                    files.filter(p -> p.getFileName().toString().startsWith(prefix))
                            .forEach(p -> {
                                try {
                                    Files.deleteIfExists(p);
                                } catch (IOException ignored) {
                                }
                            });
                }
            }
        }
        trackedUserIds.clear();
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: Lưu ảnh JPG hợp lệ vào đĩa, cập nhật User.avatarUrl và trả về đường dẫn")
    void uploadAndSaveAvatar_whenValidJpgFile_savesFileAndUpdatesUser() {
        // Given
        UUID userId = UUID.randomUUID();
        trackedUserIds.add(userId);
        User user = User.builder().id(userId).email("student@elp.edu.vn").build();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "profile.jpeg",
                "image/jpeg",
                "fake-jpeg-data".getBytes()
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // When
        String savedUrl = userService.uploadAndSaveAvatar(userId, file);

        // Then
        assertThat(savedUrl).startsWith("/uploads/avatars/avatar_" + userId + "_").endsWith(".jpeg");
        Path expectedDiskPath = Paths.get(savedUrl.substring(1));
        assertThat(Files.exists(expectedDiskPath)).isTrue();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getAvatarUrl()).isEqualTo(savedUrl);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: Chấp nhận đuôi .webp hợp lệ ngay cả khi Content-Type là application/octet-stream")
    void uploadAndSaveAvatar_whenValidExtensionWithGenericContentType_succeeds() {
        // Given
        UUID userId = UUID.randomUUID();
        trackedUserIds.add(userId);
        User user = User.builder().id(userId).email("teacher@elp.edu.vn").build();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.WEBP",
                "application/octet-stream",
                new byte[]{10, 20, 30}
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // When
        String savedUrl = userService.uploadAndSaveAvatar(userId, file);

        // Then
        assertThat(savedUrl).endsWith(".webp");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: File không có đuôi mở rộng nhưng MIME là image/* -> Mặc định dùng .jpg")
    void uploadAndSaveAvatar_whenFilenameHasNoExtensionAndMimeIsImage_defaultsToJpg() {
        // Given
        UUID userId = UUID.randomUUID();
        trackedUserIds.add(userId);
        User user = User.builder().id(userId).email("admin@elp.edu.vn").build();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "blob",
                "IMAGE/PNG",
                new byte[]{1, 2, 3}
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // When
        String savedUrl = userService.uploadAndSaveAvatar(userId, file);

        // Then
        assertThat(savedUrl).endsWith(".jpg");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: Biên chính xác 5MB (5 * 1024 * 1024 bytes) vẫn hợp lệ")
    void uploadAndSaveAvatar_whenExactly5MB_succeeds() {
        // Given
        UUID userId = UUID.randomUUID();
        trackedUserIds.add(userId);
        User user = User.builder().id(userId).email("max@elp.edu.vn").build();
        byte[] exact5Mb = new byte[5 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "exact.png", "image/png", exact5Mb);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // When
        String savedUrl = userService.uploadAndSaveAvatar(userId, file);

        // Then
        assertThat(savedUrl).endsWith(".png");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: File null hoặc rỗng -> Ném BadRequestException")
    void uploadAndSaveAvatar_whenFileNullOrEmpty_throwsBadRequestException() {
        UUID userId = UUID.randomUUID();
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> userService.uploadAndSaveAvatar(userId, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Vui lòng chọn file ảnh đại diện hợp lệ");

        assertThatThrownBy(() -> userService.uploadAndSaveAvatar(userId, emptyFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Vui lòng chọn file ảnh đại diện hợp lệ");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: File vượt quá 5MB (5MB + 1 byte) -> Ném BadRequestException")
    void uploadAndSaveAvatar_whenExceeds5MB_throwsBadRequestException() {
        UUID userId = UUID.randomUUID();
        byte[] oversized = new byte[5 * 1024 * 1024 + 1];
        MockMultipartFile file = new MockMultipartFile("file", "oversized.png", "image/png", oversized);

        assertThatThrownBy(() -> userService.uploadAndSaveAvatar(userId, file))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Dung lượng file ảnh tối đa là 5MB");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: Sai cả định dạng đuôi (.exe) và Content-Type (application/octet-stream) -> Ném BadRequestException")
    void uploadAndSaveAvatar_whenInvalidExtensionAndInvalidContentType_throwsBadRequestException() {
        UUID userId = UUID.randomUUID();
        MockMultipartFile invalidFile = new MockMultipartFile(
                "file",
                "payload.exe",
                "application/octet-stream",
                "MZ-binary".getBytes()
        );

        assertThatThrownBy(() -> userService.uploadAndSaveAvatar(userId, invalidFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Chỉ chấp nhận các định dạng ảnh (.jpg, .jpeg, .png, .webp)");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: Không tìm thấy user trong DB -> Ném ResourceNotFoundException")
    void uploadAndSaveAvatar_whenUserNotFound_throwsResourceNotFoundException() {
        UUID missingId = UUID.randomUUID();
        MockMultipartFile validFile = new MockMultipartFile("file", "pic.png", "image/png", new byte[]{1, 2});
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.uploadAndSaveAvatar(missingId, validFile))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy người dùng");
    }

    @Test
    @DisplayName("uploadAndSaveAvatar: Đọc stream gặp IOException -> Bọc vào RuntimeException rõ ràng")
    void uploadAndSaveAvatar_whenInputStreamFails_throwsRuntimeException() throws IOException {
        // Given
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("ioerror@elp.edu.vn").build();
        MultipartFile brokenFile = mock(MultipartFile.class);
        when(brokenFile.isEmpty()).thenReturn(false);
        when(brokenFile.getSize()).thenReturn(128L);
        when(brokenFile.getOriginalFilename()).thenReturn("avatar.png");
        when(brokenFile.getContentType()).thenReturn("image/png");
        when(brokenFile.getInputStream()).thenThrow(new IOException("Disk full"));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // When / Then
        assertThatThrownBy(() -> userService.uploadAndSaveAvatar(userId, brokenFile))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Lỗi lưu trữ file ảnh đại diện: Disk full");
    }
}
