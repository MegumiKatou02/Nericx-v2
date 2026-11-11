import test from 'node:test'
import assert from 'node:assert/strict'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { createConfigStore } from '../src/electron/configStore.ts'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`
const DEFAULTS = [
  ['theme', 'warm'],
  ['volume', '0.5']
]

function store() {
  const created = []
  const db = createConfigStore({
    openDatabase: async () => {
      const handle = await open({ filename: ':memory:', driver: sqlite3.Database })
      created.push(handle)
      return handle
    }
  })
  return { db, created }
}

/** The store only creates the table in `init`, so every test that reads starts there. */
async function openedStore() {
  const handle = store()
  await handle.db.init(SCHEMA, [])
  return handle
}

test('the connection is opened once no matter how many reads happen', async () => {
  const { db, created } = await openedStore()

  await db.get('theme')
  await db.get('theme')
  await db.get('volume')

  assert.equal(created.length, 1)
  await db.close()
})

test('missing keys read back as null', async () => {
  const { db } = await openedStore()
  assert.equal(await db.get('nope'), null)
  await db.close()
})

test('a written value reads back unchanged', async () => {
  const { db } = await openedStore()
  await db.set('volume', '0')
  assert.equal(await db.get('volume'), '0')
  await db.close()
})

test('defaults are inserted once and never overwrite a stored value', async () => {
  const { db } = store()
  await db.init(SCHEMA, DEFAULTS)
  await db.set('theme', 'dark')
  await db.init(SCHEMA, DEFAULTS)

  assert.equal(await db.get('theme'), 'dark')
  assert.equal(await db.get('volume'), '0.5')
  await db.close()
})

test('overlapping writes all land', async () => {
  const { db } = await openedStore()
  await Promise.all([
    db.set('a', '1'),
    db.set('b', '2'),
    db.set('c', '3')
  ])

  assert.equal(await db.get('a'), '1')
  assert.equal(await db.get('b'), '2')
  assert.equal(await db.get('c'), '3')
  await db.close()
})

test('a failing write rejects the caller and keeps the store usable', async () => {
  const { db } = await openedStore()
  await assert.rejects(db.set('bad', null), /NOT NULL|constraint/i)
  await db.set('good', '1')
  assert.equal(await db.get('good'), '1')
  await db.close()
})

test('after close the next call opens a fresh connection', async () => {
  const { db, created } = await openedStore()

  await db.get('theme')
  await db.close()
  await db.init(SCHEMA, [])
  await db.get('theme')

  assert.equal(created.length, 2)
  await db.close()
})
