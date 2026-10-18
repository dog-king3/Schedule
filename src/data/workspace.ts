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
}

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
