/**
 * The rendered video must belong to the track that is actually playing. The
 * component used to render whatever the *selected* song had, so merely
 * browsing the list started a `<video autoplay muted loop>` for a track nobody
 * was listening to and kept its decoder busy.
 */

export interface VideoSourceSong {
  path: string
  video?: string
}

export interface VideoSourceInput {
  videoEnabled: boolean
  current: VideoSourceSong | null
  selected: VideoSourceSong | null
  isPlaying: boolean
}

/**
 * Returns the `file://` url of the video to render, or `null` when no video
 * should be rendered at all. Tracks are matched by `path`: the same file can
 * arrive as a different object, so object identity is not reliable here.
 */
export function videoUrlFor({ videoEnabled, current, selected, isPlaying }: VideoSourceInput): string | null {
  if (!videoEnabled) return null
  if (!isPlaying) return null
  if (!current?.video) return null
  // Nothing selected means the player is following the playing track.
  if (selected !== null && selected.path !== current.path) return null
  return 'file://' + current.video
}
