export function getFirstLetterHint(word?: string): string {
  if (!word) return "";
  const trimmed = word.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "";
}
