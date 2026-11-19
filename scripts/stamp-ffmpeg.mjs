#!/usr/bin/env node
/**
 * Stamps PE version information onto the bundled ffmpeg binary.
 *
 * The slim build comes out of MSYS2's linker with *no* version resource at all:
 * no FileDescription, CompanyName, ProductName or FileVersion. That is the
 * shape heuristic antivirus scanners associate with dropped payloads, so an
 * unsigned 24 MB binary that a desktop app then spawns looks worse than it is.
 * Filling the version resource does not make the binary trusted, but it removes
 * one of the cheapest reasons to flag it, and it makes the file identifiable in
 * a false-positive report.
 *
 * rcedit is not a new dependency: electron-builder ships it behind
 * `app-builder rcedit`, the same path electron-builder uses for the Electron
 * executable. Reusing it keeps the stamp and the rest of the build on one
 * toolchain.
 *
 * Two properties matter more than the field values:
 *
 *   Idempotent  — a second run on an already-stamped binary changes nothing, so
 *                 the shipped hash stays stable across rebuilds and CI can
 *                 compare it against the committed `.sha256`. Re-stamping would
 *                 rewrite the resource section and yield a different file every
 *                 time.
 *   Reversible  — the binary is copied aside first and probed with `-version`
 *                 after the stamp; a binary that no longer runs is restored from
 *                 the copy and the build fails. This is a 24 MB artifact users
 *                 download and the app cannot re-fetch it.
 *
 * The icon is deliberately not set: `--set-icon` is the rcedit operation most
 * likely to disturb the resource section of a static MinGW-linked PE, and an
 * icon buys nothing here.
 *
 * Usage:
 *   node scripts/stamp-ffmpeg.mjs                       # current platform/arch
 *   node scripts/stamp-ffmpeg.mjs --platform win32 --arch x64
 *   node scripts/stamp-ffmpeg.mjs --check               # report only, never write
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFile, readFile, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const argValue = (flag) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const platform = argValue('--platform') ?? process.platform
const arch = argValue('--arch') ?? process.arch
const checkOnly = process.argv.includes('--check')

const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const targetPath = join(root, 'resources', 'ffmpeg', `${platform}-${arch}`, binaryName)

/**
 * The identity fields are read from the repository rather than hard-coded here.
 *
 * electron-builder fills the application executable's CompanyName from
 * `author.name` and its ProductName from `productName`. Writing different values
 * into ffmpeg would ship one installer whose two executables claim different
 * publishers — precisely the inconsistency a scanner scores against, and a
 * question a false-positive reviewer would ask. One source for both means they
 * cannot drift.
 */
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const pins = JSON.parse(await readFile(join(root, 'scripts', 'pinned-sources.json'), 'utf8'))

const companyName = typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name ?? pkg.productName)
const productName = `${pkg.name ? pkg.name[0].toUpperCase() + pkg.name.slice(1) : 'Nericx'} FFmpeg`
const ffmpegVersion = `${pins.ffmpeg.version}.0`

/**
 * Written into the resource section. `LegalCopyright` keeps the upstream
 * attribution: this is a modified FFmpeg build, and claiming sole copyright
 * would be both wrong and a weaker story in a false-positive report.
 */
const STRINGS = {
  FileDescription: 'FFmpeg command-line converter (slim build)',
  ProductName: productName,
  CompanyName: companyName,
  InternalName: 'ffmpeg',
  OriginalFilename: binaryName,
  Comments: 'https://github.com/MegumiKatou02/Nericx-Player',
  LegalCopyright:
    'FFmpeg is Copyright (c) 2000-2025 the FFmpeg developers. Slim build by Nericx.'
}
const FILE_VERSION = ffmpegVersion
const PRODUCT_VERSION = ffmpegVersion

const rceditArgs = (filePath) => {
  const args = [filePath]
  for (const [name, value] of Object.entries(STRINGS)) {
    args.push('--set-version-string', name, value)
  }
  args.push('--set-file-version', FILE_VERSION)
  args.push('--set-product-version', PRODUCT_VERSION)
  return args
}

/** Reads a PE file's version resource through Windows' own parser. */
const readVersionInfo = (filePath) => {
  if (platform !== 'win32') return null
  // A one-line expression rather than a .ps1 file: an execution policy that
  // blocks scripts must not block the build.
  const expression =
    `$v=(Get-Item -LiteralPath '${filePath.replace(/'/g, "''")}').VersionInfo;` +
    'ConvertTo-Json -Compress -InputObject ([ordered]@{' +
    'FileDescription=$v.FileDescription;ProductName=$v.ProductName;' +
    'CompanyName=$v.CompanyName;FileVersion=$v.FileVersion;' +
    'LegalCopyright=$v.LegalCopyright})'
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', expression], {
      encoding: 'utf8',
      windowsHide: true
    })
    return JSON.parse(out)
  } catch {
    return null
  }
}

/**
 * Compares the resource with what this script would write, not merely "is a
 * description present". A binary stamped before `author` changed would otherwise
 * keep the old CompanyName forever, which is the drift the shared identity was
 * meant to prevent.
 */
const isCurrent = (info) =>
  info != null &&
  typeof info.FileDescription === 'string' &&
  info.FileDescription === STRINGS.FileDescription &&
  info.CompanyName === STRINGS.CompanyName &&
  info.ProductName === STRINGS.ProductName &&
  info.LegalCopyright === STRINGS.LegalCopyright &&
  info.FileVersion === FILE_VERSION

/** Runs the binary and requires the ffmpeg banner, so a broken PE is caught here. */
const runsAsFfmpeg = (filePath) => {
  try {
    const out = execFileSync(filePath, ['-hide_banner', '-version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000
    })
    return /^ffmpeg version /m.test(out)
  } catch {
    return false
  }
}

const restore = async (backupPath) => {
  await rm(targetPath, { force: true })
  await copyFile(backupPath, targetPath)
}

const main = async () => {
  const size = await stat(targetPath).then(info => info.size).catch(() => 0)
  if (size === 0) {
    console.error(
      `No ffmpeg at ${targetPath}.\n` +
        'Run `npm run build:ffmpeg` (or `npm run fetch:ffmpeg:fallback`) first.'
    )
    process.exitCode = 1
    return
  }

  // Only the Windows PE carries the resource section this stamp writes, and the
  // Windows build is what scanners flag.
  if (platform !== 'win32') {
    console.log(`stamp-ffmpeg: nothing to do for ${platform}-${arch}`)
    return
  }

  const before = readVersionInfo(targetPath)
  if (isCurrent(before)) {
    console.log(`ffmpeg already stamped: ${before.FileDescription}`)
    return
  }
  if (checkOnly) {
    console.error('ffmpeg is not stamped with the current identity; run without --check')
    process.exitCode = 1
    return
  }

  const backupPath = `${targetPath}.stamp-backup`
  await copyFile(targetPath, backupPath)
  console.log(`stamp-ffmpeg: backing up ${binaryName} -> ${binaryName}.stamp-backup`)

  const { appBuilderPath } = require('app-builder-bin')
  try {
    execFileSync(appBuilderPath, ['rcedit', '--args', JSON.stringify(rceditArgs(targetPath))], {
      encoding: 'utf8',
      windowsHide: true
    })
  } catch (error) {
    await restore(backupPath)
    await rm(backupPath, { force: true })
    console.error(`stamp-ffmpeg: rcedit failed, binary restored.\n${error.message ?? error}`)
    process.exitCode = 1
    return
  }

  if (!runsAsFfmpeg(targetPath)) {
    await restore(backupPath)
    await rm(backupPath, { force: true })
    console.error('stamp-ffmpeg: the stamped binary no longer runs; binary restored.')
    process.exitCode = 1
    return
  }

  const after = readVersionInfo(targetPath)
  if (!isCurrent(after)) {
    await restore(backupPath)
    await rm(backupPath, { force: true })
    console.error('stamp-ffmpeg: rcedit reported success but the resource does not match; restored')
    process.exitCode = 1
    return
  }

  await rm(backupPath, { force: true })
  console.log('stamp-ffmpeg: stamped')
  for (const [key, value] of Object.entries(after)) console.log(`  ${key.padEnd(18)} ${value}`)
}

main().catch((error) => {
  console.error(`stamp-ffmpeg: ${error.message}`)
  process.exitCode = 1
})
