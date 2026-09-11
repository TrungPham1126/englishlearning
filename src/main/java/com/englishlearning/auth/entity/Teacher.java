package com.englishlearning.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "teachers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Teacher {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id")
    private User user;

    @Column(length = 255)
    private String specialization;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(columnDefinition = "TEXT")
    private String bio;
}