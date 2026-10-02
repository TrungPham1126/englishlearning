package com.englishlearning.common.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

@Configuration
@PropertySource(value = "classpath:secrets.properties", ignoreResourceNotFound = false)
@ConfigurationProperties(prefix = "app.secrets")
@Getter
@Setter
public class AppProperties {

    private Database database = new Database();
    private Redis redis = new Redis();
    private Rabbitmq rabbitmq = new Rabbitmq();
    private Jwt jwt = new Jwt();
    private Storage storage = new Storage();
    private Gemini gemini = new Gemini();

    @Getter
    @Setter
    public static class Database {
        private String username;
        private String password;
    }

    @Getter
    @Setter
    public static class Redis {
        private String password;
    }

    @Getter
    @Setter
    public static class Rabbitmq {
        private String username;
        private String password;
    }

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenExpirationMs = 1800000L;
        private long refreshTokenExpirationMs = 604800000L;
    }

    @Getter
    @Setter
    public static class Storage {
        private String accessKey;
        private String secretKey;
        private String region = "us-east-1";
        private String bucketName = "english-learning-media";
        private String endpoint;
    }

    @Getter
    @Setter
    public static class Gemini {
        private String apiKey;
        private String baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        private String model = "gemini-2.5-flash";
    }

    private Groq groq = new Groq();

    @Getter
    @Setter
    public static class Groq {
        private String apiKey;
        private String chatUrl = "https://api.groq.com/openai/v1/chat/completions";
        private String audioUrl = "https://api.groq.com/openai/v1/audio/transcriptions";

        // Đồng bộ model đang active
        private String chatModel = "openai/gpt-oss-120b";
        private String whisperModel = "whisper-large-v3-turbo";
    }
}