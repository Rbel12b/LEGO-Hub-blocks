/** Filesystem-safe filename slug (no extension). */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "program";
}

/** Python identifier slug. */
export function sanitizeIdent(name: string): string {
  let s = name.replace(/[^A-Za-z0-9_]+/g, "_");
  if (!s || /^[0-9]/.test(s)) s = "_" + s;
  return s;
}
