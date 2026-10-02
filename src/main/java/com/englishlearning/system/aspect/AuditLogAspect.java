package com.englishlearning.system.aspect;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.system.AuditLog;
import com.englishlearning.system.repository.AuditLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogAspect {

    private final AuditLogRepository auditLogRepository;
    private final EntityManager entityManager;

    // Chặn tất cả các hàm bắt đầu bằng create, update, delete, assign, enroll trong
    // các class Service
    @AfterReturning(pointcut = "execution(* com.englishlearning.*.service.*.create*(..)) || " +
            "execution(* com.englishlearning.*.service.*.update*(..)) || " +
            "execution(* com.englishlearning.*.service.*.delete*(..)) || " +
            "execution(* com.englishlearning.classroom.service.ClassroomService.assign*(..)) || " +
            "execution(* com.englishlearning.classroom.service.ClassroomService.enroll*(..))", returning = "result")
    public void logAuditActivity(JoinPoint joinPoint, Object result) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()
                    || "anonymousUser".equals(authentication.getPrincipal())) {
                return;
            }

            User user = null;
            if (authentication.getPrincipal() instanceof CustomUserDetails userDetails) {
                user = entityManager.getReference(User.class, userDetails.getId());
            }

            // Lấy địa chỉ IP từ Request
            String ipAddress = "Unknown";
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                ipAddress = request.getHeader("X-Forwarded-For");
                if (ipAddress == null) {
                    ipAddress = request.getRemoteAddr();
                }
            }

            String methodName = joinPoint.getSignature().getName();
            String className = joinPoint.getTarget().getClass().getSimpleName();

            String action = determineAction(methodName);

            AuditLog auditLog = AuditLog.builder()
                    .user(user)
                    .action(action)
                    .entityName(className.replace("Service", ""))
                    .ipAddress(ipAddress)
                    .metadataJson("{\"method\": \"" + methodName + "\"}")
                    .build();

            auditLogRepository.save(auditLog);

        } catch (Exception e) {
            log.error("Lỗi khi ghi Audit Log ngầm: {}", e.getMessage());
        }
    }

    private String determineAction(String methodName) {
        if (methodName.startsWith("create"))
            return "CREATE";
        if (methodName.startsWith("update"))
            return "UPDATE";
        if (methodName.startsWith("delete"))
            return "DELETE";
        if (methodName.startsWith("assign"))
            return "ASSIGN";
        if (methodName.startsWith("enroll"))
            return "ENROLL";
        return "OTHER";
    }
}