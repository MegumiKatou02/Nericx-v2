import { protocol } from 'electron'
import { createReadStream } from 'fs'
import { realpath, stat } from 'fs/promises'
import { extname, isAbsolute, relative, sep } from 'path'
import { Readable } from 'stream'
import { getOsuPath } from './util.js'
import { MEDIA_SCHEME, mediaPathFromUrl } from './mediaUrl.js'
import { parseByteRange } from './mediaRange.js'

/**
 * Privileges have to be declared before the app is ready. `standard` makes the
 * URL parse like a normal origin, `secure` keeps it usable from the dev http
 * page, and `stream` lets audio and video seek instead of buffering the file
 * in one go.
 */
export const registerMediaScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        // The renderer runs on another origin (its dev server, or file:// when
        // packaged), and the audio element needs a CORS-approved response for
        // the Web Audio graph to read its samples instead of outputting zeroes.
        corsEnabled: true
      }
    }
  ])
}

const notFound = () => new Response('Not found', { status: 404 })
const forbidden = () => new Response('Forbidden', { status: 403 })

const corsHeaders = () => ({
  // The page origin is never the media scheme, so every media request is
  // cross-origin. `*` is enough because the element asks without credentials.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
})

/**
 * Media elements sniff, but some formats (notably mp4/flac) need the real
 * type before they will play, so the extension is mapped instead of left as
 * `application/octet-stream`. Unknown files (`.osu`, `.osb`, videos) still
 * stream; the element decides whether it can decode them.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
}

const contentTypeFor = (filePath: string): string =>
  CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'

/** Streams `start..end` (inclusive) as a web stream, without buffering it. */
const streamRange = (filePath: string, start: number, end: number): ReadableStream =>
  Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream

/**
 * Serves only files inside the configured osu! folder. The renderer is the
 * only caller, but folder names come from disk and end up in the URL, so the
 * handler resolves both paths and checks containment instead of trusting the
 * decoded path.
 *
 * Responses are built here rather than forwarded from `net.fetch(file:)`:
 * that path returns `200 OK` with the range's bytes but without
 * `Content-Range` or `Accept-Ranges`, which makes the media element treat the
 * file as unseekable and restart playback whenever the user drags the bar.
 */
export const handleMediaRequests = () => {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...corsHeaders(), Allow: 'GET, HEAD, OPTIONS' }
      })
    }

    const requestedPath = mediaPathFromUrl(request.url)
    if (!requestedPath) return notFound()

    try {
      const osuPath = await getOsuPath()
      if (!osuPath) return notFound()

      const canonicalOsuPath = await realpath(osuPath)
      const canonicalPath = await realpath(requestedPath)
      const relativePath = relative(canonicalOsuPath, canonicalPath)
      if (
        !relativePath ||
        relativePath === '..' ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
      ) {
        return forbidden()
      }

      const file = await stat(canonicalPath)
      if (!file.isFile()) return notFound()

      const size = file.size
      const noBody = request.method === 'HEAD'
      const baseHeaders = {
        ...corsHeaders(),
        'Accept-Ranges': 'bytes',
        'Content-Type': contentTypeFor(canonicalPath)
      }
      const range = parseByteRange(request.headers.get('range'), size)

      if (range === 'unsatisfiable') {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` }
        })
      }

      if (range === null) {
        const body = noBody || size === 0 ? null : streamRange(canonicalPath, 0, size - 1)
        return new Response(body, {
          status: 200,
          headers: { ...baseHeaders, 'Content-Length': String(size) }
        })
      }

      return new Response(noBody ? null : streamRange(canonicalPath, range.start, range.end), {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Content-Length': String(range.end - range.start + 1)
        }
      })
    } catch {
      // A missing file, an unreadable folder or an unset osu! path all end up
      // here; the media element only needs a failed response to show its error.
      return notFound()
    }
  })
}
