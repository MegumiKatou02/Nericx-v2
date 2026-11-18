/**
 * Picking the video file of a beatmap folder.
 *
 * osu! maps ship `.mp4` almost exclusively, but old maps (and hand-made packs)
 * use `.avi` (DivX/Xvid) and `.mkv`. Chromium — which Electron renders with —
 * only has demuxers for MP4, WebM and Ogg, so an `.avi`/`.mkv` can be indexed
 * but will usually fail to play. That is still the right default: the file is
 * reported as the beatmap's video, and the player falls back to the cover art
 * when the element cannot decode it (see `videoPlayability` in the renderer).
 *
 * Kept free of Electron and `fs` so it can be unit-tested with `node --test`.
 */

/** Ordered by how likely Chromium is to play the container. */
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.m4v',
  '.webm',
  '.ogv',
  '.mov',
  '.mkv',
  '.avi'
] as const

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Returns the file name to treat as the beatmap's video, or `undefined`.
 *
 * A playable container always wins over an unplayable one, even when the other
 * file has a nicer name: a folder holding both `video.avi` and `bg.mp4` should
 * play the MP4. Within one container, a file named like the beatmap's video is
 * preferred, then the first in directory order.
 */
export function findVideoFile(entries: readonly string[]): string | undefined {
  let best: { name: string; rank: number } | undefined

  for (const name of entries) {
    const extension = extensionOf(name)
    const index = VIDEO_EXTENSIONS.indexOf(extension as (typeof VIDEO_EXTENSIONS)[number])
    if (index < 0) continue

    const isNamedLikeVideo = /video|background|^bg\b/i.test(name) ? 0 : 1
    const rank = index * 2 + isNamedLikeVideo
    if (!best || rank < best.rank) best = { name, rank }
  }

  return best?.name
}
