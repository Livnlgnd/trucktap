import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'

const databasePath = path.join(
  os.tmpdir(),
  `trucktap-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
)
process.env.DATABASE_PATH = databasePath
process.env.JWT_SECRET = 'smoke-test-secret-that-is-long-enough'
process.env.CORS_ORIGINS = 'http://localhost:5173'

const { app } = await import('../dist/app.js')
const { db } = await import('../dist/db.js')

const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const address = server.address()
if (!address || typeof address === 'string') throw new Error('No test port.')
const base = `http://127.0.0.1:${address.port}`

async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  const data = await response.json().catch(() => null)
  return { status: response.status, data }
}

const health = await request('/api/health')
assert.equal(health.status, 200)
assert.equal(health.data.ok, true)

const owner = await request('/api/auth/register', {
  method: 'POST',
  body: {
    name: 'Shop Owner',
    email: 'owner@example.com',
    password: 'password123',
    workspaceName: 'Smoke Electric',
  },
})
assert.equal(owner.status, 201)
assert.ok(owner.data.token)
assert.equal(owner.data.organization.role, 'owner')
const joinCode = owner.data.organization.joinCode
const ownerToken = owner.data.token
const ownerId = owner.data.user.id

const localWorkspace = {
  vans: [
    { id: 'van-101', name: 'Van #101 - Mike', techName: 'Mike', number: '#101' },
  ],
  parts: [
    {
      id: 'part-1',
      vanId: 'van-101',
      name: 'GFCI Outlet 20A White',
      sku: 'OUT-GFCI20W',
      category: 'Breakers & Boxes',
      parLevel: 8,
      currentUsedToday: 0,
      iconName: 'PlugZap',
    },
  ],
  orders: [],
}

const imported = await request('/api/workspace/import', {
  method: 'POST',
  token: ownerToken,
  body: localWorkspace,
})
assert.equal(imported.status, 201)
assert.equal(imported.data.snapshot.vans.length, 1)
assert.equal(imported.data.snapshot.parts.length, 1)

const incrementOp = {
  opId: 'op-increment-1',
  action: 'part:increment',
  entityId: 'part-1',
  payload: { delta: 1 },
  createdAt: new Date().toISOString(),
}
const pushIncrement = await request('/api/sync/push', {
  method: 'POST',
  token: ownerToken,
  body: { deviceId: 'smoke-device', ops: [incrementOp] },
})
assert.equal(pushIncrement.status, 200)
assert.deepEqual(pushIncrement.data.acknowledged, ['op-increment-1'])
assert.equal(pushIncrement.data.failed.length, 0)

let snapshot = await request('/api/sync/snapshot', { token: ownerToken })
assert.equal(snapshot.data.parts[0].currentUsedToday, 1)

const duplicate = await request('/api/sync/push', {
  method: 'POST',
  token: ownerToken,
  body: { deviceId: 'smoke-device', ops: [incrementOp] },
})
assert.deepEqual(duplicate.data.acknowledged, ['op-increment-1'])
snapshot = await request('/api/sync/snapshot', { token: ownerToken })
assert.equal(snapshot.data.parts[0].currentUsedToday, 1, 'ops must be idempotent')

const order = {
  id: 'TT-SMOKE-1',
  vanId: 'van-101',
  vanName: 'Van #101 - Mike',
  submittedAt: new Date().toISOString(),
  jobTag: 'WO-1',
  status: 'pending',
  items: [
    {
      partId: 'part-1',
      partName: 'GFCI Outlet 20A White',
      sku: 'OUT-GFCI20W',
      qty: 1,
      picked: false,
    },
  ],
}
const pushOrder = await request('/api/sync/push', {
  method: 'POST',
  token: ownerToken,
  body: {
    deviceId: 'smoke-device',
    ops: [
      {
        opId: 'op-order-submit-1',
        action: 'order:submit',
        entityId: order.id,
        payload: { order },
      },
    ],
  },
})
assert.deepEqual(pushOrder.data.failed, [])
snapshot = await request('/api/sync/snapshot', { token: ownerToken })
assert.equal(snapshot.data.parts[0].currentUsedToday, 0)
assert.equal(snapshot.data.orders.length, 1)

const pick = await request('/api/sync/push', {
  method: 'POST',
  token: ownerToken,
  body: {
    deviceId: 'smoke-device',
    ops: [
      {
        opId: 'op-pick-1',
        action: 'order:pick',
        entityId: order.id,
        payload: { partId: 'part-1', picked: true },
      },
    ],
  },
})
assert.deepEqual(pick.data.failed, [])
snapshot = await request('/api/sync/snapshot', { token: ownerToken })
assert.equal(snapshot.data.orders[0].status, 'picked')

const restock = await request('/api/sync/push', {
  method: 'POST',
  token: ownerToken,
  body: {
    deviceId: 'smoke-device',
    ops: [
      {
        opId: 'op-restock-1',
        action: 'order:restock',
        entityId: order.id,
        payload: {},
      },
    ],
  },
})
assert.deepEqual(restock.data.failed, [])
snapshot = await request('/api/sync/snapshot', { token: ownerToken })
assert.equal(snapshot.data.orders[0].status, 'restocked')

const failedOp = await request('/api/sync/push', {
  method: 'POST',
  token: ownerToken,
  body: {
    deviceId: 'smoke-device',
    ops: [
      {
        opId: 'op-bad-1',
        action: 'part:increment',
        entityId: 'missing-part',
        payload: {},
      },
    ],
  },
})
assert.equal(failedOp.data.failed.length, 1)
assert.match(failedOp.data.failed[0].error, /not found/i)

const joiner = await request('/api/auth/join', {
  method: 'POST',
  body: {
    name: 'Tech One',
    email: 'tech@example.com',
    password: 'password123',
    joinCode,
    role: 'tech',
  },
})
assert.equal(joiner.status, 201)
assert.equal(joiner.data.organization.role, 'tech')
const techToken = joiner.data.token
const techSnapshot = await request('/api/sync/snapshot', { token: techToken })
assert.equal(techSnapshot.data.orders[0].status, 'restocked')

const org = await request('/api/org', { token: ownerToken })
assert.equal(org.status, 200)
assert.equal(org.data.members.length, 2)
const techId = org.data.members.find((member) => member.role === 'tech').id
const roleUpdate = await request(`/api/org/members/${techId}`, {
  method: 'PATCH',
  token: ownerToken,
  body: { role: 'shop' },
})
assert.equal(roleUpdate.status, 200)
assert.equal(
  roleUpdate.data.members.find((member) => member.id === techId).role,
  'shop',
)

const techCannotRemove = await request(`/api/org/members/${ownerId}`, {
  method: 'DELETE',
  token: techToken,
})
assert.equal(techCannotRemove.status, 403)

const removed = await request(`/api/org/members/${techId}`, {
  method: 'DELETE',
  token: ownerToken,
})
assert.equal(removed.status, 200)
assert.equal(removed.data.members.length, 1)

const atomicRegister = await request('/api/auth/register', {
  method: 'POST',
  body: {
    name: 'Atomic Owner',
    email: 'atomic@example.com',
    password: 'password123',
    workspaceName: 'Atomic Electric',
    workspace: localWorkspace,
  },
})
assert.equal(atomicRegister.status, 201)
assert.ok(atomicRegister.data.organization.revision >= 1)
const atomicSnapshot = await request('/api/sync/snapshot', {
  token: atomicRegister.data.token,
})
assert.equal(atomicSnapshot.data.vans.length, 1)
assert.equal(atomicSnapshot.data.parts.length, 1)

const login = await request('/api/auth/login', {
  method: 'POST',
  body: {
    email: 'owner@example.com',
    password: 'password123',
  },
})
assert.equal(login.status, 200)
assert.ok(login.data.token)
assert.equal(login.data.organization.name, 'Smoke Electric')

await new Promise((resolve) => server.close(resolve))
db.close()
for (const suffix of ['', '-wal', '-shm']) {
  try {
    fs.rmSync(`${databasePath}${suffix}`)
  } catch {
    // Cleanup is best-effort.
  }
}
console.log('Server smoke test passed.')
