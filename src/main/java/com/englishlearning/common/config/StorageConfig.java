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

    @Value("${cloud.aws.credentials.access-key:mock-access-key}")
    private String accessKey;

    @Value("${cloud.aws.credentials.secret-key:mock-secret-key}")
    private String secretKey;

    @Value("${cloud.aws.region.static:us-east-1}")
    private String region;

    @Value("${cloud.aws.s3.endpoint:}")
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