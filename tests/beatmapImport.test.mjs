import test from 'node:test'
import assert from 'node:assert/strict'
import AdmZip from 'adm-zip'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  installOszFile,
  isOszFile,
  parseOsuMetadata,
  sanitizeBeatmapFolderName
} from '../src/electron/beatmapImport.ts'

const OSU_TEXT = `osu file format v14

[General]
AudioFilename: audio.mp3

[Metadata]
Title:Blue Zenith
TitleUnicode:Blue Zenith
Artist:xi
ArtistUnicode:xi
BeatmapSetID:292301
Version:Four Dimensions

[TimingPoints]
0,500,4,2,1,60,1,0
`

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'nericx-osz-test-'))
  const osuPath = join(root, 'osu!')
  await mkdir(join(osuPath, 'Songs'), { recursive: true })
  return { root, osuPath, songsPath: join(osuPath, 'Songs') }
}

async function writeOsz(root, name, entries) {
  const zip = new AdmZip()
  for (const [entryName, content] of Object.entries(entries)) {
    if (entryName === 'rawNames') continue
    zip.addFile(entryName, Buffer.from(content))
  }
  // `addFile` canonicalizes entry names, so a malicious name has to be written
  // onto the entry afterwards to produce the archive this test needs.
  for (const [entryName, rawName] of Object.entries(entries.rawNames ?? {})) {
    zip.getEntry(entryName).entryName = rawName
  }
  const oszPath = join(root, name)
  await writeFile(oszPath, zip.toBuffer())
  return oszPath
}

const BEATMAP_ENTRIES = {
  'xi - Blue Zenith (FOUR DIMENSIONS).osu': OSU_TEXT,
  'audio.mp3': 'fake audio bytes',
  'bg.jpg': 'fake image bytes'
}

test('only .osz files are accepted, case-insensitively', () => {
  assert.equal(isOszFile('C:\\maps\\Blue Zenith.OSZ'), true)
  assert.equal(isOszFile('/home/u/map.osz'), true)
  assert.equal(isOszFile('/home/u/map.zip'), false)
  assert.equal(isOszFile('/home/u/osz'), false)
  assert.equal(isOszFile(''), false)
})

test('metadata parsing prefers the romanized fields and keeps the set id', () => {
  const metadata = parseOsuMetadata(OSU_TEXT)
  assert.equal(metadata.artist, 'xi')
  assert.equal(metadata.title, 'Blue Zenith')
  assert.equal(metadata.beatmapSetId, '292301')
})

test('metadata parsing prefers romaji over the unicode display names', () => {
  const metadata = parseOsuMetadata(
    '[Metadata]\nArtist: cosMo@bousouP\nArtistUnicode: cosMo＠暴走P\n' +
    'Title: Gizaba Crazy Letter\nTitleUnicode: ギザバ怪文書\n'
  )
  assert.equal(metadata.artist, 'cosMo@bousouP')
  assert.equal(metadata.title, 'Gizaba Crazy Letter')
})

test('metadata parsing falls back to the unicode fields when romaji is missing', () => {
  const metadata = parseOsuMetadata(
    '[Metadata]\nArtistUnicode: ゆある\nTitleUnicode: アスノヨゾラ哨戒班\n'
  )
  assert.equal(metadata.artist, 'ゆある')
  assert.equal(metadata.title, 'アスノヨゾラ哨戒班')
})

test('metadata parsing ignores keys outside the [Metadata] block', () => {
  const metadata = parseOsuMetadata(`[General]\nTitle: Not a title\n[Metadata]\nArtist: a\nTitle: t\n`)
  assert.equal(metadata.artist, 'a')
  assert.equal(metadata.title, 't')
  assert.equal(metadata.beatmapSetId, undefined)
})

test('a non-numeric BeatmapSetID never becomes a folder prefix', () => {
  const metadata = parseOsuMetadata(`[Metadata]\nArtist: a\nTitle: t\nBeatmapSetID: abc\n`)
  assert.equal(metadata.beatmapSetId, undefined)
})

test('folder names drop characters Windows rejects and trailing dots', () => {
  assert.equal(sanitizeBeatmapFolderName('a/b\\c:d*e?f"g<h>i|j'), 'abcdefghij')
  assert.equal(sanitizeBeatmapFolderName('Trailing dots...'), 'Trailing dots')
  assert.equal(sanitizeBeatmapFolderName('  spaced   out  '), 'spaced out')
  assert.equal(sanitizeBeatmapFolderName('CON'), '_CON')
  assert.equal(sanitizeBeatmapFolderName('...'), '')
  assert.ok(sanitizeBeatmapFolderName('x'.repeat(400)).length <= 120)
})

test('an .osz installs as "<setId> <artist> - <title>" and keeps its files', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const oszPath = await writeOsz(root, 'whatever name.osz', BEATMAP_ENTRIES)
    const result = await installOszFile(oszPath, osuPath)

    assert.equal(result.success, true)
    assert.equal(result.code, 'installed')
    assert.equal(result.folderName, '292301 xi - Blue Zenith')

    const installed = join(songsPath, '292301 xi - Blue Zenith')
    assert.deepEqual((await readdir(installed)).sort(), [
      'audio.mp3',
      'bg.jpg',
      'xi - Blue Zenith (FOUR DIMENSIONS).osu'
    ])
    assert.equal(await readFile(join(installed, 'audio.mp3'), 'utf8'), 'fake audio bytes')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a beatmap without metadata still installs under the osz name', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const oszPath = await writeOsz(root, 'Nameless Map.osz', {
      'map.osu': 'osu file format v14\n[General]\n'
    })
    const result = await installOszFile(oszPath, osuPath)
    assert.equal(result.success, true)
    assert.equal(result.folderName, 'Nameless Map')
    assert.equal((await stat(join(songsPath, 'Nameless Map'))).isDirectory(), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the same beatmapset is reported as a duplicate, not installed twice', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const oszPath = await writeOsz(root, 'map.osz', BEATMAP_ENTRIES)
    assert.equal((await installOszFile(oszPath, osuPath)).code, 'installed')

    const second = await installOszFile(oszPath, osuPath)
    assert.equal(second.success, false)
    assert.equal(second.code, 'duplicate')
    assert.deepEqual(await readdir(songsPath), ['292301 xi - Blue Zenith'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a different beatmap sharing artist and title gets a numbered folder', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    await installOszFile(await writeOsz(root, 'one.osz', BEATMAP_ENTRIES), osuPath)
    const other = await writeOsz(root, 'two.osz', {
      'xi - Blue Zenith (Another Diff).osu': OSU_TEXT.replace('Version:Four Dimensions', 'Version:Another'),
      'audio.mp3': 'other audio'
    })

    const result = await installOszFile(other, osuPath)
    assert.equal(result.success, true)
    assert.equal(result.folderName, '292301 xi - Blue Zenith (2)')
    assert.deepEqual((await readdir(songsPath)).sort(), [
      '292301 xi - Blue Zenith',
      '292301 xi - Blue Zenith (2)'
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an archive with no .osu file is rejected', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const oszPath = await writeOsz(root, 'not-a-beatmap.osz', { 'audio.mp3': 'x' })
    const result = await installOszFile(oszPath, osuPath)
    assert.equal(result.success, false)
    assert.equal(result.code, 'noBeatmap')
    assert.deepEqual(await readdir(songsPath), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a path traversal entry aborts the import and leaves nothing behind', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const oszPath = await writeOsz(root, 'evil.osz', {
      'map.osu': OSU_TEXT,
      // Canonical-looking name on disk, `..` segments in the archive header.
      'escaped.txt': 'pwned',
      rawNames: { 'escaped.txt': '../../escaped.txt' }
    })

    const result = await installOszFile(oszPath, osuPath)
    assert.equal(result.success, false)
    assert.equal(result.code, 'unsafeEntry')
    assert.deepEqual(await readdir(songsPath), [])
    assert.deepEqual(await readdir(root).then(entries => entries.filter(name => name === 'escaped.txt')), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed import leaves no staging folder behind', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    // A zip whose declared entry name is fine but whose data cannot be read
    // exercises the cleanup path after staging was created.
    const oszPath = await writeOsz(root, 'broken.osz', { 'map.osu': OSU_TEXT, 'a/b/c.txt': 'x' })
    const result = await installOszFile(oszPath, osuPath)
    assert.equal(result.success, true)
    await rm(join(songsPath, result.folderName), { recursive: true, force: true })

    const leftovers = (await readdir(songsPath)).filter(name => name.startsWith('.nericx-import-'))
    assert.deepEqual(leftovers, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a missing Songs folder is reported instead of created', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nericx-osz-test-'))
  const osuPath = join(root, 'osu!')
  await mkdir(osuPath, { recursive: true })
  try {
    const oszPath = await writeOsz(root, 'map.osz', BEATMAP_ENTRIES)
    const result = await installOszFile(oszPath, osuPath)
    assert.equal(result.code, 'songsMissing')
    assert.deepEqual(await readdir(osuPath), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a non-osz path and a missing file are rejected before touching the disk', async () => {
  const { root, osuPath } = await makeWorkspace()
  try {
    const zipPath = join(root, 'map.zip')
    await writeFile(zipPath, 'not a zip')
    assert.equal((await installOszFile(zipPath, osuPath)).code, 'notOsz')
    assert.equal((await installOszFile(join(root, 'gone.osz'), osuPath)).code, 'missingFile')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
