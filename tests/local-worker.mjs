import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

const origin = process.env.WHITEBOARD_TEST_ORIGIN ?? 'http://127.0.0.1:4173'
const anonymous = { cookie: '' }

async function request(user, path, method = 'GET', body, expected = 200) {
  const response = await fetch(origin + '/api' + path, {
    method,
    headers: {
      Origin: origin,
      ...(user.cookie && { Cookie: user.cookie }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await response.text()
  assert.equal(response.status, expected, `${method} ${path}: ${raw}`)
  return { response, data: raw ? JSON.parse(raw) : undefined }
}

async function account(name) {
  const username = `qa_${randomUUID().slice(0, 8)}`
  const password = randomUUID()
  await request(anonymous, '/auth/sign-up/email', 'POST', {
    username, name, email: `${username}@example.test`, password,
  })
  const { response, data } = await request(anonymous, '/auth/sign-in/username', 'POST', { username, password })
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  assert.ok(cookie)
  return { cookie, id: data.user.id }
}

function openRoom(user, board) {
  const socketUrl = new URL(`/api/boards/${board}/socket`, origin)
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(socketUrl, { headers: { Cookie: user.cookie, Origin: origin } })
  const messages = []
  socket.addEventListener('message', event => messages.push(JSON.parse(event.data)))
  let closed
  socket.addEventListener('close', event => { closed = event.code })
  async function until(read, description) {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      const result = read()
      if (result !== undefined) return result
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error(`Timed out waiting for ${description}; close: ${closed}; messages: ${JSON.stringify(messages)}`)
  }
  return {
    send: value => socket.send(JSON.stringify(value)),
    close: () => socket.close(),
    closed: () => until(() => closed, 'socket close'),
    message: (type, predicate = () => true) => until(
      () => messages.find(message => message.type === type && predicate(message)),
      type,
    ),
  }
}

function rectangle(label) {
  return { id: randomUUID(), type: 'rectangle', x: 40, y: 60, width: 160, height: 74, label, color: 'default' }
}

function commit(room, after, before = null, id = randomUUID()) {
  room.send({ type: 'commit', id, changes: [{ id: after.id, before, after }] })
  return id
}

test('private sharing, role enforcement, live edits, persistence and revocation', { timeout: 30_000 }, async t => {
  const [owner, editor, viewer] = await Promise.all([
    account('QA Owner'), account('QA Editor'), account('QA Viewer'),
  ])
  const { data: { board } } = await request(owner, '/boards', 'POST', {}, 201)
  const boardPath = `/boards/${board.id}`
  t.after(() => request(owner, boardPath, 'DELETE', undefined, 204))
  assert.equal(board.role, 'owner')
  const { data: renamed } = await request(owner, boardPath, 'PATCH', { title: 'QA Checkout' })
  assert.equal(renamed.board.title, 'QA Checkout')
  await request(anonymous, boardPath, 'GET', undefined, 401)
  await request(editor, boardPath, 'GET', undefined, 404)
  await request(viewer, boardPath, 'GET', undefined, 404)

  const invites = {}
  for (const [role, user] of Object.entries({ editor, viewer })) {
    const { data } = await request(owner, boardPath + '/invites', 'POST', { role }, 201)
    const token = new URL(data.url, origin).pathname.split('/').pop()
    const path = `/invites/${token}`
    invites[role] = { path, id: data.invite.id }
    await request(anonymous, path, 'POST', {}, 401)
    const { data: redemption } = await request(user, path, 'POST', {})
    assert.equal(redemption.board.role, role)
    const { data: catalog } = await request(user, '/boards')
    assert.ok(catalog.boards.some(item => item.id === board.id && item.role === role))
  }
  await request(editor, boardPath + '/invites', 'POST', { role: 'viewer' }, 403)
  await request(viewer, boardPath, 'PATCH', { title: 'Unauthorized' }, 403)

  const ownerRoom = openRoom(owner, board.id)
  const editorRoom = openRoom(editor, board.id)
  const viewerRoom = openRoom(viewer, board.id)
  t.after(() => { ownerRoom.close(); editorRoom.close(); viewerRoom.close() })
  const [snapshot] = await Promise.all([ownerRoom, editorRoom, viewerRoom].map(room => room.message('snapshot')))
  assert.deepEqual(snapshot.elements, [])
  editorRoom.send({ type: 'cursor', point: { x: 100, y: 80 } })
  await ownerRoom.message('presence', message => message.presence.some(peer => peer.userId === editor.id && peer.point?.x === 100))

  const ownerShape = rectangle('Owner shape')
  const editorShape = rectangle('Editor shape')
  const blocked = commit(viewerRoom, rectangle('Viewer cannot edit'))
  assert.equal((await viewerRoom.message('reject', message => message.id === blocked)).id, blocked)
  const ownerChange = commit(ownerRoom, ownerShape)
  const editorChange = commit(editorRoom, editorShape)
  await viewerRoom.message('commit', message => message.id === ownerChange)
  await viewerRoom.message('commit', message => message.id === editorChange)

  editorRoom.close()
  await editorRoom.closed()
  const editorReconnected = openRoom(editor, board.id)
  t.after(() => editorReconnected.close())
  const recovered = await editorReconnected.message('snapshot')
  assert.deepEqual(new Set(recovered.elements.map(shape => shape.id)), new Set([ownerShape.id, editorShape.id]))
  commit(editorReconnected, editorShape, null, editorChange)
  await editorReconnected.message('ack', message => message.id === editorChange)

  await request(owner, boardPath + '/invites/' + invites.editor.id, 'DELETE', undefined, 204)
  await request(owner, boardPath + '/members/' + editor.id, 'DELETE', undefined, 204)
  assert.equal(await editorReconnected.closed(), 4403)
  await request(editor, invites.editor.path, 'POST', {}, 404)
  await request(editor, boardPath, 'GET', undefined, 404)
  const { data: access } = await request(owner, boardPath + '/access')
  assert.ok(!access.members.some(member => member.id === editor.id))
  assert.ok(access.members.some(member => member.id === owner.id && member.role === 'owner'))

  await request(viewer, '/auth/sign-out', 'POST', {})
  assert.equal(await viewerRoom.closed(), 4403)
  await request(viewer, boardPath, 'GET', undefined, 401)
})
