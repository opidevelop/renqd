export function highQualityImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url
    .replace(/\/(?:100|150|300|400|600)x(?:100|150|300|400|600)bb\.(jpg|jpeg|png|webp)(?=\?|$)/i, "/1200x1200bb.$1")
    .replace(/\/t\/p\/(?:w92|w154|w185|w342|w500|w780)\//i, "/t/p/original/")
    .replace(/ab67616d0000b273/gi, "ab67616d00001e02");
}
