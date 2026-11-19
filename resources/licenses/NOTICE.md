# Third-party notices

Nericx itself is MIT-licensed (see `LICENSE` at the repository root). It bundles
one third-party executable, and that executable is not MIT.

## FFmpeg — GNU GPL v3

`resources/ffmpeg/win32-x64/ffmpeg.exe` (installed as
`<install dir>/resources/ffmpeg/win32-x64/ffmpeg.exe`) is a **custom build of
FFmpeg 7.1.1**, built by this project from upstream source with:

```
--enable-gpl --enable-libx264 --enable-static --disable-shared
--disable-everything --disable-network ...
```

Because it is configured with `--enable-gpl` and links **libx264**, the binary is
distributed under the **GNU General Public License, version 3**. The full text is
in `FFMPEG-COPYING.GPLv3.txt` beside this file.

FFmpeg is Copyright (c) 2000-2025 the FFmpeg developers. Upstream:
<https://ffmpeg.org/>

### Source code offer

The corresponding source for the shipped binary is:

- FFmpeg 7.1.1 — <https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.xz>
  SHA-256 `733984395e0dbbe5c046abda2dc49a5544e7e0e1e2366bba849222ae9e3a03b1`
- x264, commit `b35605ace3ddf7c1a5d67a2eb553f034aef41d55` —
  <https://code.videolan.org/videolan/x264>
  tarball SHA-256 `6eeb82934e69fd51e043bd8c5b0d152839638d1ce7aa4eea65a3fedcf83ff224`

A source archive containing exactly these files, together with the build scripts
(`scripts/build-ffmpeg-slim.sh`, `scripts/fetch-ffmpeg-source.mjs`,
`scripts/pinned-sources.json`), is published alongside every release. The build
is also reproducible from the repository:
<https://github.com/MegumiKatou02/Nericx-Player>

### What the binary is modified from upstream

- `libavcodec/Makefile` is patched to link `aom_film_grain.o` into the H.264 SEI
  object list; without it a `--disable-everything` link fails. The patch is
  applied by `scripts/build-ffmpeg-slim.sh` and is a two-line Makefile change.
- Everything else is the upstream 7.1.1 source compiled with the configure line
  in that script.

### How Nericx uses it

FFmpeg is a **separate process**, spawned by the app to convert a beatmap video
container Chromium cannot demux (`.avi`, most `.mkv`) into an mp4. It is not
linked into the app and it communicates only over a pipe. The app ships no
FFmpeg code inside its own binaries.

## x264 — GNU GPL v2

`libx264` is compiled into the FFmpeg binary above. Its license text is in
`X264-COPYING.txt` beside this file. x264 is Copyright (c) 2003-2025 the x264
developers; upstream <https://www.videolan.org/developers/x264.html>.

## Other dependencies

The application's JavaScript dependencies and their licenses are listed in
`package-lock.json`; each package carries its own `LICENSE` in `node_modules`.
They are not distributed as standalone files in the installer.
