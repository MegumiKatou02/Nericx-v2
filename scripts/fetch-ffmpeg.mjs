#!/usr/bin/env node
/**
 * Makes sure the ffmpeg the app ships with is in place.
 *
 * The app ships a *custom, slim* build (~24 MB) rather than a general-purpose
 * one (~100 MB): it only ever converts beatmap videos Chromium cannot demux, so
 * it carries only the demuxers, the mp4 muxer, the decoders those containers
 * need and the libx264/aac encoders. `scripts/build-ffmpeg-slim.sh` produces it
 * from sources that `scripts/fetch-ffmpeg-source.mjs` fetches and verifies.
 *
 * The binary is not committed, so a fresh clone either builds it or drops one
 * in by hand. Only when neither has happened does this script offer a
 * general-purpose build as an explicit opt-in, because downloading 100 MB of
 * codecs the app will never call is the thing the slim build exists to avoid.
 *
 * Verification is a hash comparison against `resources/ffmpeg/<platform>-<arch>/
 * ffmpeg.sha256`, which pins the *stamped* binary — the file that actually
 * ships. This script used to claim it verified while only checking that a file
 * existed, and the README repeated that claim; both are wrong to say without
 * this check. The check is skipped only when no hash has been recorded yet, and
 * then it says so.
 *
 * Usage:
 *   node scripts/fetch-ffmpeg.mjs              # verify, or explain what to do
 *   node scripts/fetch-ffmpeg.mjs --fallback   # download a prebuilt build if
 *                                              # no local binary exists
 *   node scripts/fetch-ffmpeg.mjs --force      # with --fallback: re-download
 *   node scripts/fetch-ffmpeg.mjs --optional   # warn instead of failing when
 *                                              # the platform has no source
 *
 * Only Windows x64 has a fallback download. Other targets expect the binary at
 * `resources/ffmpeg/<platform>-<arch>/ffmpeg`; the script says so and exits
 * non-zero for them.
 */
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get } from 'node:https'
import AdmZip from 'adm-zip'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argValue = (flag) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const platform = argValue('--platform') ?? process.platform
const arch = argValue('--arch') ?? process.arch
const force = process.argv.includes('--force')
const optional = process.argv.includes('--optional')
const fallback = process.argv.includes('--fallback')

const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const targetDir = join(root, 'resources', 'ffmpeg', `${platform}-${arch}`)
const targetPath = join(targetDir, binaryName)
const hashPath = `${targetPath}.sha256`

/**
 * Gyan's "essentials" build. Not what the app wants — it is ~100 MB and most
 * of that is codecs nothing here calls — but it is a real, working ffmpeg that
 * can be fetched without a compiler, so it keeps `--fallback` honest.
 *
 * The vendor publishes a checksum beside the archive, and it is used: an
 * unverified 100 MB executable is the last thing this project should hand a
 * user, and a fallback build that nobody could point at as "the same bytes the
 * vendor published" was previously indistinguishable from anything else.
 */
const WINDOWS_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
const WINDOWS_SUM_URL = `${WINDOWS_URL}.sha256`

const sha256 = async (filePath) =>
  createHash('sha256').update(await readFile(filePath)).digest('hex')

const sizeOf = async (filePath) => {
  try {
    const info = await stat(filePath)
    return info.isFile() && info.size > 0 ? info.size : 0
  } catch {
    return 0
  }
}

const download = (url, destination, redirectsLeft = 5) => new Promise((resolvePromise, rejectPromise) => {
  const request = get(url, { headers: { 'User-Agent': 'nericx-build' } }, (response) => {
    const status = response.statusCode ?? 0
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume()
      if (redirectsLeft <= 0) {
        rejectPromise(new Error(`Too many redirects for ${url}`))
        return
      }
      const next = new URL(response.headers.location, url).toString()
      download(next, destination, redirectsLeft - 1).then(resolvePromise, rejectPromise)
      return
    }
    if (status !== 200) {
      response.resume()
      rejectPromise(new Error(`HTTP ${status} for ${url}`))
      return
    }

    const output = createWriteStream(destination, { flags: 'wx' })
    response.pipe(output)
    output.once('error', rejectPromise)
    output.once('finish', () => output.close(() => resolvePromise()))
  })
  request.once('error', rejectPromise)
  request.setTimeout(120_000, () => request.destroy(new Error('Download timed out')))
})

const fetchWindows = async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'nericx-ffmpeg-'))
  try {
    const archivePath = join(workDir, 'ffmpeg.zip')
    console.log(`Downloading ${WINDOWS_URL}`)
    await download(WINDOWS_URL, archivePath)

    // The vendor publishes the archive's checksum next to it. Checking it here
    // means a tampered or truncated download never reaches resources/.
    const sumPath = join(workDir, 'ffmpeg.zip.sha256')
    console.log(`Downloading ${WINDOWS_SUM_URL}`)
    await download(WINDOWS_SUM_URL, sumPath)
    const published = (await readFile(sumPath, 'utf8')).trim().split(/\s+/)[0] ?? ''
    const actual = await sha256(archivePath)
    if (!/^[0-9a-f]{64}$/i.test(published) || published.toLowerCase() !== actual) {
      throw new Error(
        `ffmpeg archive does not match the vendor checksum\n` +
          `  published ${published || '(none)'}\n  actual    ${actual}`
      )
    }
    console.log(`archive checksum ok (${actual.slice(0, 16)}…)`)

    console.log('Extracting ffmpeg.exe')
    const entries = new AdmZip(archivePath).getEntries()
    // The archive wraps everything in `ffmpeg-<version>-essentials_build/`.
    const binary = entries.find(entry => /(^|\/)bin\/ffmpeg\.exe$/i.test(entry.entryName))
    if (!binary) throw new Error('ffmpeg.exe not found in the archive')

    const extractedPath = join(workDir, 'ffmpeg.exe')
    const bytes = binary.getData()
    if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
      throw new Error('The download is not a Windows executable')
    }
    await writeFile(extractedPath, bytes)
    await mkdir(targetDir, { recursive: true })
    // The temp folder can be on another drive than the project, where a rename
    // across volumes fails; a copy into place is what makes it reliable.
    await copyFile(extractedPath, targetPath)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

/**
 * Compares the binary with the recorded hash, if one exists.
 *
 * A missing hash is not a failure: a fresh clone that just built the binary has
 * nothing to compare against yet, and `verify-ffmpeg.mjs --update` is how that
 * hash gets recorded. Saying nothing would be worse — the whole point of this
 * script is to answer "is this the binary we meant to ship?".
 */
const checkRecordedHash = async () => {
  const expected = await readFile(hashPath, 'utf8').then(
    (text) => text.trim().split(/\s+/)[0] ?? '',
    () => ''
  )
  if (!/^[0-9a-f]{64}$/i.test(expected)) {
    console.warn(
      `No hash recorded at ${basename(hashPath)}; cannot verify this binary.\n` +
        'Record the one you intend to ship with: node scripts/verify-ffmpeg.mjs --update'
    )
    return true
  }
  const actual = await sha256(targetPath)
  if (actual === expected) {
    console.log(`ffmpeg hash matches (${expected.slice(0, 16)}…)`)
    return true
  }
  console.error(
    `ffmpeg does not match the recorded hash\n  recorded ${expected}\n  actual   ${actual}`
  )
  return false
}

const main = async () => {
  const existing = await sizeOf(targetPath)
  if (existing > 0 && !force) {
    const mb = (existing / 1024 / 1024).toFixed(1)
    console.log(`ffmpeg already present (${mb} MB): ${targetPath}`)
    if (existing > 40 * 1024 * 1024 && platform === 'win32' && arch === 'x64') {
      console.warn(
        'This is not the slim build; it carries codecs the app never calls.\n' +
        'Run `npm run build:ffmpeg` to replace it with the ~24 MB one.'
      )
    }
    if (!(await checkRecordedHash())) {
      if (!optional) process.exitCode = 1
    }
    return
  }

  if (platform === 'win32' && arch === 'x64' && fallback) {
    await fetchWindows()
    console.log(`ffmpeg ready: ${targetPath}`)
    return
  }

  const how = platform === 'win32' && arch === 'x64'
    ? 'Run `npm run build:ffmpeg` (needs MSYS2 + x264; see scripts/build-ffmpeg-slim.sh),\n' +
      'or pass --fallback to download a general-purpose build instead.'
    : `Put a slim ${binaryName} build at ${targetPath} before packaging.`
  console.error(`No ffmpeg at ${targetPath}.\n${how}`)
  if (!optional) process.exitCode = 1
}

main().catch((error) => {
  console.error(`Could not fetch ffmpeg: ${error.message}`)
  process.exitCode = 1
})
