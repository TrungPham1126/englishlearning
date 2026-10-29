package com.englishlearning.classroom.service;

import com.englishlearning.classroom.dto.*;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.common.dto.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface ClassroomService {

    ClassroomResponse createClassroom(CreateClassroomRequest req);

    ClassroomResponse updateClassStatus(UUID classId, UpdateClassStatusRequest req);

    ClassroomResponse assignTeacher(UUID classId, AssignTeacherRequest req);

    void enrollStudent(UUID classId, EnrollStudentRequest req);

    void enrollStudentByJoinCode(String joinCode, UUID studentId);

    List<ClassroomResponse> getTeacherClasses(UUID teacherUserId);

    ClassroomResponse getClassroomById(UUID classId);

    List<MyCourseResponse> getStudentCourses(UUID studentUserId);

    PageResponse<ClassroomResponse> getAllClassrooms(ClassStatus status, Pageable pageable);

    void leaveClass(UUID classId, UUID studentId);

    List<StudentProgressResponse> getClassStudentsProgress(UUID classId);
}
