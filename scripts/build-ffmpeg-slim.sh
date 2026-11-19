#!/usr/bin/env bash
#
# Builds the slim ffmpeg the app ships with, and installs it at
# `resources/ffmpeg/win32-x64/ffmpeg.exe`.
#
# The app never decodes or plays video itself: Chromium does. ffmpeg here has
# exactly one job — turn a beatmap video Chromium cannot demux into an mp4 it
# can. So the build is `--disable-everything` plus the components that job
# needs, which lands at ~24 MB instead of ~100 MB for a general-purpose build.
#
# What is enabled, and why each part is needed:
#
#   demuxers  avi matroska mov flv mpegps mpegts asf ogg
#             — the containers beatmaps actually ship (.avi above all)
#   muxer     mp4
#             — the only output Chromium is trusted with
#   encoders  libx264 aac
#             — used only when a stream cannot be copied
#   decoders  the video codecs mp4 cannot carry (DivX/Xvid, WMV, VC-1, VP6/8/9,
#             MPEG-1/2, H.263, FLV, MJPEG) and the audio codecs mp4 cannot carry
#             (WMA, AC-3, Vorbis, and the raw/MPEG ones used as fallbacks)
#   protocols file pipe
#             — `pipe:1` is the `-progress` channel; without it every
#               conversion fails with "Protocol not found"
#
# Deliberately absent: the H.264 decoder. H.264 sources are copied, never
# decoded, and libavcodec/h264_mb.c is the file that needs several GB to
# compile — dropping it both shrinks the binary and makes the build survive a
# machine under memory pressure. Its parser stays, because the mov/avi demuxers
# need it.
#
# Requirements (Windows):
#   - MSYS2 with the UCRT64 toolchain: pacman -S --needed base-devel mingw-w64-ucrt-x86_64-{gcc,nasm,diffutils,pkgconf}
#   - x264 built with the same toolchain and installed under /ucrt64
#   - the ffmpeg source tree, fetched and verified with
#       node scripts/fetch-ffmpeg-source.mjs
#
# Usage:
#   FFMPEG_SRC=/e/src/ffmpeg-7.1.1 bash scripts/build-ffmpeg-slim.sh
#
# Reproducibility: the configure line below is pinned, including `--prefix`,
# because the build string is compiled into the binary and a host path in it
# (`--prefix=/e/Repositories/nx-build/prefix` in an earlier build) is both a
# fingerprint of the machine that built it and a reason for a scanner to trust
# the binary less. `SOURCE_DATE_EPOCH` is fixed for the same reason. A matching
# hash is still not guaranteed — the toolchain version is not pinned here — but
# the build no longer varies by who ran it or where.
#
# Build with -j1: this is a small, memory-hungry link-into-one-binary build, and
# parallel jobs are what exhaust the pagefile on a 16 GB machine.
set -euo pipefail

FFMPEG_SRC="${FFMPEG_SRC:?set FFMPEG_SRC to the ffmpeg source directory}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
WORK="${WORK:-$REPO/../nx-build}"
TARGET="$REPO/resources/ffmpeg/win32-x64/ffmpeg.exe"

# A fixed prefix and timestamp: both end up inside the binary, and both must not
# describe this particular machine.
PREFIX="${PREFIX:-/opt/nericx-ffmpeg}"
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1735689600}"  # 2025-01-01T00:00:00Z

export PATH="/ucrt64/bin:/usr/bin:$PATH"
export PKG_CONFIG_PATH="/ucrt64/lib/pkgconfig"

mkdir -p "$WORK"
BUILD="$WORK/build-ffmpeg"
rm -rf "$BUILD" && mkdir -p "$BUILD"
# configure runs test programs; a tmp fs mounted noexec, or a %TEMP% the MSYS2
# shell cannot write to, fails it with "Unable to create and execute files".
mkdir -p "$WORK/tmp"
export TMPDIR="$WORK/tmp"
cd "$BUILD"

"$FFMPEG_SRC/configure" \
  --prefix="$PREFIX" \
  --arch=x86_64 \
  --target-os=mingw32 \
  --enable-gpl \
  --enable-static \
  --disable-shared \
  --disable-everything \
  --disable-autodetect \
  --disable-network \
  --disable-debug \
  --disable-doc \
  --disable-ffplay \
  --disable-ffprobe \
  --disable-avdevice \
  --disable-postproc \
  --enable-small \
  --enable-libx264 \
  --pkg-config-flags="--static" \
  --extra-cflags="-Os -ffunction-sections -fdata-sections" \
  --extra-ldflags="-Wl,--gc-sections -static -s" \
  --enable-protocol=file,pipe \
  --enable-demuxer=avi,matroska,mov,flv,mpegps,mpegts,asf,ogg \
  --enable-muxer=mp4 \
  --enable-decoder=mpeg4,msmpeg4v3,msmpeg4v2,wmv1,wmv2,wmv3,vc1,vp6f,vp8,vp9,mpeg2video,mpeg1video,h263,flv,mjpeg \
  --enable-decoder=mp3,aac,ac3,eac3,flv,mp2,wmav1,wmav2,vorbis,opus,pcm_s16le,pcm_u8 \
  --enable-encoder=libx264,aac \
  --enable-parser=h264,mpeg4video,mpegaudio,aac,vc1,vp9,opus \
  --enable-filter=scale,format,null,anull,aresample

# h2645_sei.c calls into aom_film_grain.c, but upstream only links that object
# through CONFIG_H264_SEI when a full build enables it; with --disable-everything
# the sei module is pulled in by the demuxers alone and the link fails on
# ff_aom_uninit_film_grain_params. The 7.x Makefile lists only the two sei
# objects, so add the third. Idempotent: a re-run finds the object already there
# and changes nothing.
MAKEFILE="$FFMPEG_SRC/libavcodec/Makefile"
if ! grep -q 'CONFIG_H264_SEI).*aom_film_grain\.o' "$MAKEFILE"; then
  sed -i -E 's/^(OBJS-\$\(CONFIG_H264_SEI\)[[:space:]]*\+=[[:space:]]*h264_sei\.o[[:space:]]+h2645_sei\.o)(.*)$/\1 aom_film_grain.o\2/' "$MAKEFILE"
fi
grep -n 'CONFIG_H264_SEI' "$MAKEFILE"

make -j1 ffmpeg.exe

mkdir -p "$(dirname "$TARGET")"
cp ffmpeg.exe "$TARGET"
ls -la "$TARGET"
"$TARGET" -hide_banner -buildconf | tr ' ' '\n' | grep -E 'protocol=|muxer=|encoder=' || true

# The build hash is not the shipped hash: stamp-ffmpeg.mjs writes a version
# resource afterwards, and that is the file bundling and verification use.
echo
echo "Next: node scripts/stamp-ffmpeg.mjs && node scripts/verify-ffmpeg.mjs --update"
