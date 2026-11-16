/**
 * `<audio>` and `<video>` only consider a resource seekable when the server
 * answers range requests properly. `net.fetch` on a `file:` URL honours the
 * `Range` header but reports `200 OK` with no `Content-Range`/`Accept-Ranges`,
 * so the media element treats the file as a one-shot stream and a seek just
 * starts a fresh request at byte 0. The protocol handler therefore parses the
 * header itself; this module holds that parser so it can be tested alone.
 */

export interface ByteRange {
  /** First byte of the range, inclusive. */
  start: number
  /** Last byte of the range, inclusive. */
  end: number
}

export type ParsedByteRange = ByteRange | 'unsatisfiable' | null

/**
 * Parses a single-range `Range` header against a resource of `size` bytes.
 *
 * Returns `null` when there is nothing usable to honour (no header, another
 * unit, malformed syntax, or several ranges) — the caller then serves the
 * whole file with `200`, which RFC 9110 allows. Returns `'unsatisfiable'` for
 * a syntactically valid range that lies past the end of the file, which must
 * be answered with `416` so the media element learns the real size.
 */
export function parseByteRange(header: string | null | undefined, size: number): ParsedByteRange {
  if (!header) return null

  const match = /^bytes=(.*)$/i.exec(header.trim())
  if (!match) return null

  const spec = match[1].trim()
  // Multi-range responses need a multipart body; media elements ask for one
  // range, so anything else is safer to ignore than to answer partially.
  if (!spec || spec.includes(',')) return null

  const parts = /^(\d*)-(\d*)$/.exec(spec)
  if (!parts) return null
  const [, rawStart, rawEnd] = parts
  if (rawStart === '' && rawEnd === '') return null

  if (rawStart === '') {
    // `bytes=-N`: the last N bytes.
    const suffix = Number(rawEnd)
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return 'unsatisfiable'
    if (size === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(rawStart)
  if (!Number.isSafeInteger(start) || start < 0) return null
  if (start >= size) return 'unsatisfiable'

  if (rawEnd === '') return { start, end: size - 1 }

  const end = Number(rawEnd)
  if (!Number.isSafeInteger(end) || end < 0) return null
  // A last-byte-pos below first-byte-pos is malformed; ignore the header.
  if (end < start) return null

  return { start, end: Math.min(end, size - 1) }
}
