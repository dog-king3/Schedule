import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'

const projectId = 'demo-dms-student-council'
let environment

function googleMember(uid, email, emailVerified = true) {
  return environment.authenticatedContext(uid, {
    email,
    email_verified: emailVerified,
    firebase: { sign_in_provider: 'google.com' },
  }).firestore()
}

function eventDocument(id, overrides = {}) {
  return {
    id,
    title: 'Board meeting',
    date: '2026-10-18',
    timeType: 'timed',
    startTime: '12:00',
    endTime: '13:00',
    location: 'Room 1',
    description: '',
    category: 'Meeting',
    notes: '',
    creatorId: 'mahima-shah',
    updatedById: 'mahima-shah',
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
    status: 'Pending',
    comments: [],
    ...overrides,
  }
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
  const event = eventDocument('event-1')

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

test('chat message authors can edit and delete only their own messages', async () => {
  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')
  const message = {
    id: 'authored-message',
    memberId: 'mahima-shah',
    text: 'Original message',
    createdAt: '2026-10-18T12:00:00.000Z',
  }

  await assertSucceeds(setDoc(doc(mahima, 'chatMessages/authored-message'), message))
  await assertSucceeds(setDoc(doc(mahima, 'chatMessages/authored-message'), {
    ...message,
    text: 'Edited message',
    editedAt: '2026-10-18T12:01:00.000Z',
  }))
  await assertFails(setDoc(doc(nikhil, 'chatMessages/authored-message'), {
    ...message,
    text: 'Changed by someone else',
    editedAt: '2026-10-18T12:02:00.000Z',
  }))
  await assertFails(deleteDoc(doc(nikhil, 'chatMessages/authored-message')))
  await assertFails(setDoc(doc(mahima, 'chatMessages/authored-message'), {
    ...message,
    memberId: 'nikhil-nayak',
    text: 'Forged sender',
    editedAt: '2026-10-18T12:03:00.000Z',
  }))
  await assertSucceeds(deleteDoc(doc(mahima, 'chatMessages/authored-message')))
})

test('comment authors can edit and delete only their own comments without changing event fields', async () => {
  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')
  const event = eventDocument('comment-event')
  const mahimaComment = {
    id: 'comment-mahima',
    memberId: 'mahima-shah',
    text: 'Keep the original time',
    createdAt: '2026-10-18T12:00:00.000Z',
  }
  const nikhilComment = {
    id: 'comment-nikhil',
    memberId: 'nikhil-nayak',
    text: 'Looks good',
    createdAt: '2026-10-18T12:01:00.000Z',
  }

  await assertSucceeds(setDoc(doc(mahima, 'events/comment-event'), event))
  await assertSucceeds(setDoc(doc(nikhil, 'events/comment-event'), {
    ...event,
    comments: [nikhilComment],
  }))
  await assertFails(setDoc(doc(nikhil, 'events/comment-event'), {
    ...event,
    comments: [{ ...mahimaComment, text: 'Forged author' }],
  }))
  await assertSucceeds(setDoc(doc(mahima, 'events/comment-event'), {
    ...event,
    comments: [nikhilComment, mahimaComment],
  }))
  const bothComments = { ...event, comments: [nikhilComment, mahimaComment] }
  await assertSucceeds(setDoc(doc(nikhil, 'events/comment-event'), {
    ...bothComments,
    comments: [{ ...nikhilComment, text: 'Edited thought', editedAt: '2026-10-18T12:02:00.000Z' }, mahimaComment],
  }))
  await assertFails(setDoc(doc(nikhil, 'events/comment-event'), {
    ...bothComments,
    comments: [{ ...nikhilComment, text: 'Edited thought', editedAt: '2026-10-18T12:02:00.000Z' }, { ...mahimaComment, text: 'Edited by another member' }],
  }))
  await assertFails(setDoc(doc(nikhil, 'events/comment-event'), {
    ...bothComments,
    title: 'Changed protected event field',
    comments: [{ ...nikhilComment, text: 'Edited thought', editedAt: '2026-10-18T12:02:00.000Z' }, mahimaComment],
  }))
  await assertFails(setDoc(doc(nikhil, 'events/comment-event'), {
    ...bothComments,
    comments: [nikhilComment],
  }))
  await assertSucceeds(setDoc(doc(nikhil, 'events/comment-event'), {
    ...bothComments,
    comments: [mahimaComment],
  }))
  await assertSucceeds(setDoc(doc(mahima, 'events/comment-event'), {
    ...bothComments,
    comments: [],
  }))
})

test('accepts valid pending event creation and rejects forged fields or approval state', async () => {
  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')

  await assertSucceeds(setDoc(doc(mahima, 'events/valid-event'), eventDocument('valid-event')))
  await assertSucceeds(setDoc(doc(mahima, 'events/all-day-event'), eventDocument('all-day-event', {
    timeType: 'all-day',
    startTime: '',
    endTime: '',
  })))
  await assertSucceeds(setDoc(doc(mahima, 'events/recurring-event'), eventDocument('recurring-event', {
    recurrence: { frequency: 'weekly', endType: 'count', count: 8 },
  })))
  await assertSucceeds(setDoc(doc(mahima, 'events/monthly-date-pattern'), eventDocument('monthly-date-pattern', {
    recurrence: {
      frequency: 'monthly',
      monthlyPattern: { type: 'date', missingDateBehavior: 'last-day' },
      endType: 'count',
      count: 8,
    },
  })))
  await assertSucceeds(setDoc(doc(mahima, 'events/monthly-weekday-pattern'), eventDocument('monthly-weekday-pattern', {
    recurrence: {
      frequency: 'monthly',
      monthlyPattern: { type: 'weekday' },
      endType: 'date',
      endDate: '2027-10-18',
    },
  })))
  await assertSucceeds(setDoc(doc(mahima, 'events/date-ended-event'), eventDocument('date-ended-event', {
    recurrence: { frequency: 'monthly', endType: 'date', endDate: '2027-10-18' },
  })))
  let invalidIndex = 0
  for (const [field, value] of [
    ['approverId', 'mahima-shah'],
    ['decidedAt', '2026-10-18T12:00:00.000Z'],
    ['declineReason', 'Already declined'],
    ['unexpectedPermission', true],
    ['status', 'Approved'],
    ['recurrence', { frequency: 'yearly', endType: 'count', count: 5 }],
    ['recurrence', { frequency: 'daily', endType: 'count', count: 1 }],
    ['recurrence', { frequency: 'weekly', endType: 'date', endDate: '2026-10-17' }],
  ]) {
    const eventId = `invalid-event-${invalidIndex++}`
    await assertFails(setDoc(doc(mahima, `events/${eventId}`), eventDocument(eventId, {
      [field]: value,
    })))
  }
})

test('allows every roster member to create events and limits deletion to the creator or Erin', async () => {
  const approvedMembers = [
    ['mahima-shah', 'mahshah1@dunlapstudents.net'],
    ['nikhil-nayak', 'niknayak@dunlapstudents.net'],
    ['sana-shajahan', 'sanshajahan@dunlapstudents.net'],
    ['julia-charles', 'julcharles@dunlapstudents.net'],
    ['erin-copple', 'ecopple@dunlapcusd.net'],
    ['sanay-sumesh', 'sansumesh@dunlapstudents.net'],
    ['sayan-sumeeth', 'saysumeeth@dunlapstudents.net'],
    ['sitaara-jorden', 'sitjorden@dunlapstudents.net'],
    ['arvin-baviskar', 'arvbaviskar@dunlapstudents.net'],
    ['cora-bradley', 'corbradley@dunlapstudents.net'],
    ['laura-lang', 'laulang@dunlapstudents.net'],
    ['amili-sinha', 'amisinha@dunlapstudents.net'],
    ['chizara-opara', 'chiopara@dunlapstudents.net'],
    ['rishik-meduru', 'rismeduru@dunlapstudents.net'],
  ]
  for (const [memberId, email] of approvedMembers) {
    const member = googleMember(memberId, email)
    const eventId = `create-${memberId}`
    await assertSucceeds(setDoc(doc(member, `events/${eventId}`), eventDocument(eventId, {
      creatorId: memberId,
      updatedById: memberId,
    })))
  }

  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')
  const erin = googleMember('erin', 'ecopple@dunlapcusd.net')
  const ownedEvent = eventDocument('owned-event')
  await assertSucceeds(setDoc(doc(mahima, 'events/owned-event'), ownedEvent))
  await assertFails(deleteDoc(doc(nikhil, 'events/owned-event')))
  await assertFails(setDoc(doc(nikhil, 'events/owned-event'), {
    ...ownedEvent,
    excludedDates: ['2026-10-18'],
    updatedById: 'nikhil-nayak',
    updatedAt: '2026-10-18T12:01:00.000Z',
  }))
  await assertSucceeds(deleteDoc(doc(mahima, 'events/owned-event')))

  const recurring = eventDocument('recurring-owned-event', {
    recurrence: { frequency: 'weekly', endType: 'count', count: 4 },
  })
  await assertSucceeds(setDoc(doc(mahima, 'events/recurring-owned-event'), recurring))
  await assertSucceeds(setDoc(doc(nikhil, 'events/recurring-owned-event'), {
    ...recurring,
    futureChanges: [{ fromDate: '2026-10-25', changes: { location: 'Room 3' } }],
    updatedById: 'nikhil-nayak',
    updatedAt: '2026-10-18T12:01:30.000Z',
  }))
  await assertFails(setDoc(doc(nikhil, 'events/recurring-owned-event'), {
    ...recurring,
    futureChanges: [{ fromDate: '2026-10-25', changes: { location: 'Room 3' } }],
    recurrence: { frequency: 'weekly', endType: 'count', count: 2 },
    updatedById: 'nikhil-nayak',
    updatedAt: '2026-10-18T12:02:00.000Z',
  }))
  await assertSucceeds(setDoc(doc(mahima, 'events/recurring-owned-event'), {
    ...recurring,
    futureChanges: [{ fromDate: '2026-10-25', changes: { location: 'Room 3' } }],
    recurrence: { frequency: 'weekly', endType: 'count', count: 2 },
    updatedById: 'mahima-shah',
    updatedAt: '2026-10-18T12:02:00.000Z',
  }))

  await assertSucceeds(setDoc(doc(nikhil, 'events/another-member-event'), eventDocument('another-member-event', {
    creatorId: 'nikhil-nayak',
    updatedById: 'nikhil-nayak',
  })))
  await assertSucceeds(deleteDoc(doc(erin, 'events/another-member-event')))
})

test('ties event and chat authors to the authenticated roster identity', async () => {
  const mahima = googleMember('mahima', 'mahshah1@dunlapstudents.net')
  const nikhil = googleMember('nikhil', 'niknayak@dunlapstudents.net')

  await assertFails(setDoc(doc(nikhil, 'events/forged-comment-event'), eventDocument('forged-comment-event', {
    creatorId: 'nikhil-nayak',
    updatedById: 'nikhil-nayak',
    comments: [{ id: 'forged-comment', memberId: 'mahima-shah', text: 'Forged author', createdAt: '2026-10-18T12:00:00.000Z' }],
  })))
  await assertFails(setDoc(doc(nikhil, 'events/forged-event'), eventDocument('forged-event')))
  await assertFails(setDoc(doc(nikhil, 'chatMessages/forged-message'), {
    id: 'forged-message',
    memberId: 'mahima-shah',
    text: 'Forged identity',
    createdAt: '2026-10-18T12:00:00.000Z',
  }))
  const immutableAuthorEvent = eventDocument('immutable-author-event')
  await assertSucceeds(setDoc(doc(mahima, 'events/immutable-author-event'), immutableAuthorEvent))
  await assertFails(setDoc(doc(nikhil, 'events/immutable-author-event'), {
    ...immutableAuthorEvent,
    title: 'Edited while impersonating Mahima',
  }))
  await assertFails(setDoc(doc(nikhil, 'events/immutable-author-event'), {
    ...immutableAuthorEvent,
    approverId: 'mahima-shah',
    decidedAt: '2026-10-18T12:01:00.000Z',
    updatedAt: '2026-10-18T12:01:00.000Z',
    status: 'Approved',
  }))
  await assertSucceeds(setDoc(doc(mahima, 'chatMessages/immutable-message'), {
    id: 'immutable-message',
    memberId: 'mahima-shah',
    text: 'Original',
    createdAt: '2026-10-18T12:00:00.000Z',
  }))
  await assertFails(setDoc(doc(nikhil, 'chatMessages/immutable-message'), {
    id: 'immutable-message',
    memberId: 'nikhil-nayak',
    text: 'Overwritten by another member',
    createdAt: '2026-10-18T12:01:00.000Z',
  }))
  await assertFails(setDoc(doc(nikhil, 'chatMessages/immutable-message'), {
    id: 'immutable-message',
    memberId: 'mahima-shah',
    text: 'Original',
    createdAt: '2026-10-18T12:00:00.000Z',
  }, { merge: true }))
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
  await assertFails(setDoc(doc(approved, 'members/mahima-shah'), {
    id: 'nikhil-nayak',
    name: 'Nikhil Nayak',
    role: 'Co-President',
    email: 'niknayak@dunlapstudents.net',
  }))
})
