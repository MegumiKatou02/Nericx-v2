import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoverAvailability } from '../src/electron/coverAvailability.ts'

const COVER = id => `https://assets.ppy.sh/beatmaps/${id}/covers/list@2x.jpg`

function imageResponse(status = 200) {
  return { ok: true, status, headers: { get: name => (name === 'content-type' ? 'image/jpeg' : null) } }
}

function htmlResponse(status) {
  return { ok: false, status, headers: { get: name => (name === 'content-type' ? 'text/html' : null) } }
}

test('a beatmapset with an image cover reports true', async () => {
  const covers = createCoverAvailability(async () => imageResponse())
  assert.equal(await covers.hasCover('320118'), true)
})

test('a beatmapset whose cover 404s reports false', async () => {
  const covers = createCoverAvailability(async () => htmlResponse(404))
  assert.equal(await covers.hasCover('1000'), false)
})

test('the request is a HEAD to the square cover url', async () => {
  const seen = []
  const covers = createCoverAvailability(async (url, init) => {
    seen.push({ url, method: init.method })
    return imageResponse()
  })
  await covers.hasCover('320118')
  assert.deepEqual(seen, [{ url: COVER('320118'), method: 'HEAD' }])
})

test('the answer is cached so a second call makes no request', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => { calls++; return imageResponse() })
  await covers.hasCover('320118')
  await covers.hasCover('320118')
  assert.equal(calls, 1)
})

test('a server error keeps the cover and is not cached', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => {
    calls++
    return calls === 1 ? htmlResponse(500) : imageResponse()
  })
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(calls, 2, 'the failed probe must be retried')
})

test('a network error keeps the cover and is not cached', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => {
    calls++
    if (calls === 1) throw new Error('getaddrinfo ENOTFOUND')
    return imageResponse()
  })
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(calls, 2)
})

test('concurrent calls for the same beatmapset share one request', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 10))
    return imageResponse()
  })
  const results = await Promise.all([
    covers.hasCover('320118'),
    covers.hasCover('320118'),
    covers.hasCover('320118')
  ])
  assert.deepEqual(results, [true, true, true])
  assert.equal(calls, 1)
})

test('distinct beatmapsets are probed independently', async () => {
  const covers = createCoverAvailability(async url => (url.includes('/1000/') ? htmlResponse(404) : imageResponse()))
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(await covers.hasCover('1000'), false)
})

test('the cache evicts the oldest entry past maxEntries', async () => {
  const calls = []
  const covers = createCoverAvailability(async url => { calls.push(url); return imageResponse() }, { maxEntries: 2 })
  await covers.hasCover('1')
  await covers.hasCover('2')
  await covers.hasCover('3')
  await covers.hasCover('1')
  assert.equal(calls.filter(u => u === COVER('1')).length, 2, 'id 1 was evicted and probed again')
})

test('a slow CDN times out and keeps the cover', async () => {
  const covers = createCoverAvailability(
    (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')))
    }),
    { timeoutMs: 20 }
  )
  assert.equal(await covers.hasCover('320118'), true)
})
