import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LOCALES,
  resolveLocale,
  translate
} from '../src/electron/i18n.ts'
import { buildActivity } from '../src/electron/discordActivity.ts'

const NOW = 1762800000000

test('resolveLocale maps OS tags and falls back to English', () => {
  assert.equal(resolveLocale('vi-VN'), 'vi')
  assert.equal(resolveLocale('vi'), 'vi')
  assert.equal(resolveLocale('ja-JP'), 'ja')
  assert.equal(resolveLocale('JA'), 'ja')
  assert.equal(resolveLocale('en-US'), 'en')
  assert.equal(resolveLocale('fr-FR'), 'en')
  assert.equal(resolveLocale(''), 'en')
  assert.equal(resolveLocale(null), 'en')
  assert.equal(resolveLocale(undefined), 'en')
})

test('translate fills placeholders and leaves unknown slots alone', () => {
  assert.equal(translate('en', 'music.loadedCount', { count: 12 }), 'Loaded 12 songs')
  assert.equal(translate('vi', 'music.loadedCount', { count: 12 }), 'Đã tải 12 bài hát')
  assert.equal(translate('ja', 'music.loadedCount', { count: 12 }), '12 曲を読み込みました')
  // A slot without a matching param stays visible instead of becoming "undefined".
  assert.equal(translate('en', 'music.loadedCount', {}), 'Loaded {count} songs')
})

test('every locale has a catalogue and translates the shared keys', () => {
  const keys = [
    'app.tab.general',
    'settings.title',
    'general.save',
    'backup.start',
    'music.play',
    'songInfo.title',
    'imageViewer.close',
    'keyboard.title',
    'dialog.saveSuccess'
  ]
  for (const locale of LOCALES) {
    for (const key of keys) {
      const text = translate(locale, key)
      assert.equal(typeof text, 'string')
      assert.ok(text.length > 0, `${locale}/${key} is empty`)
      assert.notEqual(text, key, `${locale}/${key} is missing`)
    }
  }
})

test('no locale leaves a placeholder unfilled for the shared params', () => {
  for (const locale of LOCALES) {
    const done = translate(locale, 'backup.done')
    const failed = translate(locale, 'backup.failed', { message: 'disk full' })
    assert.ok(done.length > 0)
    assert.ok(failed.includes('disk full'), `${locale} dropped the error message`)
    assert.ok(!failed.includes('{message}'), `${locale} kept the placeholder`)
  }
})

test('Discord presence follows the requested locale', () => {
  const english = buildActivity({ name: 'Song', locale: 'en' }, NOW)
  const vietnamese = buildActivity({ name: 'Song', locale: 'vi' }, NOW)
  const japanese = buildActivity({ name: 'Song', locale: 'ja' }, NOW)

  assert.equal(english.state, 'Listening in Nericx')
  assert.equal(vietnamese.state, 'Nghe nhạc trong Nericx')
  assert.equal(japanese.state, 'Nericx で音楽を再生中')

  const buttons = buildActivity({ name: 'Song', beatmapsetId: '1', locale: 'vi' }, NOW)
  assert.equal(buttons.buttons[0].label, 'Xem Beatmap')
})

test('Discord presence defaults to English without a locale', () => {
  const activity = buildActivity({ name: 'Song' }, NOW)
  assert.equal(activity.state, 'Listening in Nericx')
})
