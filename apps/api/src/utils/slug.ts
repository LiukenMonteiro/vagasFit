import { normalizeText } from "./text";

export function slugify(value: string): string {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalized || "curriculo";
}
