# ==============================================================================
# Multi-stage Dockerfile for Spring Boot 3 Backend
# ==============================================================================
# Stage 1: Build Application with Maven
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /build

# Copy Maven wrapper and dependencies metadata for build caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw

# Pre-download dependencies (fail-safe)
RUN ./mvnw dependency:go-offline -B || true

# Copy source code and resources
COPY src/ ./src/

# Build production jar skipping tests
RUN ./mvnw clean package -DskipTests -B

# ==============================================================================
# Stage 2: Minimal Production JRE Runtime
# ==============================================================================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-root system user and upload directory for media
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /app/uploads && \
    chown -R appuser:appgroup /app

USER appuser

# Copy built artifact from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Expose Spring Boot port
EXPOSE 8080

# Run Spring Boot application
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]

