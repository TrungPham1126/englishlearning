export interface SortableOptionLike {
  id?: string | null;
  optionLabel?: string | null;
  optionText?: string | null;
  text?: string | null;
}

const LEADING_OPTION_LABEL_REGEX = /^\s*([A-Za-z])\s*[.):-]\s+/;

function normalizeOptionLabel(opt: SortableOptionLike | string): string {
  if (typeof opt === 'string') {
    const match = opt.match(LEADING_OPTION_LABEL_REGEX);
    return match ? match[1].toUpperCase() : '';
  }
  const rawLabel = String(opt?.optionLabel ?? '')
    .trim()
    .replace(/[.):]+$/, '')
    .trim()
    .toUpperCase();
  if (rawLabel) return rawLabel;

  const rawText = String(opt?.optionText ?? opt?.text ?? '');
  const match = rawText.match(LEADING_OPTION_LABEL_REGEX);
  return match ? match[1].toUpperCase() : '';
}

function getOptionOrderRank(label: string): number {
  if (!label) return Number.MAX_SAFE_INTEGER;
  if (label === 'TRUE') return 0;
  if (label === 'FALSE') return 1;
  if (label === 'NOT_GIVEN' || label === 'NOT GIVEN') return 2;
  if (/^[A-Z]$/.test(label)) {
    return label.charCodeAt(0) - 65;
  }
  if (/^\d+$/.test(label)) {
    return 100 + Number(label);
  }
  return 1000;
}

/**
 * Sắp xếp danh sách đáp án trắc nghiệm theo thứ tự chuẩn A, B, C, D... (hoặc TRUE, FALSE, NOT GIVEN)
 * mà không làm thay đổi mảng đầu vào, giữ nguyên thứ tự gốc nếu không có nhãn phân biệt.
 */
export function sortQuestionOptions<T extends SortableOptionLike | string>(
  options?: readonly T[] | null,
): T[] {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  return options
    .map((item, idx) => {
      const label = item == null ? '' : normalizeOptionLabel(item);
      return {
        item,
        idx,
        label,
        rank: getOptionOrderRank(label),
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.label !== b.label) return a.label.localeCompare(b.label);
      return a.idx - b.idx;
    })
    .map((entry) => entry.item);
}
