package com.englishlearning.auth.service.impl;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.UserService;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    @Override
    @Transactional
    public String uploadAndSaveAvatar(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn file ảnh đại diện hợp lệ");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Dung lượng file ảnh tối đa là 5MB");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = ".jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }

        String contentType = file.getContentType();
        boolean validContentType = contentType != null && contentType.toLowerCase().startsWith("image/");
        boolean validExtension = ALLOWED_EXTENSIONS.contains(extension);

        if (!validContentType && !validExtension) {
            throw new BadRequestException("Chỉ chấp nhận các định dạng ảnh (.jpg, .jpeg, .png, .webp)");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        try {
            Path uploadDir = Paths.get("uploads", "avatars");
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            String fileName = "avatar_" + userId + "_" + System.currentTimeMillis() + extension;
            Path targetPath = uploadDir.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            String savedPath = "/uploads/avatars/" + fileName;
            user.setAvatarUrl(savedPath);
            userRepository.save(user);

            log.info("Đã upload và lưu avatar thành công cho user {}: {}", userId, savedPath);
            return savedPath;
        } catch (IOException e) {
            log.error("Lỗi khi lưu file avatar cho user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Lỗi lưu trữ file ảnh đại diện: " + e.getMessage(), e);
        }
    }
}
