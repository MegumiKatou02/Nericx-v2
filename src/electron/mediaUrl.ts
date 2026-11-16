/**
 * Song files live outside the app bundle, and a renderer with `webSecurity`
 * on is not allowed to load `file://` subresources. The main process therefore
 * serves them under `nericx-media://local/<encoded path>`. This module holds
 * both halves of that contract (the scheme and the path parser) so the
 * renderer's URL builder in `src/ui/fileUrl.ts` and the handler agree.
 */
export const MEDIA_SCHEME = 'nericx-media'
export const MEDIA_HOST = 'local'

/**
 * Turns the encoded pathname of a media URL back into a native file path.
 * Returns `null` for anything that is not a media URL, including malformed
 * percent escapes and URLs for another host.
 */
export function mediaPathFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== MEDIA_HOST) {
    return null
  }

  let pathname: string
  try {
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }

  if (!pathname || pathname === '/') return null
  // The URL path always starts with a separator. On Windows the drive letter
  // follows it (`/C:/...`) and the separator is not part of the path; on
  // POSIX it is.
  return /^\/[a-zA-Z]:[\\/]/.test(pathname) ? pathname.slice(1) : pathname
}
