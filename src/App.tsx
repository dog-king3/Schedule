import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, ClipboardList, Clock3, LogOut, MessageCircle, Moon, MoreHorizontal,
  Plus, Repeat, Search, Send, Sun, UsersRound, X,
} from 'lucide-react'
import { getMemberByEmail, getInitials, members as roster } from './data/members'
import { auth, firebaseConfigured, firebaseErrorMessage } from './data/firebase'
import { useFirestoreCollection, type FirestoreSetter } from './data/firestore'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import {
  addCalendarDays, createId, formatDate, formatDateTime, formatTime, toLocalDate,
  editEventOccurrence, editFutureOccurrences, expandCalendarEvents, excludeEventOccurrence,
  truncateEventSeriesAt,
  type AgendaItem, type CalendarEventInstance, type ChatMessage, type CouncilEvent, type CouncilTask, type DirectoryMember,
  type EventCategory, type EventTimeType, type RecurrenceFrequency, type RecurrenceRule, type TaskStatus,
} from './data/workspace'
import './App.css'

type Page = 'Calendar' | 'Chat' | 'Tasks & Agenda' | 'Members'
type CalendarView = 'Month' | 'Week' | 'Agenda'
type Theme = 'light' | 'dark'

const navItems: { name: Page; icon: typeof CalendarDays }[] = [
  { name: 'Calendar', icon: CalendarDays },
  { name: 'Chat', icon: MessageCircle },
  { name: 'Tasks & Agenda', icon: ClipboardList },
  { name: 'Members', icon: UsersRound },
]

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem('dms-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return [theme, (next: Theme) => {
    window.localStorage.setItem('dms-theme', next)
    setTheme(next)
  }] as const
}

function App() {
  const [theme, setTheme] = useTheme()
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(firebaseConfigured)
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('Calendar')
  const [cloudError, setCloudError] = useState('')
  const activeMember = getMemberByEmail(firebaseUser?.email)
  const authorized = Boolean(firebaseUser && activeMember)
  const [events, setEvents, eventsLoading] = useFirestoreCollection<CouncilEvent>('events', authorized)
  const [messages, setMessages, messagesLoading] = useFirestoreCollection<ChatMessage>('chatMessages', authorized)
  const [tasks, setTasks] = useFirestoreCollection<CouncilTask>('tasks', authorized)
  const [agendaItems, setAgendaItems] = useFirestoreCollection<AgendaItem>('agendaItems', authorized)
  const [directoryMembers, , membersLoading] = useFirestoreCollection<DirectoryMember>('members', authorized, roster)

  useEffect(() => {
    const firebaseAuth = auth
    if (!firebaseAuth) {
      return
    }

    return onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user)
      setAuthLoading(false)
      if (user && !getMemberByEmail(user.email)) {
        setAuthError(`Access denied. ${user.email ?? 'This Google account'} is not on the approved council roster.`)
        signOut(firebaseAuth).catch((error: unknown) => {
          setAuthError(`Access denied, and sign-out failed: ${firebaseErrorMessage(error)}`)
        })
      } else if (user) {
        setAuthError('')
      }
    }, (error) => {
      setAuthError(`Could not check Google sign-in: ${firebaseErrorMessage(error)}`)
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    const handleCloudError = (event: Event) => setCloudError((event as CustomEvent<string>).detail)
    window.addEventListener('dms-cloud-error', handleCloudError)
    return () => window.removeEventListener('dms-cloud-error', handleCloudError)
  }, [])

  async function googleSignIn() {
    if (!auth) return
    setAuthError('')
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      if (!getMemberByEmail(result.user.email)) {
        await signOut(auth)
        setAuthError(`Access denied. ${result.user.email ?? 'This Google account'} is not on the approved council roster.`)
      }
    } catch (error) {
      setAuthError(`Google sign-in failed: ${firebaseErrorMessage(error)}`)
    }
  }

  async function googleSignOut() {
    if (!auth) return
    try {
      await signOut(auth)
      setFirebaseUser(null)
      setAuthError('')
    } catch (error) {
      setAuthError(`Could not sign out: ${firebaseErrorMessage(error)}`)
    }
  }

  if (authLoading) {
    return <SignIn configured={firebaseConfigured} loading onGoogleSignIn={googleSignIn} error={authError} />
  }
  if (!activeMember) {
    return <SignIn configured={firebaseConfigured} loading={false} onGoogleSignIn={googleSignIn} error={authError} />
  }

  const activePage = {
    Calendar: <CalendarPage currentMemberId={activeMember.id} events={events} setEvents={setEvents} />,
    Chat: <ChatPage currentMemberId={activeMember.id} messages={messages} setMessages={setMessages} />,
    'Tasks & Agenda': <TasksPage currentMemberId={activeMember.id} events={events} tasks={tasks} setTasks={setTasks} agendaItems={agendaItems} setAgendaItems={setAgendaItems} />,
    Members: <MembersPage members={directoryMembers.length ? directoryMembers : roster} />,
  }[page]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="#" onClick={(event) => { event.preventDefault(); setPage('Calendar') }}>
          <span className="brand-mark">D</span>
          <span className="brand-name">DMS <strong>Student Council</strong><small>EXECUTIVE BOARD</small></span>
        </a>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="main-navigation" aria-label="Main navigation">
          {navItems.map(({ name, icon: Icon }) => (
            <button key={name} className={`nav-item ${page === name ? 'is-active' : ''}`} type="button" onClick={() => setPage(name)} aria-current={page === name ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.9} /><span>{name}</span>{page === name && <span className="active-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="sidebar-note-icon"><CalendarDays size={16} /></span><span>Board schedule<small>America / Chicago</small></span></div>
          <div className="profile-row">
            <span className="avatar">{getInitials(activeMember.name)}</span>
            <span className="profile-name"><strong>{activeMember.name}</strong><small>{activeMember.role}</small></span>
            <button className="logout-button" type="button" onClick={googleSignOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span className="breadcrumb-brand">DMS Student Council</span> <span className="breadcrumb-slash">/</span> <strong>{page}</strong></div>
          <div className="topbar-actions">
            <span className="topbar-member">
              <span className="topbar-avatar">{getInitials(activeMember.name)}</span>
              <span className="topbar-identity"><strong>{activeMember.name}</strong><small>{activeMember.role}</small></span>
            </span>
            <button className="icon-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title="Switch theme">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button className="icon-button mobile-signout" type="button" onClick={googleSignOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </header>
        {(cloudError || (eventsLoading || messagesLoading || membersLoading)) && <div className="storage-alert" role={cloudError ? 'alert' : 'status'}><span>{cloudError || 'Syncing shared council workspace…'}</span><button type="button" aria-label="Dismiss message" onClick={() => setCloudError('')}><X size={15} /></button></div>}
        <div className="page-content">{activePage}</div>
      </main>
      <MobileNavigation page={page} onPageChange={setPage} />
    </div>
  )
}

function SignIn({ configured, loading, onGoogleSignIn, error }: { configured: boolean; loading: boolean; onGoogleSignIn: () => void; error: string }) {
  return (
    <main className="signin-screen">
      <section className="signin-card">
        <div className="signin-logo"><span className="brand-mark">D</span></div>
        <p className="signin-kicker">EXECUTIVE BOARD</p>
        <h1>DMS Student Council</h1>
        <p className="signin-subtitle">Sign in with your approved council Google account.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!configured && <p className="form-error" role="status">Firebase is not configured yet. Add the Firebase web app settings to your local environment before signing in.</p>}
        <button className="button button-primary signin-submit" type="button" onClick={onGoogleSignIn} disabled={!configured || loading}>
          {loading ? 'Checking sign-in…' : 'Continue with Google'}
        </button>
        <p className="signin-note">Only Google accounts matching the approved council roster can access this workspace.</p>
      </section>
    </main>
  )
}

function MobileNavigation({ page, onPageChange }: { page: Page; onPageChange: (page: Page) => void }) {
  return <nav className="mobile-navigation" aria-label="Main navigation">
    {navItems.map(({ name, icon: Icon }) => <button key={name} type="button" className={page === name ? 'is-active' : ''} onClick={() => onPageChange(name)} aria-current={page === name ? 'page' : undefined}><Icon size={19} /><span>{name === 'Tasks & Agenda' ? 'Tasks' : name}</span></button>)}
  </nav>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading">
    <div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>
    {action}
  </div>
}

function CalendarPage({ currentMemberId, events, setEvents }: {
  currentMemberId: string; events: CouncilEvent[]; setEvents: FirestoreSetter<CouncilEvent>
}) {
  const [view, setView] = useState<CalendarView>('Month')
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [todayKey] = useState(() => toLocalDate(new Date()))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventInstance | null>(null)
  const [formEvent, setFormEvent] = useState<CouncilEvent | null | undefined>(undefined)
  const [newEventDate, setNewEventDate] = useState('')
  const [editOccurrenceDate, setEditOccurrenceDate] = useState('')
  const [seriesStartDate, setSeriesStartDate] = useState('')
  const rangeStart = useMemo(() => {
    if (view === 'Agenda') {
      const monthStart = toLocalDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1))
      const isCurrentMonth = cursorDate.getFullYear() === Number(todayKey.slice(0, 4))
        && cursorDate.getMonth() === Number(todayKey.slice(5, 7)) - 1
      return isCurrentMonth ? todayKey : monthStart
    }
    const start = new Date(cursorDate)
    if (view === 'Month') start.setDate(1)
    start.setDate(start.getDate() - start.getDay())
    return toLocalDate(start)
  }, [view, cursorDate, todayKey])
  const rangeEnd = view === 'Month'
    ? addCalendarDays(rangeStart, 41)
    : view === 'Week' ? addCalendarDays(rangeStart, 6) : addCalendarDays(rangeStart, 365)
  const expandedEvents = useMemo(() => expandCalendarEvents(events, rangeStart, rangeEnd), [events, rangeStart, rangeEnd])
  const filteredEvents = useMemo(() => expandedEvents.filter((event) =>
    event.title.toLowerCase().includes(search.toLowerCase())
    && (category === 'All categories' || event.category === category)
  ), [expandedEvents, search, category])
  const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(cursorDate)
  const upcomingEvents = useMemo(() => expandCalendarEvents(events, todayKey, addCalendarDays(todayKey, 365))
    .filter((event) => event.status === 'Approved').sort(compareEvents).slice(0, 4), [events, todayKey])

  function navigate(direction: number) {
    const next = new Date(cursorDate)
    if (view === 'Month') next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + direction * (view === 'Week' ? 7 : 1))
    setCursorDate(next)
  }

  function addEvent(date = toLocalDate(cursorDate)) {
    setNewEventDate(date)
    setFormEvent(null)
  }

  const heading = view === 'Month' ? monthTitle : view === 'Week' ? weekHeading(cursorDate) : 'Upcoming events'
  return <>
    <PageHeading eyebrow="YOUR BOARD AT A GLANCE" title="Calendar" description="Meetings, activities, and deadlines for the executive board."
      action={<button className="button button-primary" type="button" onClick={() => addEvent()}><Plus size={17} /> Add Event</button>} />
    <section className="calendar-tools panel">
      <div className="calendar-navigation">
        <div className="calendar-arrows">
          <button className="icon-button" type="button" onClick={() => navigate(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
          <button className="icon-button" type="button" onClick={() => navigate(1)} aria-label="Next"><ChevronRight size={18} /></button>
        </div>
        <button className="button button-secondary today-button" type="button" onClick={() => setCursorDate(new Date())}>Today</button>
        <h2 className="calendar-period">{heading}</h2>
      </div>
      <div className="calendar-filters">
        <label className="search-control"><Search size={15} /><input aria-label="Search events" placeholder="Search events" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select className="select-control" aria-label="Filter category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option>All categories</option><option>Meeting</option><option>Activity</option><option>Deadline</option>
        </select>
        <div className="view-switch" aria-label="Calendar view">
          {(['Month', 'Week', 'Agenda'] as const).map((item) => <button key={item} type="button" className={view === item ? 'selected' : ''} onClick={() => setView(item)}>{item}</button>)}
        </div>
      </div>
    </section>
    <div className="calendar-layout">
      <section className="panel calendar-panel" aria-label={`${view} calendar`}>
        {view === 'Month' && <MonthCalendar date={cursorDate} todayKey={todayKey} events={filteredEvents} onDayClick={addEvent} onEventClick={setSelectedEvent} />}
        {view === 'Week' && <WeekCalendar date={cursorDate} todayKey={todayKey} events={filteredEvents} onEventClick={setSelectedEvent} onDayClick={addEvent} />}
        {view === 'Agenda' && <AgendaCalendar date={cursorDate} todayKey={todayKey} events={filteredEvents} onEventClick={setSelectedEvent} onAdd={() => addEvent()} />}
        {view !== 'Agenda' && <div className="calendar-legend"><span><i className="legend-dot orange" /> Meeting</span><span><i className="legend-dot blue" /> Activity / deadline</span><span><i className="legend-dot gray" /> Pending proposal</span></div>}
      </section>
      <aside className="upcoming-panel panel">
        <div className="panel-heading"><div><h2>Upcoming meetings</h2><p>Confirmed board events</p></div><CalendarDays size={18} /></div>
        {upcomingEvents.length ? <div className="upcoming-list">{upcomingEvents.map((event) => <button className="upcoming-item" key={event.instanceId} type="button" onClick={() => setSelectedEvent(event)}>
          <span className={`upcoming-date ${event.category.toLowerCase()}`}><strong>{Number(event.date.slice(8))}</strong><small>{formatDate(event.date, { month: 'short' })}</small></span>
          <span className="upcoming-copy"><strong>{event.title}</strong><small>{eventTimeLabel(event)}{event.location ? ` · ${event.location}` : ''}</small></span>
        </button>)}</div> : <div className="mini-empty"><CalendarDays size={21} /><p>No confirmed meetings yet.</p></div>}
        <div className="proposal-summary"><span className="status-dot pending" />{events.filter((event) => event.status === 'Pending').length} pending {events.filter((event) => event.status === 'Pending').length === 1 ? 'event' : 'events'}</div>
        <p className="subtle-hint">Any approved board member can review event proposals.</p>
      </aside>
    </div>
    {formEvent !== undefined && <EventForm event={formEvent} initialDate={newEventDate} occurrenceDate={editOccurrenceDate} seriesStartDate={seriesStartDate} currentMemberId={currentMemberId} onClose={() => setFormEvent(undefined)} onSave={(event, scope, occurrenceDate) => {
      setEvents((old) => {
        if (!formEvent) return [...old, event]
        return old.map((item) => {
          if (item.id !== event.id) return item
          if (!item.recurrence || scope === 'series') return event
          const changes = editableEventFields(event)
          const updatedAt = event.updatedAt
          if (scope === 'occurrence') {
            return editEventOccurrence(item, occurrenceDate, changes, currentMemberId, updatedAt)
          }
          return editFutureOccurrences(item, occurrenceDate, changes, currentMemberId, updatedAt)
        })
      })
      setFormEvent(undefined)
    }} />}
    {selectedEvent && <EventDetails event={selectedEvent} currentMemberId={currentMemberId} canDelete={currentMemberId === 'erin-copple' || currentMemberId === selectedEvent.creatorId} onClose={() => setSelectedEvent(null)} onEdit={() => {
      const series = events.find((event) => event.id === selectedEvent.id)
      if (!series) return
      setEditOccurrenceDate(selectedEvent.date)
      setSeriesStartDate(series.date)
      const { instanceId: _instanceId, ...occurrence } = selectedEvent
      setFormEvent({ ...series, ...occurrence })
      setSelectedEvent(null)
    }} onUpdate={(updated) => {
      const workflowUpdate = {
        comments: updated.comments,
        status: updated.status,
        updatedById: updated.updatedById,
        updatedAt: updated.updatedAt,
        approverId: updated.approverId,
        decidedAt: updated.decidedAt,
        declineReason: updated.declineReason,
      }
      setEvents((old) => old.map((event) => event.id === updated.id ? { ...event, ...workflowUpdate } : event))
      setSelectedEvent((current) => current ? { ...current, ...workflowUpdate } : current)
    }} onDelete={(scope) => {
      const master = events.find((event) => event.id === selectedEvent.id)
      if (!master) return
      if (scope === 'series' || !master.recurrence) {
        if (!window.confirm(`Delete "${master.title}"${master.recurrence ? ' and its entire series' : ''}? This cannot be undone.`)) return
        setEvents((old) => old.filter((event) => event.id !== master.id))
      } else if (scope === 'occurrence') {
        if (!window.confirm(`Delete only the ${formatDate(selectedEvent.date)} occurrence?`)) return
        setEvents((old) => old.map((event) => event.id === master.id
          ? excludeEventOccurrence(event, selectedEvent.date, currentMemberId, new Date().toISOString())
          : event))
      } else {
        if (!window.confirm(`Delete this and all future occurrences starting ${formatDate(selectedEvent.date)}?`)) return
        const truncated = truncateEventSeriesAt(master, selectedEvent.date, currentMemberId, new Date().toISOString())
        if (!truncated) {
          setEvents((old) => old.filter((event) => event.id !== master.id))
        } else {
          setEvents((old) => old.map((event) => event.id === master.id ? truncated : event))
        }
      }
      setSelectedEvent(null)
    }} />}
  </>
}

function editableEventFields(event: CouncilEvent) {
  return {
    title: event.title, timeType: event.timeType, startTime: event.startTime, endTime: event.endTime,
    location: event.location, description: event.description, category: event.category, notes: event.notes,
  }
}

function compareEvents(a: CouncilEvent, b: CouncilEvent) {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt)
}

function weekHeading(date: Date) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`
}

function eventTimeLabel(event: CouncilEvent) {
  if (event.timeType === 'panther-pride') return 'Panther Pride'
  if (event.timeType === 'all-day') return 'All day'
  return `${formatTime(event.startTime)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}`
}

function recurrenceLabel(event: CouncilEvent) {
  if (!event.recurrence) return ''
  return `Repeats ${event.recurrence.frequency}`
}

function chicagoDate(timestamp: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function EventPill({ event, onClick }: { event: CalendarEventInstance; onClick: (event: CalendarEventInstance) => void }) {
  return <button type="button" className={`event-pill ${event.category.toLowerCase()} ${event.status.toLowerCase()}`} onClick={(click) => { click.stopPropagation(); onClick(event) }}>
    <span className="event-pill-time">{event.timeType === 'timed' ? formatTime(event.startTime) : event.timeType === 'panther-pride' ? 'PP' : ''}</span>
    <span className="event-pill-title">{event.title}</span>
    {event.status === 'Pending' && <span className="event-pending-dot" aria-label="Pending approval" />}
  </button>
}

function MonthCalendar({ date, todayKey, events, onDayClick, onEventClick }: { date: Date; todayKey: string; events: CalendarEventInstance[]; onDayClick: (date: string) => void; onEventClick: (event: CalendarEventInstance) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const activeMonthEvents = events.filter((event) => event.status !== 'Declined' && event.date.startsWith(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`))
  return <div className="month-grid">
    <div className="weekday-row">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="month-cells">{Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      const dayKey = toLocalDate(day)
      const dayEvents = events.filter((event) => event.date === dayKey && event.status !== 'Declined').sort(compareEvents)
      const visibleDayEvents = dayEvents.filter((event) => event.status !== 'Declined')
      return <div key={dayKey} className={`month-cell ${day.getMonth() !== date.getMonth() ? 'outside-month' : ''} ${dayKey === todayKey ? 'is-today' : ''}`} role="button" tabIndex={0} aria-label={`${formatDate(dayKey)}${visibleDayEvents.length ? `, ${visibleDayEvents.length} events` : ''}`} onClick={() => onDayClick(dayKey)} onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onDayClick(dayKey)
        }
      }}>
        <span className="day-number">{day.getDate()}</span>
        <div className="cell-events">{visibleDayEvents.slice(0, 3).map((event) => <EventPill key={event.instanceId} event={event} onClick={() => onEventClick(event)} />)}{visibleDayEvents.length > 3 && <span className="more-events">+{visibleDayEvents.length - 3} more</span>}</div>
      </div>
    })}</div>
    {!activeMonthEvents.length && <div className="month-empty-state"><span>No events this month.</span><button type="button" onClick={() => onDayClick(toLocalDate(new Date(date.getFullYear(), date.getMonth(), 1)))}><Plus size={13} /> Add an event</button></div>}
  </div>
}

function WeekCalendar({ date, todayKey, events, onEventClick, onDayClick }: { date: Date; todayKey: string; events: CalendarEventInstance[]; onEventClick: (event: CalendarEventInstance) => void; onDayClick: (date: string) => void }) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
  return <div className="week-grid">
    {days.map((day) => {
      const key = toLocalDate(day)
      const dayEvents = events.filter((event) => event.date === key && event.status !== 'Declined').sort(compareEvents)
      return <section className={`week-day ${key === todayKey ? 'is-today' : ''}`} key={key}>
        <button className="week-day-heading" type="button" onClick={() => onDayClick(key)}><span>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong></button>
        <div className="week-day-events">{dayEvents.map((event) => <EventPill key={event.instanceId} event={event} onClick={() => onEventClick(event)} />)}
          {!dayEvents.length && <button type="button" className="week-add" aria-label={`Add event ${formatDate(key)}`} onClick={() => onDayClick(key)}><Plus size={15} /></button>}
        </div>
      </section>
    })}
  </div>
}

function AgendaCalendar({ date, todayKey, events, onEventClick, onAdd }: { date: Date; todayKey: string; events: CalendarEventInstance[]; onEventClick: (event: CalendarEventInstance) => void; onAdd: () => void }) {
  const monthBegin = toLocalDate(new Date(date.getFullYear(), date.getMonth(), 1))
  const visible = events.filter((event) => event.date >= (date.getFullYear() === Number(todayKey.slice(0, 4)) && date.getMonth() === Number(todayKey.slice(5, 7)) - 1 ? todayKey : monthBegin)).sort(compareEvents)
  return <div className="agenda-list">
    {visible.length ? visible.map((event) => <button className="agenda-row" type="button" key={event.instanceId} onClick={() => onEventClick(event)}>
      <span className="agenda-date"><strong>{Number(event.date.slice(8))}</strong><small>{formatDate(event.date, { weekday: 'short', month: 'short' })}</small></span>
      <span className={`agenda-category ${event.category.toLowerCase()}`} />
      <span className="agenda-copy"><strong>{event.title}</strong><small>{eventTimeLabel(event)}{event.location ? ` · ${event.location}` : ''}</small></span>
      <span className={`status-badge ${event.status.toLowerCase()}`}>{event.status}</span>
      <ChevronRight className="agenda-chevron" size={17} />
    </button>) : <EmptyState icon={<CalendarDays size={23} />} title="Nothing on the calendar" description="There are no events to show in this date range." action={<button type="button" className="button button-secondary" onClick={onAdd}><Plus size={15} /> Add an event</button>} />}
  </div>
}

type EditScope = 'occurrence' | 'future' | 'series'

function EventForm({ event, initialDate, occurrenceDate, seriesStartDate, currentMemberId, onClose, onSave }: {
  event: CouncilEvent | null; initialDate: string; occurrenceDate: string; seriesStartDate: string
  currentMemberId: string; onClose: () => void; onSave: (event: CouncilEvent, scope: EditScope, occurrenceDate: string) => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.recurrence ? seriesStartDate || event.date : event?.date ?? initialDate)
  const [timeType, setTimeType] = useState<EventTimeType>(event?.timeType ?? 'timed')
  const [startTime, setStartTime] = useState(event?.startTime ?? '')
  const [endTime, setEndTime] = useState(event?.endTime ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'Meeting')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [recurring, setRecurring] = useState(Boolean(event?.recurrence))
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(event?.recurrence?.frequency ?? 'weekly')
  const [endType, setEndType] = useState<'date' | 'count'>(event?.recurrence?.endType ?? 'count')
  const [endDate, setEndDate] = useState(event?.recurrence?.endDate ?? initialDate)
  const [occurrenceCount, setOccurrenceCount] = useState(event?.recurrence?.count ?? 10)
  const [editScope, setEditScope] = useState<EditScope>('occurrence')
  const [error, setError] = useState('')
  const recurrenceFieldsVisible = !event?.recurrence || editScope === 'series'

  function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault()
    if (timeType === 'timed' && (!startTime || !endTime)) {
      setError('Add both times, or choose Panther Pride or no exact time.')
      return
    }
    if (timeType === 'timed' && startTime && endTime && endTime <= startTime) {
      setError('End time must be after start time.')
      return
    }
    const eventDate = event?.recurrence && editScope !== 'series' ? seriesStartDate : date
    if (recurring && recurrenceFieldsVisible && endType === 'date' && endDate < eventDate) {
      setError('The recurrence end date must be on or after the event date.')
      return
    }
    if (recurring && recurrenceFieldsVisible && endType === 'count' && (occurrenceCount < 2 || occurrenceCount > 3660)) {
      setError('Choose between 2 and 3660 occurrences.')
      return
    }
    const now = new Date().toISOString()
    const recurrence: RecurrenceRule | undefined = recurring && recurrenceFieldsVisible
      ? endType === 'date' ? { frequency, endType, endDate } : { frequency, endType, count: occurrenceCount }
      : event?.recurrence
    const saved: CouncilEvent = {
      ...(event ?? { id: createId(), creatorId: currentMemberId, createdAt: now, status: 'Pending', comments: [] }),
      title: title.trim(),
      date: eventDate,
      timeType,
      startTime: timeType === 'timed' ? startTime : '',
      endTime: timeType === 'timed' ? endTime : '',
      location: location.trim(),
      description: description.trim(),
      category,
      notes: notes.trim(),
      updatedById: currentMemberId,
      updatedAt: now,
      ...(recurrence ? { recurrence } : {}),
    }
    if (!recurring && recurrenceFieldsVisible) delete saved.recurrence
    onSave(saved, editScope, occurrenceDate || date)
  }

  return <Modal title={event ? 'Edit event' : 'Add an event'} onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <div className="form-group form-span"><label htmlFor="event-title">Title <span className="required">*</span></label><input id="event-title" className="control" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} autoFocus /></div>
      {event?.recurrence
        ? editScope === 'series'
          ? <div className="form-group"><label htmlFor="event-date">Series start date</label><input id="event-date" className="control" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          : <p className="field-explainer form-span">Editing the occurrence on {formatDate(occurrenceDate)}.</p>
        : <div className="form-group"><label htmlFor="event-date">Date <span className="required">*</span></label><input id="event-date" className="control" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>}
      {event?.recurrence && <div className="form-group form-span"><label htmlFor="edit-scope">Apply changes to</label><select id="edit-scope" className="control" value={editScope} onChange={(e) => setEditScope(e.target.value as EditScope)}><option value="occurrence">This occurrence only</option><option value="future">This and future occurrences</option><option value="series">Entire series</option></select></div>}
      <div className="form-group"><label htmlFor="event-category">Category</label><select id="event-category" className="control" value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}><option>Meeting</option><option>Activity</option><option>Deadline</option></select></div>
      <div className="form-group form-span"><label>Time</label><div className="segmented-control">{([['timed', 'Specific time'], ['panther-pride', 'Panther Pride'], ['all-day', 'No exact time']] as [EventTimeType, string][]).map(([value, label]) => <button key={value} type="button" className={timeType === value ? 'selected' : ''} onClick={() => setTimeType(value)}>{label}</button>)}</div></div>
      {timeType === 'timed' && <><div className="form-group"><label htmlFor="event-start">Start time</label><input id="event-start" className="control" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div><div className="form-group"><label htmlFor="event-end">End time</label><input id="event-end" className="control" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></>}
      {timeType === 'panther-pride' && <p className="field-explainer form-span">This is a school time block; no clock time is assigned.</p>}
      <div className="form-group form-span"><label htmlFor="event-location">Location</label><input id="event-location" className="control" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></div>
      <div className="form-group form-span"><label htmlFor="event-description">Description</label><textarea id="event-description" className="control textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} /></div>
      <div className="form-group form-span"><label htmlFor="event-notes">Agenda / preparation notes <span className="optional">Optional</span></label><textarea id="event-notes" className="control textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} /></div>
      {recurrenceFieldsVisible && <>
        <div className="form-group form-span"><label htmlFor="recurrence">Repeat</label><select id="recurrence" className="control" value={recurring ? frequency : 'none'} onChange={(e) => {
          setRecurring(e.target.value !== 'none')
          if (e.target.value !== 'none') setFrequency(e.target.value as RecurrenceFrequency)
        }}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        {recurring && <>
          <div className="form-group"><label htmlFor="recurrence-end-type">Ends</label><select id="recurrence-end-type" className="control" value={endType} onChange={(e) => setEndType(e.target.value as 'date' | 'count')}><option value="date">On a date</option><option value="count">After a number of events</option></select></div>
          {endType === 'date'
            ? <div className="form-group"><label htmlFor="recurrence-end-date">End date</label><input id="recurrence-end-date" className="control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>
            : <div className="form-group"><label htmlFor="recurrence-count">Occurrences (2–3660)</label><input id="recurrence-count" className="control" type="number" min={2} max={3660} value={occurrenceCount} onChange={(e) => setOccurrenceCount(Number(e.target.value))} required /></div>}
        </>}
      </>}
      {error && <p className="form-error form-span" role="alert">{error}</p>}
      <div className="modal-actions form-span"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">{event ? 'Save changes' : 'Add Event'}</button></div>
    </form>
  </Modal>
}

function EventDetails({ event, currentMemberId, canDelete, onClose, onEdit, onUpdate, onDelete }: {
  event: CalendarEventInstance; currentMemberId: string; canDelete: boolean; onClose: () => void; onEdit: () => void
  onUpdate: (event: CalendarEventInstance) => void; onDelete: (scope: 'occurrence' | 'future' | 'series') => void
}) {
  const [comment, setComment] = useState('')
  const creator = roster.find((member) => member.id === event.creatorId)
  const approver = roster.find((member) => member.id === event.approverId)
  function addComment(form: FormEvent<HTMLFormElement>) {
    form.preventDefault()
    if (!comment.trim()) return
    onUpdate({ ...event, comments: [...event.comments, { id: createId(), memberId: currentMemberId, text: comment.trim(), createdAt: new Date().toISOString() }] })
    setComment('')
  }
  function decide(status: 'Approved' | 'Declined') {
    let declineReason: string | undefined
    if (status === 'Declined') {
      declineReason = window.prompt('Optional reason for declining this proposal:') ?? undefined
      if (declineReason === undefined) return
    }
    const now = new Date().toISOString()
    onUpdate({ ...event, status, updatedById: currentMemberId, updatedAt: now, approverId: currentMemberId, decidedAt: now, declineReason })
  }
  return <Modal title="Event details" onClose={onClose} wide>
    <div className="event-detail">
      <div className="detail-title-row"><div><span className={`category-label ${event.category.toLowerCase()}`}>{event.category}</span><h2>{event.title}</h2></div><span className={`status-badge ${event.status.toLowerCase()}`}>{event.status}</span></div>
      <div className="detail-facts"><span><CalendarDays size={16} />{formatDate(event.date)}</span><span><Clock3 size={16} />{eventTimeLabel(event)}</span>{event.recurrence && <span><Repeat size={16} />{recurrenceLabel(event)}</span>}{event.location && <span><UsersRound size={16} />{event.location}</span>}</div>
      {event.description && <DetailBlock title="Description"><p>{event.description}</p></DetailBlock>}
      {event.notes && <DetailBlock title="Agenda / preparation notes"><p>{event.notes}</p></DetailBlock>}
      <div className="audit-grid"><div><small>Created by</small><strong>{creator?.name ?? 'Board member'}</strong><span>{formatDateTime(event.createdAt)}</span></div><div><small>Last edited</small><strong>{event.updatedById ? roster.find((member) => member.id === event.updatedById)?.name ?? 'Board member' : 'Not edited'}</strong><span>{event.updatedById ? formatDateTime(event.updatedAt) : ''}</span></div>{approver && <div><small>{event.status} by</small><strong>{approver.name}</strong><span>{event.decidedAt ? formatDateTime(event.decidedAt) : ''}</span></div>}</div>
      {event.declineReason && <div className="decline-reason"><strong>Decision note</strong><p>{event.declineReason}</p></div>}
      {event.status === 'Pending' && <div className="approval-actions"><span>Review proposal</span><div><button className="button button-secondary" type="button" onClick={() => decide('Declined')}>Decline</button><button className="button button-primary" type="button" onClick={() => decide('Approved')}><Check size={15} /> Approve</button></div></div>}
      <DetailBlock title={`Event discussion · ${event.comments.length}`}>
        {event.comments.length ? <div className="comment-list">{event.comments.map((item) => {
          const author = roster.find((member) => member.id === item.memberId)
          return <div className="comment-row" key={item.id}><span className="avatar avatar-small">{getInitials(author?.name ?? '?')}</span><div><p><strong>{author?.name ?? 'Member'}</strong><small>{formatDateTime(item.createdAt)}</small></p><span>{item.text}</span></div></div>
        })}</div> : <p className="empty-inline">No comments yet. Start the discussion.</p>}
        <form className="comment-form" onSubmit={addComment}><textarea className="control textarea" aria-label="Add a comment" placeholder="Write a comment…" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} required /><button className="button button-secondary" type="submit" disabled={!comment.trim()}><Send size={15} /> Comment</button></form>
      </DetailBlock>
      <div className="modal-actions">{canDelete && (event.recurrence
        ? <div className="recurrence-delete-actions"><button className="button button-danger-text" type="button" onClick={() => onDelete('occurrence')}>Delete this occurrence</button><button className="button button-danger-text" type="button" onClick={() => onDelete('future')}>Delete this and future</button><button className="button button-danger-text" type="button" onClick={() => onDelete('series')}>Delete entire series</button></div>
        : <button className="button button-danger-text" type="button" onClick={() => onDelete('series')}>Delete</button>)}<span className="actions-spacer" /><button className="button button-secondary" type="button" onClick={onClose}>Close</button><button className="button button-primary" type="button" onClick={onEdit}>Edit event</button></div>
    </div>
  </Modal>
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-block"><h3>{title}</h3>{children}</section>
}

function ChatPage({ currentMemberId, messages, setMessages }: { currentMemberId: string; messages: ChatMessage[]; setMessages: FirestoreSetter<ChatMessage> }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  function send() {
    const text = draft.trim()
    if (!text) return
    if (text.length > 2000) {
      setError('Messages must be 2,000 characters or fewer.')
      return
    }
    setMessages((previous) => [...previous, { id: createId(), memberId: currentMemberId, text, createdAt: new Date().toISOString() }])
    setDraft('')
    setError('')
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }
  return <>
    <PageHeading eyebrow="BOARD CONVERSATION" title="Chat" description="One shared conversation for the executive board." />
    <section className="chat-panel panel">
      <div className="chat-header"><div className="chat-room-icon"><UsersRound size={18} /></div><div><strong>Executive Board</strong><small>{roster.length} members</small></div><span className="chat-status"><i /> Shared group</span></div>
      <div className="chat-history" aria-live="polite">
        {!ordered.length ? <EmptyState icon={<MessageCircle size={23} />} title="Start the conversation" description="Messages are shared with approved board members across devices." /> : ordered.map((message, index) => {
          const member = roster.find((candidate) => candidate.id === message.memberId)
          const previous = ordered[index - 1]
          const newDay = !previous || chicagoDate(previous.createdAt) !== chicagoDate(message.createdAt)
          const own = message.memberId === currentMemberId
          return <div key={message.id} className="message-group">
            {newDay && <div className="date-divider"><span>{formatDate(chicagoDate(message.createdAt), { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>}
            <div className={`chat-message ${own ? 'own-message' : ''}`}>
              {!own && <span className="avatar avatar-small">{getInitials(member?.name ?? '?')}</span>}
              <div className="message-content">{!own && <div className="message-author">{member?.name ?? 'Member'}</div>}<div className="message-bubble">{message.text}</div><time>{new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div>
            </div>
          </div>
        })}
      </div>
      <div className="chat-composer"><textarea className="control textarea" aria-label="Message" placeholder="Write a message…" rows={2} value={draft} onChange={(event) => { setDraft(event.target.value); setError('') }} onKeyDown={keyDown} maxLength={2000} /><div className="composer-footer"><span>{error || 'Enter to send · Shift + Enter for a new line'}</span><button type="button" className="button button-primary" onClick={send} disabled={!draft.trim()}><Send size={15} /> Send</button></div></div>
    </section>
  </>
}

function TasksPage({ currentMemberId, events, tasks, setTasks, agendaItems, setAgendaItems }: {
  currentMemberId: string; events: CouncilEvent[]; tasks: CouncilTask[]; setTasks: FirestoreSetter<CouncilTask>;
  agendaItems: AgendaItem[]; setAgendaItems: FirestoreSetter<AgendaItem>
}) {
  const [todayKey] = useState(() => toLocalDate(new Date()))
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [assigneeFilter, setAssigneeFilter] = useState('All members')
  const [editingTask, setEditingTask] = useState<CouncilTask | null | undefined>(undefined)
  const [agendaEventId, setAgendaEventId] = useState('')
  const [agendaDraft, setAgendaDraft] = useState('')
  const filtered = tasks.filter((task) => (statusFilter === 'All statuses' || task.status === statusFilter) && (assigneeFilter === 'All members' || task.assigneeId === assigneeFilter)).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  const agendaEvents = events.filter((event) => event.status === 'Approved').sort(compareEvents)
  const selectedAgendaEvent = agendaEvents.find((event) => event.id === agendaEventId)
  const selectedAgendaItems = agendaItems.filter((item) => item.eventId === agendaEventId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  function setTaskStatus(task: CouncilTask, status: TaskStatus) {
    setTasks((previous) => previous.map((item) => item.id === task.id ? { ...item, status, updatedAt: new Date().toISOString() } : item))
  }
  function addAgenda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!agendaDraft.trim() || !agendaEventId) return
    setAgendaItems((previous) => [...previous, { id: createId(), eventId: agendaEventId, text: agendaDraft.trim(), completed: false, createdAt: new Date().toISOString() }])
    setAgendaDraft('')
  }

  return <>
    <PageHeading eyebrow="KEEP THINGS MOVING" title="Tasks & Agenda" description="Track follow-ups and prepare for upcoming meetings."
      action={<button className="button button-primary" type="button" onClick={() => setEditingTask(null)}><Plus size={17} /> Add task</button>} />
    <section className="task-toolbar panel">
      <div className="filter-group"><label htmlFor="status-filter">Status</label><select id="status-filter" className="select-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option><option>To do</option><option>In progress</option><option>Completed</option></select></div>
      <div className="filter-group"><label htmlFor="assignee-filter">Assigned to</label><select id="assignee-filter" className="select-control" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}><option>All members</option>{roster.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
      <span className="task-count">{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}</span>
    </section>
    <section className="panel task-panel">
      {filtered.length ? <div className="task-list">{filtered.map((task) => {
        const assignee = roster.find((member) => member.id === task.assigneeId)
        const meeting = events.find((event) => event.id === task.eventId)
        const overdue = task.dueDate && task.dueDate < todayKey && task.status !== 'Completed'
        return <article className={`task-row ${task.status === 'Completed' ? 'is-completed' : ''}`} key={task.id}>
          <button className={`task-check ${task.status === 'Completed' ? 'checked' : ''}`} type="button" aria-label={task.status === 'Completed' ? 'Mark task to do' : 'Mark task completed'} onClick={() => setTaskStatus(task, task.status === 'Completed' ? 'To do' : 'Completed')}>{task.status === 'Completed' && <Check size={14} />}</button>
          <div className="task-main"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<div className="task-meta">{assignee && <span><span className="tiny-avatar">{getInitials(assignee.name)}</span>{assignee.name}</span>}{task.dueDate && <span className={overdue ? 'overdue' : ''}><CalendarDays size={13} />{overdue ? 'Overdue · ' : ''}{formatDate(task.dueDate, { month: 'short', day: 'numeric' })}</span>}{meeting && <span><UsersRound size={13} />{meeting.title}</span>}</div></div>
          <select aria-label={`Status for ${task.title}`} className={`status-select ${task.status.toLowerCase().replace(' ', '-')}`} value={task.status} onChange={(e) => setTaskStatus(task, e.target.value as TaskStatus)}><option>To do</option><option>In progress</option><option>Completed</option></select>
          <button className="icon-button task-edit" type="button" aria-label={`Edit ${task.title}`} onClick={() => setEditingTask(task)}><MoreHorizontal size={17} /></button>
          <button className="button button-danger-text task-delete" type="button" onClick={() => { if (window.confirm(`Delete task "${task.title}"?`)) setTasks((old) => old.filter((item) => item.id !== task.id)) }}>Delete</button>
        </article>
      })}</div> : <EmptyState icon={<CheckCircle2 size={24} />} title="No tasks here" description={tasks.length ? 'Try changing the filters, or add a new task.' : 'Add a task to keep track of the board’s next steps.'} action={<button type="button" className="button button-primary" onClick={() => setEditingTask(null)}><Plus size={15} /> Add task</button>} />}
    </section>
    <section className="agenda-section">
      <div className="section-title"><div><p className="page-eyebrow">MEETING PREPARATION</p><h2>Meeting agenda</h2></div><span className="section-icon"><ClipboardList size={18} /></span></div>
      <div className="panel agenda-panel">
        {agendaEvents.length ? <>
          <label className="field-label" htmlFor="agenda-meeting">Choose a confirmed meeting</label>
          <select id="agenda-meeting" className="control agenda-meeting-select" value={agendaEventId} onChange={(e) => setAgendaEventId(e.target.value)}><option value="">Select a meeting…</option>{agendaEvents.map((event) => <option key={event.id} value={event.id}>{formatDate(event.date, { month: 'short', day: 'numeric' })} · {event.title}</option>)}</select>
          {selectedAgendaEvent ? <><div className="agenda-meeting-title"><CalendarDays size={16} /><strong>{selectedAgendaEvent.title}</strong><span>{formatDate(selectedAgendaEvent.date)}</span></div>
            {selectedAgendaItems.length ? <div className="agenda-items">{selectedAgendaItems.map((item) => <label className={`agenda-item ${item.completed ? 'done' : ''}`} key={item.id}><input type="checkbox" checked={item.completed} onChange={() => setAgendaItems((old) => old.map((current) => current.id === item.id ? { ...current, completed: !current.completed } : current))} /><span>{item.text}</span><button type="button" className="agenda-item-delete" aria-label={`Remove ${item.text}`} onClick={() => setAgendaItems((old) => old.filter((current) => current.id !== item.id))}><X size={14} /></button></label>)}</div> : <p className="empty-inline">No agenda items yet.</p>}
            <form className="agenda-add-form" onSubmit={addAgenda}><input className="control" aria-label="Agenda item" placeholder="Add an agenda item…" value={agendaDraft} onChange={(e) => setAgendaDraft(e.target.value)} required maxLength={200} /><button className="button button-secondary" type="submit"><Plus size={15} /> Add item</button></form>
          </> : <p className="empty-inline">Select a meeting to add or check off agenda items.</p>}
        </> : <EmptyState icon={<CalendarDays size={22} />} title="No meetings to prepare for" description="Approved events will appear here so the board can build an agenda." />}
      </div>
    </section>
    {editingTask !== undefined && <TaskForm task={editingTask} events={events} onClose={() => setEditingTask(undefined)} onSave={(task) => {
      setTasks((old) => editingTask ? old.map((item) => item.id === task.id ? task : item) : [...old, task])
      setEditingTask(undefined)
    }} />}
    <span className="visually-hidden">Current member {currentMemberId}</span>
  </>
}

function TaskForm({ task, events, onClose, onSave }: { task: CouncilTask | null; events: CouncilEvent[]; onClose: () => void; onSave: (task: CouncilTask) => void }) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'To do')
  const [eventId, setEventId] = useState(task?.eventId ?? '')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const now = new Date().toISOString()
    onSave({ id: task?.id ?? createId(), title: title.trim(), description: description.trim(), assigneeId, dueDate, status, eventId, createdAt: task?.createdAt ?? now, updatedAt: now })
  }
  return <Modal title={task ? 'Edit task' : 'Add a task'} onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <div className="form-group form-span"><label htmlFor="task-title">Title <span className="required">*</span></label><input id="task-title" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus /></div>
      <div className="form-group form-span"><label htmlFor="task-description">Description</label><textarea id="task-description" className="control textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
      <div className="form-group"><label htmlFor="task-assignee">Assigned member</label><select id="task-assignee" className="control" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Unassigned</option>{roster.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
      <div className="form-group"><label htmlFor="task-due">Due date</label><input id="task-due" type="date" className="control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      <div className="form-group"><label htmlFor="task-status">Status</label><select id="task-status" className="control" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}><option>To do</option><option>In progress</option><option>Completed</option></select></div>
      <div className="form-group"><label htmlFor="task-meeting">Link to meeting</label><select id="task-meeting" className="control" value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">None</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
      <div className="modal-actions form-span"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">{task ? 'Save changes' : 'Create task'}</button></div>
    </form>
  </Modal>
}

function MembersPage({ members }: { members: DirectoryMember[] }) {
  const orderedMembers = [...members].sort((a, b) => roster.findIndex((member) => member.id === a.id) - roster.findIndex((member) => member.id === b.id))
  return <>
    <PageHeading eyebrow="THE PEOPLE BEHIND THE PLANS" title="Members" description={`${members.length} members of the DMS Student Council Executive Board.`} />
    <div className="members-grid">{orderedMembers.map((member) => <article className="member-card panel" key={member.id}>
      <span className="member-avatar">{getInitials(member.name)}</span>
      <div className="member-info"><h2>{member.name}</h2><p>{member.role}</p><a className="member-email" href={`mailto:${member.email}`}>{member.email}</a>{member.temporary && <small className="member-roster-note">Temporary test account.</small>}{member.id === 'sitaara-jorden' && <small className="member-roster-note">Please confirm “Jorden”; an earlier roster used “Jordan.”</small>}</div>
    </article>)}</div>
  </>
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>
}

export default App
