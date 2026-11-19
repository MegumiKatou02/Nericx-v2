#!/usr/bin/env node
/**
 * Pins the exact ffmpeg binary the installer ships.
 *
 * The slim ffmpeg is git-ignored (24 MB, rebuilt locally), so without a recorded
 * hash nothing connects "the script that builds it" to "the binary in the
 * release". That gap is what makes a false-positive report weak: a reviewer
 * asked "what is this executable?" has no answer beyond a build script that, in
 * the version that shipped the current binary, did not even reproduce it.
 *
 * The hash here is of the *stamped* binary — the one that lands in the package,
 * which differs from a raw MSYS2 build because `stamp-ffmpeg.mjs` writes a
 * version resource into it. Committing the pre-stamp hash would be useless:
 * nothing ships that file.
 *
 * Usage:
 *   node scripts/verify-ffmpeg.mjs               # verify, exit 1 on mismatch
 *   node scripts/verify-ffmpeg.mjs --update      # write the hash (bootstrap)
 *   node scripts/verify-ffmpeg.mjs --platform win32 --arch x64
 */
import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const argValue = (flag) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const platform = argValue('--platform') ?? process.platform
const arch = argValue('--arch') ?? process.arch
const update = process.argv.includes('--update')

const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const binaryPath = join(root, 'resources', 'ffmpeg', `${platform}-${arch}`, binaryName)
const hashPath = `${binaryPath}.sha256`

const sha256 = async (filePath) =>
  createHash('sha256').update(await readFile(filePath)).digest('hex')

/** `sha256sum`'s own format, so `sha256sum -c` and PowerShell users both read it. */
const formatLine = (hex) => `${hex}  ${basename(binaryPath)}\n`

const main = async () => {
  const size = await stat(binaryPath).then(info => info.size).catch(() => 0)
  if (size === 0) {
    console.error(
      `No ffmpeg at ${binaryPath}.\n` +
        'Run `npm run build:ffmpeg` (or `npm run fetch:ffmpeg:fallback`) first.'
    )
    process.exitCode = 1
    return
  }

  const actual = await sha256(binaryPath)
  const expected = await readFile(hashPath, 'utf8').then(
    (text) => text.trim().split(/\s+/)[0] ?? null,
    () => null
  )

  if (expected == null) {
    if (update) {
      await writeFile(hashPath, formatLine(actual))
      console.log(`verify-ffmpeg: recorded ${actual}`)
      console.log(`  -> ${hashPath}`)
      return
    }
    console.error(
      `No hash recorded for ${binaryName} (expected ${hashPath}).\n` +
        'If this binary was just built and stamped on purpose, record it:\n' +
        '  node scripts/verify-ffmpeg.mjs --update\n' +
        'and commit the .sha256 file alongside the release.'
    )
    process.exitCode = 1
    return
  }

  if (actual === expected) {
    console.log(`verify-ffmpeg: ${binaryName} matches ${expected.slice(0, 16)}…`)
    return
  }

  if (update) {
    await writeFile(hashPath, formatLine(actual))
    console.log(`verify-ffmpeg: updated ${expected.slice(0, 16)}… -> ${actual.slice(0, 16)}…`)
    return
  }

  console.error(
    `verify-ffmpeg: ${binaryName} does not match the recorded hash.\n` +
      `  recorded ${expected}\n` +
      `  actual   ${actual}\n\n` +
      'The binary in resources/ is not the one this release is supposed to\n' +
      'ship. Either restore it from the release artifact, rebuild it with a\n' +
      'pinned toolchain (`npm run build:ffmpeg`), or — if the change is\n' +
      'intentional — re-record with --update and review the diff.'
  )
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`verify-ffmpeg: ${error.message}`)
  process.exitCode = 1
})
