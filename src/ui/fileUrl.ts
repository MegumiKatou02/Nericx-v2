/**
 * Songs live on disk, so their `src` has to be a real file URL: spaces, `#`,
 * `%` and non-ASCII folder names must be encoded per path segment, or the
 * browser decodes them and asks for a file that does not exist.
 */
export function fileUrlForPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized.split('/').map(part => encodeURIComponent(part)).join('/')
  return `file:///${encoded}`
}
