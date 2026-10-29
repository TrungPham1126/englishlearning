package com.englishlearning.curriculum.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.File;

public interface DocumentStorageService {

    String uploadFile(MultipartFile file);

    String uploadAudioFile(MultipartFile file);

    String storeAudioFile(File sourceFile);

    String storeAudioBytes(byte[] audioBytes, String filename, String contentType);

    void deleteFileByUrl(String fileUrl);
}
