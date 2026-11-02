package com.englishlearning;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EnglishLearningApplication {

    public static void main(String[] args) {
        SpringApplication.run(EnglishLearningApplication.class, args);
    }

}
