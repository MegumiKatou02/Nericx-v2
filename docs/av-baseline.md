# Antivirus baseline

A record of what each release looked like to scanners, so a change that reduces
false positives can be told apart from a change that only moved the hash.

The scan itself is manual — VirusTotal has no public upload API — so this file is
filled in by running the commands below and pasting the result. Keep the section
for an old release verbatim; a new section goes on top.

## How to measure a release

1. Build or download the release artifact.
2. Hash the three files scanners actually see:

   ```powershell
   Get-ChildItem dist\*.msi, dist\win-unpacked\Nericx.exe,
     dist\win-unpacked\resources\ffmpeg\win32-x64\ffmpeg.exe |
     ForEach-Object {
       "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
     }
   ```

3. Upload each file at <https://www.virustotal.com/gui/home/upload> and record:
   - how many engines flagged it, out of the total
   - the detection names (they say which family a heuristic maps to)
   - whether Microsoft specifically flags it, since Defender and SmartScreen are
     what most users hit
4. Note the signature state of the executable (`NotSigned` until a certificate is
   configured):

   ```powershell
   Get-AuthenticodeSignature dist\win-unpacked\Nericx.exe |
     Select-Object Status, StatusMessage
   ```

## 2.0.0 (unsigned, MSI only)

Recorded 2026-11-19. Built locally with `npm run dist:win`; the same commit also
builds this artifact in CI on a `v*` tag.

| File | SHA-256 |
|---|---|
| `Nericx-2.0.0-x64.msi` | `8a1bbeb786abb814faebdaa96075ea811af74ece4852e4d8abe8efd783534026` |
| `Nericx.exe` | `8e0ecda7f3848f98c5377c30082f6eb2fd2655a50261cc637dbbed528c981fd9` |
| `ffmpeg.exe` | `fb3b306a3bb67bd11887c1d0fa6d512c69880fa8082b1915d19b3f0b055170a8` |

Signature: `NotSigned` for both executables.

These are the hashes of the locally built artifact. A release built by the
workflow will differ (a different machine builds the MSI, and a rebuild of the
ffmpeg is not byte-reproducible across toolchains), so re-hash the downloaded
files before comparing the scan results.

| File | Engines flagging | Notable detections | Microsoft |
|---|---|---|---|
| `Nericx-2.0.0-x64.msi` | _(fill in)_ | | |
| `Nericx.exe` | _(fill in)_ | | |
| `ffmpeg.exe` | _(fill in)_ | | |

What this release changed, for comparison against the previous build:

- the bundled `ffmpeg.exe` now carries a full version resource (previously
  completely empty) and names the same CompanyName as `Nericx.exe`
- the portable target is gone; the MSI installs under Program Files
- DevTools and their keyboard shortcuts are compiled out of the release build
- a transcode or probe child process no longer outlives the app
- the music metadata cache moved from `%TEMP%` to the app's own data directory
- a GPL notice for the bundled FFmpeg ships next to the binary
