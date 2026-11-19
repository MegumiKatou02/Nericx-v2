# Pinned upstream sources for the bundled ffmpeg

`scripts/build-ffmpeg-slim.sh` builds a stripped, `--disable-everything` ffmpeg
from upstream source. The script itself downloads nothing; `scripts/fetch-ffmpeg-source.mjs`
fetches exactly these artifacts and refuses anything whose hash does not match.

Committing the hashes is what connects "the script in the repo" to "the binary
in the release". Without them a rebuild is a different file every time and a
false-positive report has no evidence to point at.

| Artifact | Version / commit | SHA-256 |
|---|---|---|
| `ffmpeg-7.1.1.tar.xz` | 7.1.1 (ffmpeg.org release) | `733984395e0dbbe5c046abda2dc49a5544e7e0e1e2366bba849222ae9e3a03b1` |
| `x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.bz2` | x264 `stable` @ `b35605a` | `6eeb82934e69fd51e043bd8c5b0d152839638d1ce7aa4eea65a3fedcf83ff224` |

## Why the commit and not "stable"

`stable` is a moving branch. Pinning the branch name would make the hash
meaningless the next time it advances, which is exactly the kind of silent drift
the hash exists to catch.

## Signature

FFmpeg signs its release tarballs. `scripts/fetch-ffmpeg-source.mjs` verifies
the GPG signature when `gpg` is available and the key can be imported, in
addition to the SHA-256:

```
gpg --verify ffmpeg-7.1.1.tar.xz.asc ffmpeg-7.1.1.tar.xz
# Good signature from "FFmpeg release signing key <ffmpeg-devel@ffmpeg.org>"
# Primary key fingerprint: FCF9 86EA 15E6 E293 A564  4F10 B432 2F04 D676 58D8
```

The public key comes from `https://ffmpeg.org/ffmpeg-devel.asc`. The key's user
ID is not locally certified, so gpg prints an "unknown" trust warning; the
fingerprint printed by `--verify` is what matters and it is recorded above.

x264 publishes no signatures; its pinned-commit hash is the only guarantee.

## Updating the pin

Only when the ffmpeg version is deliberately bumped:

1. Update the version and hashes in `scripts/pinned-sources.json` (and the x264
   commit, if it moved).
2. Update this table, and the version in the `Build slim ffmpeg` Windows job that
   smoke-tests `ffmpeg version 7.1.1`.
3. Run the `Build slim ffmpeg` workflow. It verifies the new sources, builds,
   stamps, and compares the result with the pinned binary hash. If the hash
   differs it keeps the artifact but refuses to publish; download the artifact,
   run `node scripts/verify-ffmpeg.mjs --update` locally, commit the new
   `.sha256`, and re-run the workflow.
4. Re-run the video smoke test on a `.avi` and an `.mkv` beatmap before release.

The workflow also publishes `nericx-ffmpeg-sources.tar.xz` — the two verified
tarballs plus the build scripts — next to the binary, which is the GPL v3
corresponding-source offer that `resources/licenses/NOTICE.md` describes.
