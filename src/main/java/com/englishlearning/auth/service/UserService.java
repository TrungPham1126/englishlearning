package com.englishlearning.auth.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface UserService {

    String uploadAndSaveAvatar(UUID userId, MultipartFile file);
}
