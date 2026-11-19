#!/usr/bin/env node
/**
 * Downloads and verifies the pinned upstream sources the slim ffmpeg is built
 * from, then prints the source directory to pass to `build-ffmpeg-slim.sh`.
 *
 * `build-ffmpeg-slim.sh` deliberately does no downloading: it expects
 * `FFMPEG_SRC` to point at an extracted tree. That kept the build script small
 * but left provenance to whoever ran it — the comment in it named a version, and
 * nothing proved the tarball was that version. This separates the two jobs: this
 * script fetches and verifies, the build script only builds.
 *
 * Verification is two-layered for ffmpeg because FFmpeg actually signs its
 * releases. The SHA-256 alone answers "did I get the same bytes twice"; the
 * signature answers "did the FFmpeg project publish these bytes". Both are
 * checked when gpg is installed; the hash alone when it is not, with a warning,
 * because a container without gpg should still be able to build.
 *
 * x264 publishes no signatures and `stable` is a moving branch, so it is pinned
 * by commit instead — the tarball URL names the commit and the hash is of that
 * exact artifact.
 *
 * Usage:
 *   node scripts/fetch-ffmpeg-source.mjs                # into ../nx-source
 *   node scripts/fetch-ffmpeg-source.mjs --dir /tmp/src
 *   node scripts/fetch-ffmpeg-source.mjs --reuse        # skip a present tarball
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { get } from 'node:https'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pins = JSON.parse(await readFile(join(root, 'scripts', 'pinned-sources.json'), 'utf8'))

const argValue = (flag) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const sourceDir = argValue('--dir') ?? join(root, '..', 'nx-source')
const reuse = process.argv.includes('--reuse')

const sha256 = async (filePath) =>
  createHash('sha256').update(await readFile(filePath)).digest('hex')

const sizeOf = async (filePath) =>
  stat(filePath).then(info => info.size).catch(() => 0)

/** Follows redirects; a release CDN will hand out one or two. */
const download = (url, dest, redirects = 0) =>
  new Promise((resolvePromise, reject) => {
    if (redirects > 5) {
      reject(new Error(`Too many redirects for ${url}`))
      return
    }
    get(url, { headers: { 'User-Agent': 'nericx-build' } }, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        resolvePromise(download(new URL(response.headers.location, url).href, dest, redirects + 1))
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error(`${url} returned HTTP ${status}`))
        return
      }
      const file = createWriteStream(dest)
      response.pipe(file)
      file.on('finish', () => file.close(() => resolvePromise(undefined)))
      file.on('error', reject)
      response.on('error', reject)
    }).on('error', reject)
  })

const fetchVerified = async (name, { url, sha256: expected }) => {
  const dest = join(sourceDir, basename(new URL(url).pathname))
  if (reuse && (await sizeOf(dest)) > 0) {
    console.log(`${name}: reusing ${basename(dest)}`)
  } else {
    console.log(`${name}: downloading ${url}`)
    await download(url, dest)
  }
  const actual = await sha256(dest)
  if (actual !== expected) {
    throw new Error(
      `${name}: hash mismatch for ${basename(dest)}\n` +
        `  pinned ${expected}\n  actual ${actual}\n` +
        'Refusing to build from an unverified source.'
    )
  }
  console.log(`${name}: sha256 ok (${expected.slice(0, 16)}…)`)
  return dest
}

/** Best effort: a missing gpg is a warning, a bad signature is fatal. */
const verifySignature = async (tarball, signatureUrl, keyUrl, fingerprint) => {
  const signaturePath = `${tarball}.asc`
  const keyPath = join(sourceDir, 'signing-key.asc')
  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' })
  } catch {
    console.warn('ffmpeg: gpg not installed; relying on the SHA-256 alone')
    return
  }
  try {
    await download(signatureUrl, signaturePath)
    await download(keyUrl, keyPath)
    // `--import` is idempotent; the key is re-imported on every run because a
    // fresh build directory has an empty keyring.
    execFileSync('gpg', ['--batch', '--import', keyPath], { stdio: 'ignore' })
    const output = execFileSync('gpg', ['--batch', '--status-fd', '1', '--verify', signaturePath, tarball], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    if (!output.includes('[GNUPG:] GOODSIG') || !output.includes(fingerprint)) {
      throw new Error(`unexpected signature status:\n${output}`)
    }
    console.log('ffmpeg: GPG signature ok')
  } catch (error) {
    // A signature that does not verify is as bad as a hash mismatch.
    throw new Error(`ffmpeg: signature verification failed — ${error.message}`)
  }
}

const main = async () => {
  await mkdir(sourceDir, { recursive: true })

  const ffmpegTarball = await fetchVerified('ffmpeg', pins.ffmpeg)
  await verifySignature(
    ffmpegTarball,
    pins.ffmpeg.signatureUrl,
    pins.ffmpeg.signingKeyUrl,
    pins.ffmpeg.signingKeyFingerprint
  )

  await fetchVerified('x264', pins.x264)

  // The build script reads the extracted tree, not the tarball.
  console.log(`\nExtract both archives into ${sourceDir}, then run:`)
  console.log(`  FFMPEG_SRC=${join(sourceDir, `ffmpeg-${pins.ffmpeg.version}`)} npm run build:ffmpeg`)
  console.log(`\nx264 must be built with the same toolchain and installed under /ucrt64`)
  console.log(`(see the header of scripts/build-ffmpeg-slim.sh).`)
  await writeFile(join(sourceDir, '.nericx-verified'), `${new Date().toISOString()}\n`)
}

main().catch((error) => {
  console.error(`fetch-ffmpeg-source: ${error.message}`)
  process.exitCode = 1
})
