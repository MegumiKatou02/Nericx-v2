The app bundles ffmpeg so it can convert beatmap videos Chromium cannot
demux (.avi, most .mkv) into mp4.

It ships a **slim, purpose-built** ffmpeg (~24 MB), not a general-purpose
one (~100 MB): Chromium does all the decoding and playback, so ffmpeg only
needs the demuxers for the containers beatmaps use, the mp4 muxer, decoders
for the codecs mp4 cannot carry, and the libx264/aac encoders.

The binary is not committed. Either:

    node scripts/fetch-ffmpeg-source.mjs   # fetch + verify the pinned sources
    npm run build:ffmpeg                   # builds the slim binary (needs MSYS2 + x264)
    node scripts/stamp-ffmpeg.mjs          # writes the PE version resource
    node scripts/verify-ffmpeg.mjs --update

    npm run fetch:ffmpeg:fallback   # downloads a prebuilt general-purpose one

`npm run fetch:ffmpeg` only checks that a binary is in place and that it
matches the recorded hash in `<binary>.sha256`; it never downloads the slim
build itself.

The stamp step matters: a raw MSYS2 build has an *empty* version resource,
which is one of the cheapest reasons a scanner flags an unsigned binary. The
recorded hash is of the stamped file — the one that ships — so re-stamp
before re-recording it.

Either way it lands at `resources/ffmpeg/<platform>-<arch>/ffmpeg(.exe)`,
which both development and electron-builder read from (`extraResources` in
electron-builder.json copies it to the packaged app's resources folder,
outside the asar archive — a child process cannot be spawned from inside
one).

Only Windows x64 has a build script and a fallback download. For other
targets, place a build there by hand before packaging.
