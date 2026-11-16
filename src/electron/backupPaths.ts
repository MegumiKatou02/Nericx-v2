import path from 'path'

export const BACKUP_SECTIONS = {
  skins: 'Skins',
  songs: 'Songs',
  screenshots: 'Screenshots',
  replays: 'Replays',
  scores: path.join('data', 'r')
} as const

export type BackupSection = keyof typeof BACKUP_SECTIONS

export function validateBackupSections(value: unknown): BackupSection[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(section => typeof section !== 'string')) {
    throw new Error('Choose at least one valid backup section.')
  }

  const allowed = new Set(Object.keys(BACKUP_SECTIONS))
  const sections = [...new Set(value)] as string[]
  if (sections.some(section => !allowed.has(section))) {
    throw new Error('The backup selection contains an unsupported section.')
  }

  return sections as BackupSection[]
}

export function resolveBackupSources(osuPath: string, sections: readonly BackupSection[]) {
  if (typeof osuPath !== 'string' || !osuPath.trim()) {
    throw new Error('The osu! folder is not configured.')
  }

  const root = path.resolve(osuPath)
  return sections.map(section => {
    const relativePath = BACKUP_SECTIONS[section]
    const sourcePath = path.resolve(root, relativePath)
    const relative = path.relative(root, sourcePath)
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('The backup source resolves outside the osu! folder.')
    }
    return { section, sourcePath }
  })
}
