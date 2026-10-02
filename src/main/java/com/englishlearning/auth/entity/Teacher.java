package com.englishlearning.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", columnDefinition = "VARCHAR(36)")
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id", columnDefinition = "VARCHAR(36)")
    private User user;

    @Column(length = 255)
    private String specialization;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(columnDefinition = "TEXT")
    private String bio;
}