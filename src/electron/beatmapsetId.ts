/**
 * osu! stores beatmap folders as `<beatmapsetId> <artist> - <title>`.
 * Folders that do not follow that shape (album rips, hand-made copies) must
 * not produce a beatmapset id, or the app would build a 404 cover URL and a
 * dead "Xem Beatmap" button out of a token like "Camellia".
 */
export function parseBeatmapsetId(folderName: string): string | undefined {
  const [firstToken] = folderName.split(' ')
  if (!folderName.includes(' ') || !/^\d+$/.test(firstToken)) return undefined
  return firstToken
}
