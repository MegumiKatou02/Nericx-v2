import test from 'node:test'
import assert from 'node:assert/strict'
import { findVideoFile } from '../src/electron/videoFile.ts'

test('finds the mp4 of a beatmap folder', () => {
  assert.equal(findVideoFile(['audio.mp3', 'bg.jpg', 'video.mp4']), 'video.mp4')
})

test('finds an avi when the folder has no mp4', () => {
  assert.equal(findVideoFile(['audio.mp3', 'bg.jpg', 'background.avi']), 'background.avi')
})

test('is case-insensitive about the extension', () => {
  assert.equal(findVideoFile(['AUDIO.MP3', 'Video.AVI']), 'Video.AVI')
})

test('prefers a playable container over a named .avi', () => {
  // Chromium cannot play the AVI, so the MP4 must win even with a worse name.
  const entries = ['video.avi', 'bg.mp4']
  assert.equal(findVideoFile(entries), 'bg.mp4')
})

test('prefers a file named like a video when the containers match', () => {
  const entries = ['random-clip.mp4', 'video.mp4']
  assert.equal(findVideoFile(entries), 'video.mp4')
})

test('prefers background/bg names within one container', () => {
  assert.equal(findVideoFile(['clip.mkv', 'bg.mkv']), 'bg.mkv')
})

test('returns undefined when the folder has no video', () => {
  assert.equal(findVideoFile(['audio.mp3', 'bg.jpg', 'note.txt']), undefined)
  assert.equal(findVideoFile([]), undefined)
})

test('ignores audio files with a video-like name', () => {
  assert.equal(findVideoFile(['background.mp3', 'audio.ogg']), undefined)
})
