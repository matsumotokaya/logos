export type ByteRange =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "range"; start: number; end: number };

/** Parse the single-range subset used by HTML video players, including the
 * suffix form (`bytes=-500`). Multiple ranges are intentionally unsupported. */
export function parseByteRange(header: string | null, size: number): ByteRange {
  if (header === null) return { kind: "none" };
  if (!Number.isSafeInteger(size) || size <= 0) return { kind: "invalid" };
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return { kind: "invalid" };

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { kind: "invalid" };
    }
    return {
      kind: "range",
      start: Math.max(size - suffixLength, 0),
      end: size - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    requestedEnd < start ||
    start >= size
  ) {
    return { kind: "invalid" };
  }
  return { kind: "range", start, end: Math.min(requestedEnd, size - 1) };
}
