export function getFirstLetterHint(word?: string): string {
  if (!word) return "";
  const trimmed = word.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "";
}

export function extractInlinePromptHint(promptText?: string | null): string | null {
  const match = String(promptText ?? "").match(/\(\s*Gợi\s*ý\s*:\s*([^)]+)\)/i);
  const extracted = match?.[1]?.trim();
  return extracted ? extracted : null;
}

export function stripInlinePromptHint(promptText: string): string {
  return String(promptText ?? "")
    .replace(/\s*\(\s*Gợi\s*ý\s*:[^)]+\)/gi, "")
    .replace(/[ \t]+:/g, ":")
    .trim();
}

const ALPHANUMERIC_CHAR_REGEX = /[\p{L}\p{N}]/u;

export function buildQuestionHintText(params: {
  promptText?: string | null;
  hint?: string | null;
  correctAnswer?: string | null;
  isWordUnscramble?: boolean;
}): string | null {
  const explicitHint = String(params.hint ?? "").trim();
  if (explicitHint) return explicitHint;

  const inlineHint = extractInlinePromptHint(params.promptText);
  if (inlineHint) return inlineHint;

  const rawAnswer = String(params.correctAnswer ?? "").trim();
  if (!rawAnswer) return null;

  const primary =
    rawAnswer
      .split(/[|/]/)
      .map((part) => part.trim())
      .find(Boolean) || "";
  if (!primary) return null;

  const words = primary.split(/\s+/).filter(Boolean);
  if (params.isWordUnscramble) {
    if (words.length >= 2) {
      return `Bắt đầu bằng "${words[0]}" (${words.length} từ)`;
    }
    return null;
  }

  let alnumCount = 0;
  for (const ch of primary) {
    if (ALPHANUMERIC_CHAR_REGEX.test(ch)) {
      alnumCount++;
    }
  }
  if (alnumCount <= 1) {
    return "1 ký tự";
  }

  const maskedWords = words.map((word) => {
    let revealedFirst = false;
    let out = "";
    for (const ch of word) {
      if (ALPHANUMERIC_CHAR_REGEX.test(ch)) {
        if (!revealedFirst) {
          out += ch;
          revealedFirst = true;
        } else {
          out += "_";
        }
      } else {
        out += ch;
      }
    }
    return out;
  });

  const masked = maskedWords.join(" ");
  if (words.length === 1) {
    return `${masked} (${primary.length} ký tự)`;
  }
  return `${masked} (${words.length} từ)`;
}
