export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function truncateAtWord(value: string, maxLength: number): string {
  const cleaned = compact(value);
  if (cleaned.length <= maxLength) return cleaned;

  const boundary = cleaned.lastIndexOf(" ", maxLength);
  const truncated = cleaned.slice(0, boundary > maxLength * 0.7 ? boundary : maxLength).trim();
  return truncated.replace(/[,\-–—;:]+$/, "").trim();
}

export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
