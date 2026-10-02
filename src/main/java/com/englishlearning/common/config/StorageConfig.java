package com.englishlearning.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class StorageConfig {

    // Đã đổi sang đọc từ app.secrets.storage.*
    @Value("${app.secrets.storage.access-key}")
    private String accessKey;

    @Value("${app.secrets.storage.secret-key}")
    private String secretKey;

    @Value("${app.secrets.storage.region:us-east-1}")
    private String region;

    @Value("${app.secrets.storage.endpoint}")
    private String endpoint;

    @Bean
    public S3Client s3Client() {
        var credentials = AwsBasicCredentials.create(accessKey, secretKey);
        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());

        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
        }

        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        var credentials = AwsBasicCredentials.create(accessKey, secretKey);
        var builder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());

        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
        }

        return builder.build();
    }
}