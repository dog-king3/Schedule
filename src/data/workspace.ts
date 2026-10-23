import type { Member } from './members'

export type EventStatus = 'Pending' | 'Approved' | 'Declined'
export type EventCategory = 'Meeting' | 'Activity' | 'Deadline'
export type EventTimeType = 'timed' | 'panther-pride' | 'all-day'
export type TaskStatus = 'To do' | 'In progress' | 'Completed'

export type EventComment = {
  id: string
  memberId: string
  text: string
  createdAt: string
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'
export type RecurrenceRule = {
  frequency: RecurrenceFrequency
  endType: 'date' | 'count'
  endDate?: string
  count?: number
}

export type RecurrenceChanges = {
  fromDate: string
  changes: Partial<Pick<CouncilEvent, 'title' | 'timeType' | 'startTime' | 'endTime' | 'location' | 'description' | 'category' | 'notes'>>
}

export type CouncilEvent = {
  id: string
  title: string
  date: string
  timeType: EventTimeType
  startTime: string
  endTime: string
  location: string
  description: string
  category: EventCategory
  notes: string
  creatorId: string
  updatedById?: string
  createdAt: string
  updatedAt: string
  status: EventStatus
  approverId?: string
  decidedAt?: string
  declineReason?: string
  comments: EventComment[]
  recurrence?: RecurrenceRule
  excludedDates?: string[]
  occurrenceOverrides?: Record<string, Partial<Pick<CouncilEvent, 'title' | 'timeType' | 'startTime' | 'endTime' | 'location' | 'description' | 'category' | 'notes'>>>
  futureChanges?: RecurrenceChanges[]
}

export type CalendarEventInstance = CouncilEvent & { instanceId: string }

export type ChatMessage = {
  id: string
  memberId: string
  text: string
  createdAt: string
}

export type CouncilTask = {
  id: string
  title: string
  description: string
  assigneeId: string
  dueDate: string
  status: TaskStatus
  eventId: string
  createdAt: string
  updatedAt: string
}

export type AgendaItem = {
  id: string
  eventId: string
  text: string
  completed: boolean
  createdAt: string
}

export type DirectoryMember = Member

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function toLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addCalendarDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

export function getOccurrenceDates(event: CouncilEvent, throughDate?: string, fromDate?: string): string[] {
  if (!event.recurrence) return [event.date]
  const rule = event.recurrence
  const result: string[] = []
  const dayOfMonth = Number(event.date.slice(8, 10))
  const dayDifference = fromDate
    ? Math.max(0, Math.floor((Date.parse(`${fromDate}T00:00:00Z`) - Date.parse(`${event.date}T00:00:00Z`)) / 86_400_000))
    : 0
  let index = rule.frequency === 'daily'
    ? dayDifference
    : rule.frequency === 'weekly'
      ? Math.ceil(dayDifference / 7)
      : fromDate
        ? Math.max(0, (Number(fromDate.slice(0, 4)) - Number(event.date.slice(0, 4))) * 12 + Number(fromDate.slice(5, 7)) - Number(event.date.slice(5, 7)))
        : 0
  let occurrenceNumber = 0
  if (rule.frequency === 'daily') occurrenceNumber = index
  else if (rule.frequency === 'weekly') occurrenceNumber = index
  else {
    for (let monthIndex = 0; monthIndex < index; monthIndex += 1) {
      const [year, month] = event.date.split('-').map(Number)
      const monthDate = new Date(Date.UTC(year, month - 1 + monthIndex, 1, 12))
      if (dayOfMonth <= new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate()) occurrenceNumber += 1
    }
  }
  for (; ;) {
    let candidate: string
    if (rule.frequency === 'daily') {
      candidate = addCalendarDays(event.date, index)
    } else if (rule.frequency === 'weekly') {
      candidate = addCalendarDays(event.date, index * 7)
    } else {
      const [year, month] = event.date.split('-').map(Number)
      const monthDate = new Date(Date.UTC(year, month - 1 + index, 1, 12))
      if (dayOfMonth > new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate()) {
        index += 1
        continue
      }
      candidate = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
    }
    if (rule.endType === 'date' && rule.endDate && candidate > rule.endDate) break
    if (throughDate && candidate > throughDate) break
    if (rule.endType === 'count' && occurrenceNumber >= (rule.count ?? 1)) break
    if (!fromDate || candidate >= fromDate) result.push(candidate)
    occurrenceNumber += 1
    if (!fromDate && !throughDate && result.length >= 3660) break
    index += 1
  }
  return result
}

export function expandCalendarEvents(events: CouncilEvent[], fromDate?: string, throughDate?: string): CalendarEventInstance[] {
  return events.flatMap((event) => {
    if (!event.recurrence && ((fromDate && event.date < fromDate) || (throughDate && event.date > throughDate))) return []
    const excluded = new Set(Array.isArray(event.excludedDates) ? event.excludedDates.filter((date) => typeof date === 'string') : [])
    const dates = getOccurrenceDates(event, throughDate, fromDate)
    return dates.filter((date) => !excluded.has(date)).map((date) => {
      const futureChanges = (Array.isArray(event.futureChanges) ? event.futureChanges : [])
        .filter((item) => typeof item.fromDate === 'string' && item.fromDate <= date)
        .reduce((changes, item) => ({ ...changes, ...validOccurrenceChanges(item.changes) }), {})
      const overrides = validOccurrenceChanges(event.occurrenceOverrides?.[date])
      return {
        ...event,
        ...futureChanges,
        ...overrides,
        date,
        instanceId: `${event.id}::${date}`,
      }
    })
  })
}

function validOccurrenceChanges(value: unknown): RecurrenceChanges['changes'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const changes: RecurrenceChanges['changes'] = {}
  if (typeof input.title === 'string' && input.title.length <= 100) changes.title = input.title
  if (input.timeType === 'timed' || input.timeType === 'panther-pride' || input.timeType === 'all-day') changes.timeType = input.timeType
  if (typeof input.startTime === 'string') changes.startTime = input.startTime
  if (typeof input.endTime === 'string') changes.endTime = input.endTime
  if (typeof input.location === 'string' && input.location.length <= 120) changes.location = input.location
  if (typeof input.description === 'string' && input.description.length <= 1000) changes.description = input.description
  if (input.category === 'Meeting' || input.category === 'Activity' || input.category === 'Deadline') changes.category = input.category
  if (typeof input.notes === 'string' && input.notes.length <= 1000) changes.notes = input.notes
  return changes
}

export function countOccurrencesBefore(event: CouncilEvent, date: string): number {
  return getOccurrenceDates(event, addCalendarDays(date, -1)).length
}

export function excludeEventOccurrence(event: CouncilEvent, date: string, memberId: string, updatedAt: string): CouncilEvent {
  return {
    ...event,
    excludedDates: [...new Set([...(event.excludedDates ?? []), date])],
    updatedById: memberId,
    updatedAt,
  }
}

export function editEventOccurrence(
  event: CouncilEvent,
  date: string,
  changes: RecurrenceChanges['changes'],
  memberId: string,
  updatedAt: string,
): CouncilEvent {
  return {
    ...event,
    occurrenceOverrides: { ...event.occurrenceOverrides, [date]: changes },
    updatedById: memberId,
    updatedAt,
  }
}

export function editFutureOccurrences(
  event: CouncilEvent,
  date: string,
  changes: RecurrenceChanges['changes'],
  memberId: string,
  updatedAt: string,
): CouncilEvent {
  return {
    ...event,
    futureChanges: [...(event.futureChanges ?? []), { fromDate: date, changes }],
    updatedById: memberId,
    updatedAt,
  }
}

export function truncateEventSeriesAt(
  event: CouncilEvent,
  date: string,
  memberId: string,
  updatedAt: string,
): CouncilEvent | null {
  if (!event.recurrence) return null
  const priorCount = countOccurrencesBefore(event, date)
  if (!priorCount) return null
  if (event.recurrence.endType === 'count' && priorCount === 1) {
    const { recurrence: _recurrence, ...singleEvent } = event
    return { ...singleEvent, updatedById: memberId, updatedAt }
  }
  return {
    ...event,
    recurrence: event.recurrence.endType === 'count'
      ? { ...event.recurrence, count: priorCount }
      : { ...event.recurrence, endDate: addCalendarDays(date, -1) },
    updatedById: memberId,
    updatedAt,
  }
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'America/Chicago' })
    .format(new Date(year, month - 1, day, 12))
}

export function formatTime(time: string): string {
  if (!time) return ''
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

export function getInitials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}
