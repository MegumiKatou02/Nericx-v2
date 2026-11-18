import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConversionArgs,
  ffmpegBinaryName,
  isTranscodableVideo,
  parseFfmpegDuration,
  parseFfmpegProgress,
  parseFfmpegStreams,
  planConversion,
  progressPercent,
  resolveFfmpegPath,
  videoCacheFileName,
  videoCachePartName
} from '../src/electron/ffmpeg.ts'

test('only containers Chromium cannot demux are converted', () => {
  assert.equal(isTranscodableVideo('C:\\osu!\\Songs\\a\\background.avi'), true)
  assert.equal(isTranscodableVideo('C:\\osu!\\Songs\\a\\video.MKV'), true)
  assert.equal(isTranscodableVideo('C:\\osu!\\Songs\\a\\video.mp4'), false)
  assert.equal(isTranscodableVideo('C:\\osu!\\Songs\\a\\video.webm'), false)
  assert.equal(isTranscodableVideo('C:\\osu!\\Songs\\a\\audio.ogg'), false)
  assert.equal(isTranscodableVideo(undefined), false)
  assert.equal(isTranscodableVideo(42), false)
})

test('the binary name follows the platform', () => {
  assert.equal(ffmpegBinaryName('win32'), 'ffmpeg.exe')
  assert.equal(ffmpegBinaryName('linux'), 'ffmpeg')
  assert.equal(ffmpegBinaryName('darwin'), 'ffmpeg')
})

test('development reads the fetched binary under the project', () => {
  const resolved = resolveFfmpegPath({
    isPackaged: false,
    resourcesPath: 'C:\\ignored',
    appPath: 'E:\\Repositories\\Nericx-v2',
    platform: 'win32',
    arch: 'x64'
  })
  assert.equal(resolved, 'E:\\Repositories\\Nericx-v2\\resources\\ffmpeg\\win32-x64\\ffmpeg.exe')
})

test('a packaged build reads the extra resource beside the asar archive', () => {
  const resolved = resolveFfmpegPath({
    isPackaged: true,
    resourcesPath: 'C:\\Program Files\\Nericx\\resources',
    appPath: 'C:\\Program Files\\Nericx\\resources\\app.asar',
    platform: 'win32',
    arch: 'x64'
  })
  assert.equal(resolved, 'C:\\Program Files\\Nericx\\resources\\ffmpeg\\win32-x64\\ffmpeg.exe')
})

test('the stream banner yields the first video and audio codec', () => {
  const log = [
    "Input #0, avi, from 'video.avi':",
    '  Duration: 00:01:02.50, start: 0.000000, bitrate: 900 kb/s',
    '  Stream #0:0: Video: h264 (High) (H264 / 0x34363248), yuv420p, 800x600, 30 fps',
    '  Stream #0:1: Audio: mp3 (U[0][0][0] / 0x0055), 44100 Hz, stereo, fltp, 128 kb/s'
  ].join('\n')
  assert.deepEqual(parseFfmpegStreams(log), {
    videoCodec: 'h264',
    audioCodec: 'mp3',
    hasAudio: true
  })
})

test('the stream banner tolerates a silent video and an unreadable file', () => {
  const silent = "  Stream #0:0: Video: mpeg4 (Simple Profile), yuv420p, 640x480, 25 fps"
  assert.deepEqual(parseFfmpegStreams(silent), {
    videoCodec: 'mpeg4',
    audioCodec: null,
    hasAudio: false
  })
  // A missing or broken probe must not claim a copyable file, hence no codec.
  assert.deepEqual(parseFfmpegStreams(''), { videoCodec: null, audioCodec: null, hasAudio: false })
})

test('a codec mp4 cannot carry is re-encoded, not copied', () => {
  assert.deepEqual(planConversion({ videoCodec: 'h264', audioCodec: 'aac', hasAudio: true }), {
    video: 'copy',
    audio: 'copy'
  })
  // DivX/Xvid in an AVI: the video is re-encoded while mp3 audio is copied.
  assert.deepEqual(planConversion({ videoCodec: 'mpeg4', audioCodec: 'mp3', hasAudio: true }), {
    video: 'encode',
    audio: 'copy'
  })
  // A codec mp4 can hold in neither container: both streams re-encoded.
  assert.deepEqual(planConversion({ videoCodec: 'wmv3', audioCodec: 'wmav2', hasAudio: true }), {
    video: 'encode',
    audio: 'encode'
  })
  // No audio at all is not a stream to convert.
  assert.deepEqual(planConversion({ videoCodec: 'h264', audioCodec: null, hasAudio: false }), {
    video: 'copy',
    audio: 'none'
  })
  // An unreadable probe must never plan a copy of an unknown codec.
  assert.deepEqual(planConversion({ videoCodec: null, audioCodec: null, hasAudio: false }), {
    video: 'encode',
    audio: 'none'
  })
})

test('a copied stream keeps its bitstream and the maps stay optional-safe', () => {
  const args = buildConversionArgs('C:\\a b\\in.avi', 'C:\\cache\\out.part', {
    video: 'copy',
    audio: 'copy'
  })
  assert.deepEqual(args.slice(0, 8), [
    '-hide_banner', '-nostdin', '-loglevel', 'info', '-progress', 'pipe:1', '-y',
    '-i'
  ])
  assert.equal(args[args.indexOf('-i') + 1], 'C:\\a b\\in.avi')
  const maps = args.flatMap((arg, index) => arg === '-map' ? [args[index + 1]] : [])
  assert.deepEqual(maps, ['0:v:0', '0:a:0?'])
  // `?` makes a missing audio stream acceptable instead of an error.
  assert.equal(maps[1], '0:a:0?')
  assert.equal(args[args.indexOf('-c:v') + 1], 'copy')
  assert.equal(args[args.indexOf('-c:a') + 1], 'copy')
  assert.equal(args.includes('-vf'), false)
  // The output is a `.part` file, so the container cannot be inferred.
  assert.equal(args[args.indexOf('-f') + 1], 'mp4')
  assert.equal(args.at(-1), 'C:\\cache\\out.part')
})

test('an encoded stream asks for h264/yuv420p with even dimensions', () => {
  const args = buildConversionArgs('in.avi', 'out.part', { video: 'encode', audio: 'encode' })
  assert.equal(args[args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(args[args.indexOf('-pix_fmt') + 1], 'yuv420p')
  assert.equal(args[args.indexOf('-vf') + 1], 'scale=trunc(iw/2)*2:trunc(ih/2)*2')
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac')
})

test('a silent source is given no audio arguments at all', () => {
  const args = buildConversionArgs('in.avi', 'out.part', { video: 'copy', audio: 'none' })
  assert.equal(args.includes('-c:a'), false)
  // The optional map is harmless and keeps a stray audio stream out of the mp4.
  const maps = args.flatMap((arg, index) => arg === '-map' ? [args[index + 1]] : [])
  assert.deepEqual(maps, ['0:v:0', '0:a:0?'])
})

test('the source duration is read from the ffmpeg banner', () => {
  const log = [
    'Input #0, avi, from \'video.avi\':',
    '  Duration: 00:01:02.50, start: 0.000000, bitrate: 900 kb/s'
  ].join('\n')
  assert.equal(parseFfmpegDuration(log), 62.5)
  assert.equal(parseFfmpegDuration('no banner here'), null)
  assert.equal(parseFfmpegDuration('Duration: 00:00:00.00, start'), null)
})

test('progress reads the last out_time in a chunk', () => {
  const chunk = 'frame=10\nout_time=00:00:01.500000\ndup=0\nout_time=00:00:03.250000\nprogress=continue\n'
  assert.equal(parseFfmpegProgress(chunk), 3.25)
  assert.equal(parseFfmpegProgress('frame=10\n'), null)
})

test('percent is clamped and survives a zero duration', () => {
  assert.equal(progressPercent(5, 10), 50)
  assert.equal(progressPercent(20, 10), 100)
  assert.equal(progressPercent(-2, 10), 0)
  assert.equal(progressPercent(5, 0), 0)
  assert.equal(progressPercent(5, Number.NaN), 0)
})

test('the cache name changes when the source bytes change', () => {
  const first = videoCacheFileName('C:\\a\\video.avi', 1000, 1_700_000_000_000)
  assert.equal(videoCachePartName('C:\\a\\video.avi', 1000, 1_700_000_000_000), first.replace(/\.mp4$/, '.part'))
  assert.match(first, /^[0-9a-f]{40}\.mp4$/)

  const resized = videoCacheFileName('C:\\a\\video.avi', 1001, 1_700_000_000_000)
  const touched = videoCacheFileName('C:\\a\\video.avi', 1000, 1_700_000_000_001)
  const moved = videoCacheFileName('C:\\b\\video.avi', 1000, 1_700_000_000_000)
  for (const other of [resized, touched, moved]) assert.notEqual(other, first)
})
