import { useState, useRef, useEffect, useCallback } from 'react'
import { parseAfd } from './parseAfd'
import type { AfdParseResult, FoundEmployee } from './parseAfd'
import { buildReport, toMin, pad2, daysInMonth, WEEKDAYS } from './calc'
import type { EmployeeReport } from './calc'
import { ReportCard } from './ReportCard'
import { ReviewModal } from './ReviewModal'

// ─── constants & helpers ──────────────────────────────────────────────────────

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function todayMonth() {
  const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
function parseMonth(v: string) {
  const [y, m] = v.split('-').map(Number); if (!y || !m) return null; return { year: y, month: m }
}
function monthLabel(v: string) {
  const p = parseMonth(v); if (!p) return v; return `${MONTH_NAMES[p.month - 1]} de ${p.year}`
}

// ─── HolidayPicker ────────────────────────────────────────────────────────────

function HolidayPicker({ month, holidays, onChange }: {
  month: string; holidays: Set<string>; onChange: (h: Set<string>) => void
}) {
  const p = parseMonth(month)
  if (!p) return null
  const total = daysInMonth(p.year, p.month)
  const days = Array.from({ length: total }, (_, i) => {
    const d = i + 1
    const date = `${p.year}-${pad2(p.month)}-${pad2(d)}`
    const wday = new Date(`${date}T00:00:00`).getDay()
    return { d, date, wday }
  })

  function toggle(date: string) {
    const next = new Set(holidays)
    next.has(date) ? next.delete(date) : next.add(date)
    onChange(next)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-honey-900/70 mb-2">
        Folgas e Feriados
        {holidays.size > 0 && <span className="ml-2 text-honey-700 font-bold">{holidays.size} marcado{holidays.size !== 1 ? 's' : ''}</span>}
      </label>
      <div className="flex flex-wrap gap-1">
        {days.map(({ d, date, wday }) => {
          const isWkd = wday === 0 || wday === 6
          const isHol = holidays.has(date)
          return (
            <button
              key={date}
              onClick={() => toggle(date)}
              title={`${pad2(d)} ${WEEKDAYS[wday]}`}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all
                ${isHol
                  ? 'bg-honey-700 text-white shadow-md shadow-gold-200'
                  : isWkd
                    ? 'bg-honey-100/70 text-honey-700/80 border border-honey-200/40 cursor-default'
                    : 'bg-white/80 border border-gold-200 text-honey-900 hover:border-gold-400 hover:bg-gold-50'
                }`}
              disabled={isWkd}
            >
              {pad2(d)}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-honey-800/50 mt-1.5">Clique nos dias úteis para marcar como folga/feriado</p>
    </div>
  )
}

// ─── EmployeeSelector modal ───────────────────────────────────────────────────

function EmployeeSelector({ employees, selected, onToggle, onSelectAll, onClose, onCalculate }: {
  employees: FoundEmployee[]
  selected: Set<string>
  onToggle: (k: string) => void
  onSelectAll: () => void
  onClose: () => void
  onCalculate: () => void
}) {
  const allSel = selected.size === employees.length && employees.length > 0
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-honey-950/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/45 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 border-b border-gold-200/40 flex items-start justify-between bg-white/40">
          <div>
            <h2 className="font-bold text-honey-950 text-base">Funcionários no arquivo</h2>
            <p className="text-xs text-honey-700/60 mt-0.5">{employees.length} registro{employees.length !== 1 ? 's' : ''} encontrado{employees.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gold-400 hover:text-honey-800 w-8 h-8 rounded-lg hover:bg-gold-100 flex items-center justify-center text-xl transition-colors">×</button>
        </div>

        <div className="px-5 py-2 border-b border-gold-100 flex items-center justify-between bg-white/20">
          <button onClick={onSelectAll} className="text-xs font-semibold text-honey-700 hover:text-honey-900 transition-colors">
            {allSel ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <span className="text-xs text-honey-700/50">{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-gold-100/50 bg-white/10">
          {employees.map(emp => {
            const sel = selected.has(emp.key)
            return (
              <button key={emp.key} onClick={() => onToggle(emp.key)}
                className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${sel ? 'bg-gold-50/60' : 'hover:bg-gold-50/30'}`}>
                <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${sel ? 'bg-honey-700 border-honey-700' : 'border-gold-300'}`}>
                  {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-honey-950 truncate">{emp.displayName}</p>
                  {emp.cpf && <p className="text-[11px] text-honey-700/50 font-mono">CPF {emp.cpf}</p>}
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-5 py-4 border-t border-gold-200/40 flex gap-2 bg-white/40">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gold-200 bg-white/60 hover:bg-gold-100 transition-colors">Cancelar</button>
          <button onClick={onCalculate} disabled={selected.size === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-honey-800 hover:bg-honey-900 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold-200">
            Calcular{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

type Screen = 'home' | 'review' | 'results'

export default function App() {
  const [month, setMonth] = useState(todayMonth)
  const [carga, setCarga] = useState('08:00')
  const [empresa, setEmpresa] = useState('')
  const [holidays, setHolidays] = useState<Set<string>>(new Set())

  const [afd, setAfd] = useState<AfdParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Reports queue: list to review one by one
  const [reviewQueue, setReviewQueue] = useState<EmployeeReport[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [confirmedReports, setConfirmedReports] = useState<EmployeeReport[]>([])

  const [screen, setScreen] = useState<Screen>('home')
  const [isDirty, setIsDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault() }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [isDirty])

  // Reset holidays when month changes
  const handleMonthChange = useCallback((v: string) => {
    setMonth(v); setHolidays(new Set())
  }, [])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseAfd(ev.target?.result as string)
      setAfd(parsed); setSelected(new Set()); setShowSelector(true)
    }
    reader.readAsText(file, 'latin1')
    e.target.value = ''
  }, [])

  const toggleEmployee = useCallback((key: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }, [])

  const selectAll = useCallback(() => {
    if (!afd) return
    setSelected(prev => prev.size === afd.employees.length ? new Set() : new Set(afd.employees.map(e => e.key)))
  }, [afd])

  // Build reports and start review queue
  const startCalculate = useCallback(() => {
    if (!afd) return
    const p = parseMonth(month); if (!p) return
    const dailyMin = toMin(carga) ?? 480

    const initial = afd.employees
      .filter(emp => selected.has(emp.key))
      .map(emp => buildReport(emp.key, emp.displayName, afd.marks[emp.key] ?? {}, p.year, p.month, dailyMin, afd.defaultSchedule, holidays))

    setReviewQueue(initial)
    setReviewIndex(0)
    setConfirmedReports([])
    setShowSelector(false)
    setScreen('review')
    setIsDirty(true)
  }, [afd, selected, month, carga, holidays])

  // User confirms one report in the review modal
  const handleReviewConfirm = useCallback((updated: EmployeeReport) => {
    setConfirmedReports(prev => {
      const next = [...prev, updated]
      if (reviewIndex + 1 >= reviewQueue.length) {
        // All reviewed → go to results
        setScreen('results')
      } else {
        setReviewIndex(i => i + 1)
      }
      return next
    })
  }, [reviewIndex, reviewQueue.length])

  const handleReviewCancel = useCallback(() => {
    setScreen('home'); setShowSelector(false)
  }, [])

  const dailyMin = toMin(carga) ?? 480

  // ── Home ──────────────────────────────────────────────────────────────────

  if (screen === 'home') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background blobs for depth */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gold-200/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-honey-200/20 blur-[150px]" />
      </div>

      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-honey-800 mb-4 shadow-lg shadow-gold-200 border border-honey-700">
            <svg className="w-7 h-7 text-gold-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-honey-950 tracking-tight">Controle de Ponto</h1>
          <p className="text-sm text-honey-700 mt-1">Importe um arquivo AFD para começar</p>
        </div>

        <div className="bg-white/75 backdrop-blur-xl rounded-2xl shadow-xl border border-gold-200/45 p-5 mb-4 space-y-4">
          <p className="text-[11px] font-bold text-honey-700/80 uppercase tracking-widest">Configurações</p>

          <div>
            <label className="block text-xs font-semibold text-honey-900/80 mb-1">Empresa</label>
            <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)}
              placeholder="Nome da empresa (opcional)"
              className="w-full border border-gold-200 rounded-xl px-3 py-2.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-gold-400/40 hover:border-gold-300 transition-all text-honey-950 placeholder:text-honey-600/70" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-honey-900/80 mb-1">Competência</label>
              <input type="month" value={month} onChange={e => handleMonthChange(e.target.value)}
                className="w-full border border-gold-200 rounded-xl px-3 py-2.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-gold-400/40 hover:border-gold-300 transition-all text-honey-950" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-honey-900/80 mb-1">Jornada diária</label>
              <input type="time" value={carga} onChange={e => setCarga(e.target.value)}
                className="w-full border border-gold-200 rounded-xl px-3 py-2.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-gold-400/40 hover:border-gold-300 transition-all text-honey-950" />
            </div>
          </div>

          <div className="border-t border-gold-200/30 pt-4">
            <HolidayPicker month={month} holidays={holidays} onChange={setHolidays} />
          </div>
        </div>

        {/* Import button */}
        <button onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 bg-honey-800 hover:bg-honey-900 active:bg-honey-950 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-gold-200 text-sm border border-honey-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Importar arquivo AFD (.txt)
        </button>
        {fileName && <p className="text-center text-xs text-honey-700 mt-2 italic">{fileName}</p>}
        <input ref={fileRef} type="file" accept=".txt" onChange={handleFile} className="hidden" />
      </div>

      {showSelector && afd && (
        <EmployeeSelector employees={afd.employees} selected={selected}
          onToggle={toggleEmployee} onSelectAll={selectAll}
          onClose={() => setShowSelector(false)} onCalculate={startCalculate} />
      )}
    </div>
  )

  // ── Review (one at a time) ──────────────────────────────────────────────────

  if (screen === 'review' && reviewQueue.length > 0) {
    const current = reviewQueue[reviewIndex]
    const total = reviewQueue.length
    return (
      <div className="min-h-screen relative">
        {/* Background blobs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gold-200/25 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-honey-200/20 blur-[150px]" />
        </div>
        {/* Progress bar */}
        <div className="fixed top-0 left-0 right-0 z-30 h-1 bg-gold-100">
          <div className="h-full bg-honey-700 transition-all" style={{ width: `${((reviewIndex + 1) / total) * 100}%` }} />
        </div>
        {total > 1 && (
          <div className="fixed top-3 right-4 z-30 text-xs text-honey-900 bg-gold-100/90 backdrop-blur-md rounded-full px-3 py-1 border border-gold-200">
            {reviewIndex + 1} / {total}
          </div>
        )}
        <ReviewModal
          key={reviewIndex}
          report={current}
          dailyMinutes={dailyMin}
          onConfirm={handleReviewConfirm}
          onCancel={handleReviewCancel}
        />
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen print:bg-white relative">
      <div className="print:hidden fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gold-200/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-honey-200/20 blur-[150px]" />
      </div>

      <div className="print:hidden sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-b border-gold-200/40 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => setScreen('home')}
          className="flex items-center gap-1.5 text-sm text-honey-800 hover:text-honey-950 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Início
        </button>
        <span className="text-gold-400">|</span>
        <span className="text-sm text-honey-900">
          <b>{confirmedReports.length}</b> relatório{confirmedReports.length !== 1 ? 's' : ''} · {monthLabel(month)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setShowSelector(true); setScreen('home') }}
            className="text-sm font-medium text-honey-800 hover:text-honey-950 border border-gold-200 bg-white/60 px-3 py-1.5 rounded-xl transition-colors">
            Novo cálculo
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm font-semibold bg-honey-800 hover:bg-honey-900 text-white px-4 py-2 rounded-xl transition-colors shadow-md shadow-gold-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 print:p-0 print:max-w-none space-y-5 print:space-y-0">
        {confirmedReports.map((report, i) => (
          <ReportCard key={report.key} report={report} month={month} carga={carga}
            empresa={empresa} isLast={i === confirmedReports.length - 1} />
        ))}
      </div>
    </div>
  )
}
