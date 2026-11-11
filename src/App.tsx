import { useState, useEffect, useMemo } from 'react'
import { CalendarHeader } from './components/CalendarHeader'
import { MonthGrid } from './components/MonthGrid'
import { WeekGrid } from './components/WeekGrid'
import { DayGrid } from './components/DayGrid'
import { FixedFeeList } from './components/FixedFeeList'
import { EventDetailsPanel } from './components/EventDetailsPanel'
import { Modal } from './components/ui/Modal'
import { SettingsModal } from './components/SettingsModal'
import type { FixedFee } from './types'
import { enrichFees, feeLockReason } from './types'
import type { Cliente } from './hooks/useClientes'
import type { Proyecto } from './hooks/useProyectos'
import { useProyectos } from './hooks/useProyectos'
import { deleteFee, entryUrl, fetchFees } from './lib/api'

type ViewType = 'month' | 'week' | 'day'
type DisplayMode = 'list' | 'calendar'

function readStored<T>(key: string, fallback: T): T {
  try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback } catch { return fallback }
}
function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sin almacenamiento */ }
}

function App() {
  const [orgId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('organization_id'))
  const [fees, setFees] = useState<FixedFee[]>([])
  const [selectedEvent, setSelectedEvent] = useState<FixedFee | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('Error de Organización')
  const [modalMessage, setModalMessage] = useState('')
  const [modalType, setModalType] = useState<'error' | 'warning' | 'info'>('error')
  const [isLoading, setIsLoading] = useState(false)

  const showModal = (title: string, message: string, type: 'error' | 'warning' | 'info') => {
    setModalTitle(title); setModalMessage(message); setModalType(type); setIsModalOpen(true)
  }

  // Filtros globales guardados por organización (claves propias del calendario de honorarios fijos)
  const key = (name: string) => orgId ? `aptus_fee_selected_${name}_${orgId}` : `aptus_fee_selected_${name}`
  const [selectedClients, setSelectedClients] = useState<Cliente[]>(() => readStored(key('clients'), []))
  const [selectedProjects, setSelectedProjects] = useState<Proyecto[]>(() => readStored(key('projects'), []))

  // La API de cargos fijos no trae el cliente: se completa con el catálogo de proyectos.
  const { proyectos } = useProyectos(orgId)

  useEffect(() => writeStored(key('clients'), selectedClients), [selectedClients]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => writeStored(key('projects'), selectedProjects), [selectedProjects]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedClients.length === 0 && selectedProjects.length > 0) setSelectedProjects([])
  }, [selectedClients]) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => enrichFees(fees, proyectos), [fees, proyectos])

  const globalFilteredEvents = useMemo(() => {
    let filtered = events
    if (selectedClients.length > 0) {
      const clientIds = new Set(selectedClients.map(c => String(c.cliente_id || c.id)))
      filtered = filtered.filter(evt => evt.cliente_id != null && clientIds.has(String(evt.cliente_id)))
    }
    if (selectedProjects.length > 0) {
      const projectIds = new Set(selectedProjects.map(p => p.id?.toString()))
      filtered = filtered.filter(evt => projectIds.has(String(evt.proyecto_id)))
    }
    return filtered
  }, [events, selectedClients, selectedProjects])

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const saved = readStored<string | null>('aptus_fee_current_date', null)
    const parsed = saved ? new Date(saved) : null
    return parsed && !isNaN(parsed.getTime()) ? parsed : new Date()
  })
  const [view, setView] = useState<ViewType>(() => readStored('aptus_fee_calendar_view', 'month'))
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => readStored('aptus_fee_display_mode', 'list'))
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [theme, setTheme] = useState(() => readStored('aptus_fee_theme', 'amber'))

  useEffect(() => writeStored('aptus_fee_current_date', currentDate.toISOString()), [currentDate])
  useEffect(() => writeStored('aptus_fee_calendar_view', view), [view])
  useEffect(() => writeStored('aptus_fee_display_mode', displayMode), [displayMode])
  useEffect(() => {
    writeStored('aptus_fee_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!orgId) {
      showModal('Error de Organización', 'No se pudo obtener datos de la organización actual (falta organization_id en la URL).', 'error')
      return
    }
    setIsLoading(true)
    fetchFees(orgId)
      .then(setFees)
      .catch(() => showModal('Error al cargar datos', 'Ocurrió un error al intentar obtener los honorarios fijos de la organización.', 'error'))
      .finally(() => setIsLoading(false))
  }, [orgId])

  const move = (delta: number) => setCurrentDate(prev => {
    const next = new Date(prev)
    if (view === 'month') next.setMonth(next.getMonth() + delta)
    else if (view === 'week') next.setDate(next.getDate() + 7 * delta)
    else next.setDate(next.getDate() + delta)
    return next
  })

  const handleAdd = () => {
    if (!orgId) return
    window.location.href = entryUrl(orgId)
  }

  const handleEditEvent = (event: FixedFee) => {
    if (!orgId) return
    const locked = feeLockReason(event)
    if (locked) { showModal('Cargo no editable', locked, 'warning'); return }
    window.location.href = entryUrl(orgId, event.id)
  }

  const handleDeleteEvent = async (event: FixedFee) => {
    if (!orgId) return
    const locked = feeLockReason(event)
    if (locked) { showModal('Cargo no eliminable', locked, 'warning'); return }
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este cargo?\n\n"${event.concepto}"`)) return
    setIsLoading(true)
    const result = await deleteFee(orgId, event.id)
    setIsLoading(false)
    if (!result.ok) { showModal('Error al eliminar', result.message, 'error'); return }
    setFees(prev => prev.filter(e => e.id !== event.id))
    if (selectedEvent?.id === event.id) setSelectedEvent(null)
    if (result.alreadyGone) showModal('Cargo ya eliminado', 'El cargo ya no existía en Aptus; se quitó del listado.', 'info')
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-200/60 p-2 sm:p-4 font-sans overflow-hidden">
      <div className="w-full h-full max-w-[1900px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col relative border border-slate-200/60">
        <CalendarHeader
          currentDate={currentDate} view={view} orgId={orgId}
          displayMode={displayMode} setDisplayMode={setDisplayMode} onViewChange={setView}
          onPrev={() => move(-1)} onNext={() => move(1)} onToday={() => setCurrentDate(new Date())}
          onOpenSettings={() => setIsSettingsOpen(true)} onAdd={handleAdd}
          selectedClients={selectedClients} onClientSelect={setSelectedClients}
          selectedProjects={selectedProjects} onProjectSelect={setSelectedProjects}
        />

        <div className="flex-1 flex overflow-auto bg-slate-50 relative custom-scrollbar">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
          )}

          {displayMode === 'list' ? (
            <FixedFeeList events={globalFilteredEvents} orgId={orgId} onEventClick={setSelectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />
          ) : (
            <>
              {view === 'month' && <MonthGrid events={globalFilteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />}
              {view === 'week' && <WeekGrid events={globalFilteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />}
              {view === 'day' && <DayGrid events={globalFilteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />}
            </>
          )}

          {selectedEvent && (
            <EventDetailsPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />
          )}

          {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} currentTheme={theme} setTheme={setTheme} />}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle} message={modalMessage} type={modalType} />
    </div>
  )
}

export default App
