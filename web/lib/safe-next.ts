/**
 * Where to send someone after signing in: a path on this site, or the
 * dashboard. The path is resolved the way a browser would, so tricks such as
 * "//evil.com" or "/\evil.com" that lead off the site are refused.
 */
export function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next?.startsWith("/")) return "/dashboard";
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin === "http://localhost") return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Not a valid address at all.
  }
  return "/dashboard";
}
