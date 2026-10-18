import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const projectId = 'demo-dms-student-council'
let environment

function googleMember(uid, email, emailVerified = true) {
  return environment.authenticatedContext(uid, {
    email,
    email_verified: emailVerified,
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
})

after(async () => {
  await environment.cleanup()
})

test('denies anonymous and unapproved reads and writes', async () => {
  const anonymous = environment.unauthenticatedContext().firestore()
  const unapproved = googleMember('outsider', 'outsider@example.com')
  const unverified = googleMember('unverified', 'mahshah1@dunlapstudents.net', false)
  const passwordSignIn = environment.authenticatedContext('password-user', {
    email: 'mahshah1@dunlapstudents.net',
    email_verified: true,
    firebase: { sign_in_provider: 'password' },
  }).firestore()

  for (const path of ['events/event-1', 'chatMessages/message-1', 'tasks/task-1', 'agendaItems/item-1', 'members/mahima-shah']) {
    await assertFails(getDoc(doc(anonymous, path)))
    await assertFails(getDoc(doc(unapproved, path)))
    await assertFails(setDoc(doc(unapproved, path), { id: path.split('/')[1] }))
    await assertFails(getDoc(doc(unverified, path)))
    await assertFails(getDoc(doc(passwordSignIn, path)))
  }
})

test('allows any approved member to share workspace data across accounts', async () => {
  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')
  const event = {
    id: 'event-1',
    title: 'Board meeting',
    creatorId: 'mahima-shah',
    updatedById: 'mahima-shah',
    status: 'Pending',
    comments: [],
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
  }

  await assertSucceeds(setDoc(doc(mahima, 'events/event-1'), event))
  await assertSucceeds(setDoc(doc(mahima, 'chatMessages/message-1'), {
    id: 'message-1',
    memberId: 'mahima-shah',
    text: 'Shared message',
    createdAt: '2026-10-18T12:00:00.000Z',
  }))
  await assertSucceeds(setDoc(doc(mahima, 'tasks/task-1'), {
    id: 'task-1',
    title: 'Shared task',
    assigneeId: 'nikhil-nayak',
  }))
  await assertSucceeds(setDoc(doc(mahima, 'agendaItems/item-1'), {
    id: 'item-1',
    eventId: 'event-1',
    text: 'Review plans',
    completed: false,
    createdAt: '2026-10-18T12:00:00.000Z',
  }))
  assert.equal((await assertSucceeds(getDoc(doc(nikhil, 'events/event-1')))).data().title, 'Board meeting')
  assert.equal((await assertSucceeds(getDoc(doc(nikhil, 'chatMessages/message-1')))).data().text, 'Shared message')
  assert.equal((await assertSucceeds(getDoc(doc(nikhil, 'tasks/task-1')))).data().title, 'Shared task')
  assert.equal((await assertSucceeds(getDoc(doc(nikhil, 'agendaItems/item-1')))).data().text, 'Review plans')
  const reloadedClient = googleMember('mahima-reloaded', 'mahshah1@dunlapstudents.net')
  assert.equal((await assertSucceeds(getDoc(doc(reloadedClient, 'events/event-1')))).data().title, 'Board meeting')
  await assertSucceeds(setDoc(doc(nikhil, 'events/event-1'), {
    ...event,
    status: 'Approved',
    approverId: 'nikhil-nayak',
    updatedById: 'nikhil-nayak',
    updatedAt: '2026-10-18T12:05:00.000Z',
    decidedAt: '2026-10-18T12:05:00.000Z',
  }))
})

test('allows comments only when their author matches the signed-in member', async () => {
  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')
  const event = {
    id: 'comment-event',
    creatorId: 'mahima-shah',
    updatedById: 'mahima-shah',
    status: 'Pending',
    comments: [],
  }

  await assertSucceeds(setDoc(doc(mahima, 'events/comment-event'), event))
  await assertSucceeds(setDoc(doc(nikhil, 'events/comment-event'), {
    ...event,
    comments: [{ id: 'comment-1', memberId: 'nikhil-nayak', text: 'Looks good', createdAt: '2026-10-18T12:00:00.000Z' }],
  }))
  await assertFails(setDoc(doc(nikhil, 'events/comment-event'), {
    ...event,
    comments: [{ id: 'comment-2', memberId: 'mahima-shah', text: 'Forged author', createdAt: '2026-10-18T12:01:00.000Z' }],
  }))
})

test('ties event and chat authors to the authenticated roster identity', async () => {
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')

  await assertFails(setDoc(doc(nikhil, 'events/forged-event'), {
    id: 'forged-event',
    creatorId: 'mahima-shah',
    status: 'Pending',
  }))
  await assertFails(setDoc(doc(nikhil, 'chatMessages/forged-message'), {
    id: 'forged-message',
    memberId: 'mahima-shah',
    text: 'Forged identity',
    createdAt: '2026-10-18T12:00:00.000Z',
  }))
})

test('persists only the canonical member profile and prevents permission changes', async () => {
  const approved = googleMember('mahima', 'mahshah1@dunlapstudents.net')

  await assertSucceeds(setDoc(doc(approved, 'members/mahima-shah'), {
    id: 'mahima-shah',
    name: 'Mahima Shah',
    role: 'Co-President',
    email: 'mahshah1@dunlapstudents.net',
  }))
  await assertFails(setDoc(doc(approved, 'members/mahima-shah'), {
    id: 'mahima-shah',
    name: 'Mahima Shah',
    role: 'Administrator',
    email: 'mahshah1@dunlapstudents.net',
    permissions: ['manage-members'],
  }))
})
