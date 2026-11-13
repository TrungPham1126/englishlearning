package com.englishlearning.common.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PageResponse - Kiểm thử phân trang từ Spring Data Page")
class PageResponseTest {

    @Test
    @DisplayName("from(Page): Chuyển đổi chính xác trang đầu và trang giữa (last = false)")
    void from_withNonLastPage_mapsPaginationMetadataCorrectly() {
        // Given
        Page<String> page = new PageImpl<>(List.of("A", "B"), PageRequest.of(0, 2), 5);

        // When
        PageResponse<String> response = PageResponse.from(page);

        // Then
        assertThat(response.getContent()).containsExactly("A", "B");
        assertThat(response.getPageNumber()).isEqualTo(0);
        assertThat(response.getPageSize()).isEqualTo(2);
        assertThat(response.getTotalElements()).isEqualTo(5L);
        assertThat(response.getTotalPages()).isEqualTo(3);
        assertThat(response.isLast()).isFalse();
    }

    @Test
    @DisplayName("from(Page): Chuyển đổi chính xác trang cuối cùng (last = true)")
    void from_withLastPage_setsLastTrue() {
        // Given
        Page<String> page = new PageImpl<>(List.of("E"), PageRequest.of(2, 2), 5);

        // When
        PageResponse<String> response = PageResponse.from(page);

        // Then
        assertThat(response.getContent()).containsExactly("E");
        assertThat(response.getPageNumber()).isEqualTo(2);
        assertThat(response.getPageSize()).isEqualTo(2);
        assertThat(response.getTotalElements()).isEqualTo(5L);
        assertThat(response.getTotalPages()).isEqualTo(3);
        assertThat(response.isLast()).isTrue();
    }

    @Test
    @DisplayName("from(Page): Xử lý đúng trang rỗng (0 phần tử)")
    void from_withEmptyPage_mapsZeroTotals() {
        // Given
        Page<String> emptyPage = new PageImpl<>(Collections.emptyList(), PageRequest.of(0, 10), 0);

        // When
        PageResponse<String> response = PageResponse.from(emptyPage);

        // Then
        assertThat(response.getContent()).isEmpty();
        assertThat(response.getPageNumber()).isEqualTo(0);
        assertThat(response.getPageSize()).isEqualTo(10);
        assertThat(response.getTotalElements()).isEqualTo(0L);
        assertThat(response.getTotalPages()).isEqualTo(0);
        assertThat(response.isLast()).isTrue();
    }

    @Test
    @DisplayName("NoArgsConstructor và Setters hoạt động chính xác")
    void noArgsAndSetters_workCorrectly() {
        // When
        PageResponse<Integer> response = new PageResponse<>();
        response.setContent(List.of(1, 2, 3));
        response.setPageNumber(1);
        response.setPageSize(3);
        response.setTotalElements(10L);
        response.setTotalPages(4);
        response.setLast(false);

        // Then
        assertThat(response.getContent()).containsExactly(1, 2, 3);
        assertThat(response.getPageNumber()).isEqualTo(1);
        assertThat(response.getPageSize()).isEqualTo(3);
        assertThat(response.getTotalElements()).isEqualTo(10L);
        assertThat(response.getTotalPages()).isEqualTo(4);
        assertThat(response.isLast()).isFalse();
    }
}
