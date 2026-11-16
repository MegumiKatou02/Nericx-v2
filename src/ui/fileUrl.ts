/**
 * Songs live on disk, and the renderer runs with `webSecurity` on, so a plain
 * `file://` source is rejected before the browser even opens it. The main
 * process serves those files under its own scheme instead (see
 * `src/electron/mediaProtocol.ts`), which keeps the renderer hardened.
 *
 * The path still needs per-segment encoding: spaces, `#`, `%` and non-ASCII
 * folder names would otherwise be decoded into a different file name.
 */
const MEDIA_SCHEME = 'nericx-media'
const MEDIA_HOST = 'local'

export function fileUrlForPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized.split('/').map(part => encodeURIComponent(part)).join('/')
  return `${MEDIA_SCHEME}://${MEDIA_HOST}${encoded.startsWith('/') ? encoded : `/${encoded}`}`
}
