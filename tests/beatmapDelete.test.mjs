import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteBeatmapFolder } from '../src/electron/beatmapDelete.ts'

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'nericx-delete-test-'))
  const osuPath = join(root, 'osu!')
  const songsPath = join(osuPath, 'Songs')
  await mkdir(songsPath, { recursive: true })
  return { root, osuPath, songsPath }
}

/** Creates a folder that looks like an osu! beatmap and returns its audio path. */
async function makeBeatmap(songsPath, folderName) {
  const folderPath = join(songsPath, folderName)
  await mkdir(join(folderPath, 'nested'), { recursive: true })
  await writeFile(join(folderPath, 'audio.mp3'), 'fake audio bytes')
  await writeFile(join(folderPath, 'nested', 'extra.txt'), 'junk')
  return { folderPath, songPath: join(folderPath, 'audio.mp3') }
}

test('deletes the beatmap folder that holds the song', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const { folderPath, songPath } = await makeBeatmap(songsPath, '123 xi - Blue Zenith')

    const result = await deleteBeatmapFolder(songPath, osuPath)

    assert.equal(result.success, true)
    assert.equal(result.code, 'deleted')
    assert.equal(result.folderName, '123 xi - Blue Zenith')
    assert.equal(existsSync(folderPath), false)
    // Only the beatmap goes; the Songs folder itself stays.
    assert.equal(existsSync(songsPath), true)
    assert.deepEqual(await readdir(songsPath), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a beatmap folder containing non-beatmap files is still deleted', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const folderPath = join(songsPath, '999 artist - title')
    await mkdir(folderPath, { recursive: true })
    await writeFile(join(folderPath, 'video.mp4'), 'video bytes')
    await writeFile(join(folderPath, 'notes.txt'), 'notes')

    const result = await deleteBeatmapFolder(join(folderPath, 'video.mp4'), osuPath)

    assert.equal(result.success, true)
    assert.equal(existsSync(folderPath), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a song that is already gone is reported as notFound', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const result = await deleteBeatmapFolder(join(songsPath, 'missing', 'audio.mp3'), osuPath)

    assert.equal(result.success, false)
    assert.equal(result.code, 'notFound')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects an empty or non-string path', async () => {
  const { root, osuPath } = await makeWorkspace()
  try {
    for (const value of ['', null, undefined, 42, {}]) {
      const result = await deleteBeatmapFolder(value, osuPath)
      assert.equal(result.success, false)
      assert.equal(result.code, 'notFound')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses the Songs folder itself', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const result = await deleteBeatmapFolder(join(songsPath, 'audio.mp3'), osuPath)

    assert.equal(result.success, false)
    assert.equal(result.code, 'outsideSongs')
    assert.equal(existsSync(songsPath), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses a song outside the Songs folder', async () => {
  const { root, osuPath } = await makeWorkspace()
  try {
    const elsewhere = join(osuPath, 'Elsewhere')
    await mkdir(elsewhere, { recursive: true })
    await writeFile(join(elsewhere, 'audio.mp3'), 'audio')

    const result = await deleteBeatmapFolder(join(elsewhere, 'audio.mp3'), osuPath)

    assert.equal(result.success, false)
    assert.equal(result.code, 'outsideSongs')
    assert.equal(existsSync(elsewhere), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses `..` traversal out of the Songs folder', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const elsewhere = join(osuPath, 'Elsewhere')
    await mkdir(elsewhere, { recursive: true })
    const songPath = join(elsewhere, 'audio.mp3')
    await writeFile(songPath, 'audio')

    const result = await deleteBeatmapFolder(join(songsPath, '..', 'Elsewhere', 'audio.mp3'), osuPath)

    assert.equal(result.success, false)
    assert.equal(result.code, 'outsideSongs')
    assert.equal(existsSync(songPath), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses a folder nested below a beatmap folder', async () => {
  const { root, osuPath, songsPath } = await makeWorkspace()
  try {
    const { folderPath } = await makeBeatmap(songsPath, '456 artist - title')
    const nestedSong = join(folderPath, 'nested', 'extra.txt')

    const result = await deleteBeatmapFolder(nestedSong, osuPath)

    assert.equal(result.success, false)
    assert.equal(result.code, 'outsideSongs')
    assert.equal(existsSync(folderPath), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports notFound when the osu! Songs folder does not exist', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nericx-delete-test-'))
  try {
    const osuPath = join(root, 'osu!')
    await mkdir(osuPath, { recursive: true })

    const result = await deleteBeatmapFolder(join(osuPath, 'Songs', '1 a - b', 'audio.mp3'), osuPath)

    assert.equal(result.success, false)
    assert.equal(result.code, 'notFound')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
