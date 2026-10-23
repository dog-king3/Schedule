import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/data/workspace.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const {
  countOccurrencesBefore,
  editEventOccurrence,
  editFutureOccurrences,
  expandCalendarEvents,
  excludeEventOccurrence,
  getOccurrenceDates,
  truncateEventSeriesAt,
} = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
)

const baseEvent = {
  id: 'series-1',
  title: 'Board meeting',
  date: '2026-10-01',
  timeType: 'timed',
  startTime: '12:00',
  endTime: '13:00',
  location: '',
  description: '',
  category: 'Meeting',
  notes: '',
  creatorId: 'mahima-shah',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  status: 'Pending',
  comments: [],
}

test('daily and weekly recurrences include the first date and respect count/date boundaries', () => {
  assert.deepEqual(getOccurrenceDates({
    ...baseEvent,
    recurrence: { frequency: 'daily', endType: 'count', count: 3 },
  }), ['2026-10-01', '2026-10-02', '2026-10-03'])
  assert.deepEqual(getOccurrenceDates({
    ...baseEvent,
    recurrence: { frequency: 'weekly', endType: 'date', endDate: '2026-10-15' },
  }), ['2026-10-01', '2026-10-08', '2026-10-15'])
  assert.equal(countOccurrencesBefore({
    ...baseEvent,
    recurrence: { frequency: 'daily', endType: 'count', count: 5 },
  }, '2026-10-04'), 3)
})

test('monthly recurrence skips months without the original day and honors the inclusive end', () => {
  const monthly = {
    ...baseEvent,
    date: '2026-01-31',
    recurrence: { frequency: 'monthly', endType: 'date', endDate: '2026-05-31' },
  }
  assert.deepEqual(getOccurrenceDates(monthly), ['2026-01-31', '2026-03-31', '2026-05-31'])
  assert.deepEqual(getOccurrenceDates(monthly, '2026-05-31', '2026-03-01'), ['2026-03-31', '2026-05-31'])
})

test('recurring instances are stable, shared-data-derived, and apply exclusions and edits by date', () => {
  const event = {
    ...baseEvent,
    recurrence: { frequency: 'daily', endType: 'count', count: 4 },
    excludedDates: ['2026-10-02'],
    occurrenceOverrides: { '2026-10-03': { title: 'One-time title' } },
    futureChanges: [{ fromDate: '2026-10-04', changes: { location: 'Room 2', status: 'Approved', creatorId: 'nikhil-nayak' } }],
  }
  const firstExpansion = expandCalendarEvents([event])
  const secondExpansion = expandCalendarEvents([event])
  assert.deepEqual(firstExpansion.map(({ date, title, location, instanceId }) => [date, title, location, instanceId]), [
    ['2026-10-01', 'Board meeting', '', 'series-1::2026-10-01'],
    ['2026-10-03', 'One-time title', '', 'series-1::2026-10-03'],
    ['2026-10-04', 'Board meeting', 'Room 2', 'series-1::2026-10-04'],
  ])
  assert.deepEqual(firstExpansion.map((item) => item.instanceId), secondExpansion.map((item) => item.instanceId))
  assert.equal(firstExpansion[2].status, 'Pending')
  assert.equal(firstExpansion[2].creatorId, 'mahima-shah')
})

test('occurrence edits and deletions preserve the series and its comments', () => {
  const event = {
    ...baseEvent,
    comments: [{ id: 'comment-1', memberId: 'mahima-shah', text: 'Keep this', createdAt: '2026-10-01T12:00:00.000Z' }],
    recurrence: { frequency: 'weekly', endType: 'count', count: 4 },
  }
  const occurrenceEdited = editEventOccurrence(event, '2026-10-08', { title: 'One date only' }, 'nikhil-nayak', '2026-10-02T00:00:00.000Z')
  assert.deepEqual(expandCalendarEvents([occurrenceEdited]).map(({ date, title }) => [date, title]), [
    ['2026-10-01', 'Board meeting'],
    ['2026-10-08', 'One date only'],
    ['2026-10-15', 'Board meeting'],
    ['2026-10-22', 'Board meeting'],
  ])
  const excluded = excludeEventOccurrence(occurrenceEdited, '2026-10-15', 'mahima-shah', '2026-10-03T00:00:00.000Z')
  assert.deepEqual(expandCalendarEvents([excluded]).map(({ date }) => date), ['2026-10-01', '2026-10-08', '2026-10-22'])
  assert.deepEqual(excluded.comments, event.comments)
  const editedFuture = editFutureOccurrences(event, '2026-10-15', { location: 'Room 2' }, 'mahima-shah', '2026-10-04T00:00:00.000Z')
  assert.deepEqual(expandCalendarEvents([editedFuture]).map(({ location }) => location), ['', '', 'Room 2', 'Room 2'])
  assert.deepEqual(editedFuture.comments, event.comments)
})

test('future-series deletion truncates at the selected date without removing prior occurrences', () => {
  const event = {
    ...baseEvent,
    comments: [{ id: 'comment-1', memberId: 'mahima-shah', text: 'Preserved', createdAt: '2026-10-01T12:00:00.000Z' }],
    recurrence: { frequency: 'daily', endType: 'count', count: 5 },
  }
  const truncated = truncateEventSeriesAt(event, '2026-10-04', 'mahima-shah', '2026-10-03T00:00:00.000Z')
  assert.deepEqual(getOccurrenceDates(truncated), ['2026-10-01', '2026-10-02', '2026-10-03'])
  assert.deepEqual(truncated.comments, event.comments)
  assert.equal(truncateEventSeriesAt(event, '2026-10-01', 'mahima-shah', '2026-10-03T00:00:00.000Z'), null)

  const dateEnded = { ...event, recurrence: { frequency: 'daily', endType: 'date', endDate: '2026-10-05' } }
  const dateTruncated = truncateEventSeriesAt(dateEnded, '2026-10-04', 'mahima-shah', '2026-10-03T00:00:00.000Z')
  assert.equal(dateTruncated.recurrence.endDate, '2026-10-03')
})
