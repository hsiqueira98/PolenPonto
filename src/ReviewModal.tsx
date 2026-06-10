import { useState, useRef, useEffect, useMemo } from 'react'
import {
  fromMin,
  toMin,
  recompute,
  randomNear,
  getEffectiveDailyMinutes,
  calcDayBalance,
  computeRowWorkedMin,
  canEditPeriod,
  isWeekendOrHoliday,
  isFullDayAbsent,
  absenceLabel,
  appendAutoNote,
  formatAutoNoteSpecial,
  timesToIntervals,
  intervalsToSlots,
  classifyGapIssue,
} from './calc'
import type {
  EmployeeReport,
  DayRow,
  Schedule,
  AbsenceType,
  AbsenceScope,
  PunchInterval,
} from './calc'
import { VacationModal } from './VacationModal'
import { MultiResolveModal } from './MultiResolveModal'
import { JustifyModal } from './JustifyModal'
import type { JustifyResult } from './JustifyModal'

interface Props {
  report: EmployeeReport
  dailyMinutes: number
  onConfirm: (updated: EmployeeReport) => void
  onCancel: () => void
}

function TimeCell({ value, onChange, generated, disabled }: {
  value: string
  onChange: (v: string) => void
  generated: boolean
  disabled?: boolean
}) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className={`w-[76px] text-center text-xs rounded-lg border px-1 py-1 font-mono
        focus:outline-none focus:ring-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${generated
          ? 'border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-300/50'
          : 'border-gold-200 bg-white text-honey-950 hover:border-gold-400 focus:ring-gold-300/50'
        }`}
    />
  )
}

function DayResolveDialog({ row, schedule, onClose, onApply, onOpenJustify }: {
  row: DayRow
  schedule: Schedule
  onClose: () => void
  onApply: (patch: Partial<DayRow>, autoLine?: string) => void
  onOpenJustify: () => void
}) {
  const issueLabel =
    row.gapIssue === 'empty' ? 'Nenhuma batida neste dia'
      : row.gapIssue === 'partial' ? 'Batidas incompletas ou horários estimados'
        : row.gapIssue === 'extra_punches' ? 'Mais de 4 batidas no dia'
          : row.gapIssue === 'odd_punches' ? 'Número ímpar de batidas'
            : 'Situação a resolver'

  function applyAbsence(type: AbsenceType, scope: AbsenceScope) {
    const label = absenceLabel(type, scope)
    onApply({
      absence: type,
      absenceScope: scope,
      isAtestado: true,
      generated: false,
      gapIssue: 'none',
      ...(scope === 'full' || scope === null
        ? { ent1: '', sai1: '', ent2: '', sai2: '' }
        : scope === 'period1'
          ? { ent1: '', sai1: '' }
          : { ent2: '', sai2: '' }),
    }, `${row.dayLabel}: ${label}.`)
  }

  const hasAbsence = row.absence !== null || row.isAtestado

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-honey-950/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/50 w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gold-200/40">
          <h3 className="font-bold text-honey-950 text-base">{row.dayLabel}</h3>
          <p className="text-xs text-honey-700/80 mt-1">{issueLabel}</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-honey-700/70 uppercase tracking-wider mb-2">Falta justificada</p>
            <ActionChip label="Registrar falta justificada..." onClick={onOpenJustify} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-honey-700/70 uppercase tracking-wider mb-2">Falta injustificada</p>
            <div className="flex flex-wrap gap-2">
              <ActionChip label="Dia inteiro" variant="red" onClick={() => applyAbsence('unjustified', 'full')} />
              <ActionChip label="Só manhã" variant="red" onClick={() => applyAbsence('unjustified', 'period1')} />
              <ActionChip label="Só tarde" variant="red" onClick={() => applyAbsence('unjustified', 'period2')} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-honey-700/70 uppercase tracking-wider mb-2">Ações de Horários</p>
            <div className="flex flex-col gap-2">
              <ActionChip
                label="Preencher manualmente na tabela"
                variant="neutral"
                onClick={() => onApply({ generated: false, gapIssue: 'none' }, `${row.dayLabel}: horários informados manualmente.`)}
              />
              <ActionChip
                label="Restaurar horários estimados (padrão)"
                variant="neutral"
                onClick={() => onApply({
                  ent1: randomNear(schedule.workStart),
                  sai1: randomNear(schedule.breakStart),
                  ent2: randomNear(schedule.breakEnd),
                  sai2: randomNear(schedule.workEnd),
                  generated: false,
                  gapIssue: 'none',
                  absence: null,
                  absenceScope: null,
                  isAtestado: false,
                })}
              />
              {hasAbsence && (
                <ActionChip
                  label="Remover justificativas / Retornar ao normal"
                  variant="neutral"
                  onClick={() => onApply({
                    absence: null,
                    absenceScope: null,
                    isAtestado: false,
                    gapIssue: classifyGapIssue(
                      [row.ent1, row.sai1, row.ent2, row.sai2].filter(Boolean),
                      isWeekendOrHoliday(row),
                      row.generated
                    )
                  }, `${row.dayLabel}: justificativa de falta removida.`)}
                />
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gold-200/40 flex justify-end bg-gold-50/20">
          <button onClick={onClose} className="text-sm font-semibold text-honey-800 hover:text-honey-950 px-4 py-1.5 rounded-xl border border-gold-200 bg-white hover:bg-gold-50 transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  )
}

function ActionChip({ label, onClick, variant = 'gold' }: {
  label: string
  onClick: () => void
  variant?: 'gold' | 'red' | 'neutral'
}) {
  const cls =
    variant === 'red'
      ? 'border-red-200 text-red-800 hover:bg-red-50/60 hover:border-red-300'
      : variant === 'neutral'
        ? 'border-gold-300 text-honey-800 hover:bg-gold-50'
        : 'border-gold-300 text-honey-800 hover:bg-gold-50'
  return (
    <button type="button" onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors bg-white/70 ${cls}`}>
      {label}
    </button>
  )
}

function SpecialEditor({ rows, setRows, setAutoNotes, onClose }: {
  rows: DayRow[]
  setRows: React.Dispatch<React.SetStateAction<DayRow[]>>
  setAutoNotes: React.Dispatch<React.SetStateAction<string[]>>
  onClose: () => void
}) {
  const specialDays = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !isWeekendOrHoliday(r) && (r.intervals.length > 1 || r.extraPunches.length > 0 || r.gapIssue === 'extra_punches'))

  function updateInterval(dayIdx: number, intIdx: number, field: keyof PunchInterval, value: string) {
    setRows(prev => {
      const next = [...prev]
      const row = { ...next[dayIdx] }
      const intervals = row.intervals.map((iv, j) =>
        j === intIdx ? { ...iv, [field]: value } : iv,
      )
      row.intervals = intervals
      const slots = intervalsToSlots(intervals)
      row.ent1 = slots.ent1
      row.sai1 = slots.sai1
      row.ent2 = slots.ent2
      row.sai2 = slots.sai2
      row.workedMin = computeRowWorkedMin(row, true)
      row.gapIssue = 'none'
      next[dayIdx] = row
      return next
    })
  }

  function addInterval(dayIdx: number) {
    setRows(prev => {
      const next = [...prev]
      const row = { ...next[dayIdx], intervals: [...next[dayIdx].intervals, { entrada: '', saida: '' }] }
      next[dayIdx] = row
      return next
    })
  }

  function confirmAndRegister() {
    setAutoNotes(prev => {
      for (const { r } of specialDays) {
        const wm = computeRowWorkedMin(r, true) ?? 0
        const line = formatAutoNoteSpecial(r.dayLabel, r.intervals, wm)
        prev = appendAutoNote(prev, line)
      }
      return prev
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-3 bg-honey-950/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gold-200/80 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gold-100 flex-shrink-0">
          <h3 className="font-bold text-honey-950 text-base">Recursos Especiais</h3>
          <p className="text-xs text-honey-700 mt-0.5">
            Edite todos os intervalos de entrada e saída. O total do dia é a soma dos períodos válidos.
          </p>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {specialDays.length === 0 ? (
            <p className="text-sm text-honey-600">Nenhum dia com múltiplas batidas detectado. Adicione intervalos pelo dia na tabela principal.</p>
          ) : (
            specialDays.map(({ r, i }) => (
              <div key={r.date} className="rounded-xl border border-gold-200/60 bg-gold-50/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-honey-900">{r.dayLabel}</span>
                  <span className="text-xs font-mono text-honey-700">
                    Total: {fromMin(computeRowWorkedMin(r, true) ?? 0)}
                  </span>
                </div>
                <div className="space-y-2">
                  {r.intervals.map((iv, j) => (
                    <div key={j} className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-honey-600 w-6">{j + 1}.</span>
                      <TimeCell value={iv.entrada} generated={false}
                        onChange={v => updateInterval(i, j, 'entrada', v)} />
                      <span className="text-honey-500 text-xs">até</span>
                      <TimeCell value={iv.saida} generated={false}
                        onChange={v => updateInterval(i, j, 'saida', v)} />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addInterval(i)}
                  className="text-[11px] text-honey-700 hover:text-honey-950 border border-gold-200 rounded-lg px-2 py-1 mt-2">
                  + intervalo
                </button>
              </div>
            ))
          )}
        </div>
        <div className="px-5 py-3 border-t border-gold-100 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gold-200 text-honey-700 hover:bg-gold-50">
            Cancelar
          </button>
          <button onClick={confirmAndRegister}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-honey-800 text-white hover:bg-honey-900">
            Confirmar Recursos
          </button>
        </div>
      </div>
    </div>
  )
}

function AbsenceBadge({ row }: { row: DayRow }) {
  if (row.absence === null) return null
  const label = absenceLabel(row.absence, row.absenceScope)
  const cls = row.absence === 'justified'
    ? 'bg-amber-100 text-amber-900 border-amber-200'
    : 'bg-red-100 text-red-800 border-red-200'
  return (
    <span className={`ml-1.5 text-[9px] rounded-md px-1.5 py-0.5 border font-medium ${cls}`}>
      {label}
    </span>
  )
}

export function ReviewModal({ report: initialReport, dailyMinutes, onConfirm, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(initialReport.displayName)
  const [cpf, setCpf] = useState(initialReport.cpf || '')
  const [pis, setPis] = useState(initialReport.pis || '')
  const [role, setRole] = useState(initialReport.role || '')
  const [department, setDepartment] = useState(initialReport.department || '')
  const [admissionDate, setAdmissionDate] = useState(initialReport.admissionDate || '')
  const [prevBalanceInput, setPrevBalanceInput] = useState(
    initialReport.previousBalanceMin !== undefined && initialReport.previousBalanceMin !== 0
      ? fromMin(Math.abs(initialReport.previousBalanceMin))
      : ''
  )
  const [prevBalanceSign, setPrevBalanceSign] = useState<'+' | '-'>(
    initialReport.previousBalanceMin !== undefined && initialReport.previousBalanceMin < 0 ? '-' : '+'
  )
  const [showVacation, setShowVacation] = useState(false)

  const [rows, setRows] = useState<DayRow[]>(initialReport.rows)
  const [schedule, setSchedule] = useState<Schedule>(initialReport.schedule)
  const [specialMode, setSpecialMode] = useState(initialReport.specialMode)
  const [notes, setNotes] = useState(initialReport.notes)
  const [autoNotes, setAutoNotes] = useState<string[]>(initialReport.autoNotes)
  const [resolveIdx, setResolveIdx] = useState<number | null>(null)
  const [showSpecial, setShowSpecial] = useState(false)
  const [showMultiResolve, setShowMultiResolve] = useState(false)
  const [justifyRowIdx, setJustifyRowIdx] = useState<number | null>(null)
  const [resolvedFlash, setResolvedFlash] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0 })
  }, [])

  const effectiveDailyMinutes = getEffectiveDailyMinutes(schedule, dailyMinutes)

  const pendingCount = rows.filter(
    r => r.gapIssue !== 'none' && r.absence === null && !isWeekendOrHoliday(r),
  ).length


  function syncRowWorked(row: DayRow): DayRow {
    if (isWeekendOrHoliday(row) || isFullDayAbsent(row)) {
      return { ...row, workedMin: null }
    }
    return { ...row, workedMin: computeRowWorkedMin(row, specialMode) }
  }

  function enableSpecialMode() {
    setSpecialMode(true)
    setRows(prev => prev.map(r => {
      if (isWeekendOrHoliday(r)) return r
      const allTimes = [r.ent1, r.sai1, r.ent2, r.sai2, ...r.extraPunches].filter(Boolean)
      const intervals = allTimes.length > 0 ? timesToIntervals(allTimes) : r.intervals
      const slots = intervalsToSlots(intervals)
      return syncRowWorked({
        ...r,
        intervals,
        ent1: slots.ent1,
        sai1: slots.sai1,
        ent2: slots.ent2,
        sai2: slots.sai2,
        gapIssue: 'none',
      })
    }))
    setAutoNotes(prev => appendAutoNote(prev, 'Recursos Especiais ativado para este funcionário.'))
  }

  function disableSpecialMode() {
    setSpecialMode(false)
    setRows(prev => prev.map(r => {
      if (isWeekendOrHoliday(r)) return r
      return syncRowWorked({ ...r, intervals: [] })
    }))
  }

  // Auto-detect and enable special mode if there are multiple punches on any day
  useEffect(() => {
    const hasMultiplePunches = rows.some(
      r => !isWeekendOrHoliday(r) && (r.intervals.length > 1 || r.gapIssue === 'extra_punches')
    )
    if (!specialMode && hasMultiplePunches) {
      enableSpecialMode()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateRow(i: number, patch: Partial<DayRow>, clearGenerated = false) {
    setRows(prev => {
      const next = [...prev]
      let updated: DayRow = { ...next[i], ...patch }
      if (clearGenerated) updated.generated = false
      const timeTouched =
        patch.ent1 !== undefined || patch.sai1 !== undefined ||
        patch.ent2 !== undefined || patch.sai2 !== undefined
      if (timeTouched) {
        const allTimes = [updated.ent1, updated.sai1, updated.ent2, updated.sai2, ...updated.extraPunches].filter(Boolean)
        if (specialMode) updated.intervals = timesToIntervals(allTimes)
        updated.gapIssue = classifyGapIssue(allTimes, isWeekendOrHoliday(updated), updated.generated)
      }
      updated = syncRowWorked(updated)
      next[i] = updated
      return next
    })
  }

  function applyResolve(i: number, patch: Partial<DayRow>, autoLine?: string) {
    updateRow(i, patch)
    if (autoLine) setAutoNotes(prev => appendAutoNote(prev, autoLine))
    setResolveIdx(null)
  }

  function handleVacationConfirm(start: string, end: string) {
    setRows(prev => prev.map(r => {
      if (r.date >= start && r.date <= end) {
        return { ...r, absence: 'vacation' as const, absenceScope: 'full' as const, ent1: '', sai1: '', ent2: '', sai2: '', extraPunches: [], intervals: [], generated: false, gapIssue: 'none' as const, workedMin: null }
      }
      return r
    }))
    const s = start.split('-').reverse().join('/')
    const e = end.split('-').reverse().join('/')
    const note = `Funcionário em gozo de férias no período de ${s} a ${e}.`
    setNotes(prev => { const t = prev.trim(); return t.includes(note) ? prev : t ? `${t}\n${note}` : note })
    setShowVacation(false)
  }

  function handleVacationClear() {
    setRows(prev => prev.map(r => r.absence === 'vacation' ? { ...r, absence: null, absenceScope: null } : r))
    setNotes(prev => prev.replace(/Funcionário em gozo de férias no período de .*\n?/g, '').trim())
    setShowVacation(false)
  }

  function handleMultiResolveApply(patches: Map<number, Partial<DayRow>>, newAutoNotes: string[]) {
    setRows(prev => {
      const next = [...prev]
      for (const [idx, patch] of patches) {
        let updated: DayRow = { ...next[idx], ...patch }
        updated = syncRowWorked(updated)
        next[idx] = updated
      }
      return next
    })
    setAutoNotes(prev => {
      let acc = prev
      for (const line of newAutoNotes) acc = appendAutoNote(acc, line)
      return acc
    })
    setShowMultiResolve(false)
    setResolvedFlash(true)
    setTimeout(() => setResolvedFlash(false), 3000)
  }

  function handleJustifyFromResolve(result: JustifyResult) {
    if (justifyRowIdx === null) return
    const scope = result.absenceScope
    const patch: Partial<DayRow> = {
      absence: result.absence,
      absenceScope: result.absenceScope,
      isAtestado: true,
      generated: false,
      gapIssue: 'none' as const,
      ...(scope === 'full' || scope === null
        ? { ent1: '', sai1: '', ent2: '', sai2: '' }
        : scope === 'period1'
          ? { ent1: '', sai1: '' }
          : { ent2: '', sai2: '' }),
    }
    applyResolve(justifyRowIdx, patch, result.autoLine)
    setJustifyRowIdx(null)
  }

  function handleConfirm() {
    const prevMin = prevBalanceInput.trim() ? (toMin(prevBalanceInput.trim()) ?? 0) : 0
    const previousBalanceMin = prevBalanceSign === '-' ? -Math.abs(prevMin) : Math.abs(prevMin)
    const payload: EmployeeReport = {
      ...initialReport,
      displayName: displayName.trim() || initialReport.key,
      cpf: cpf.trim(), pis: pis.trim(), role: role.trim(), department: department.trim(), admissionDate,
      rows, schedule, specialMode, notes: notes.trim(), autoNotes,
      previousBalanceMin,
    }
    onConfirm(recompute(payload, dailyMinutes))
  }

  const totals = useMemo(() => {
    let worked = 0
    let balance = 0
    for (const row of rows) {
      if (isWeekendOrHoliday(row)) continue
      const bal = calcDayBalance(row, effectiveDailyMinutes)
      if (row.workedMin !== null && row.workedMin > 0) {
        if (row.absence === null || (row.absence === 'justified' && !isFullDayAbsent(row))) {
          worked += row.workedMin
        }
      }
      if (bal !== null) {
        if (row.absence === null) balance += bal
        else if (row.absence === 'justified' && !isFullDayAbsent(row)) balance += bal
        else if (row.absence === 'unjustified') balance += bal
      }
    }
    const prevMin = prevBalanceInput.trim() ? (toMin(prevBalanceInput.trim()) ?? 0) : 0
    const prevSigned = prevBalanceSign === '-' ? -Math.abs(prevMin) : Math.abs(prevMin)
    return { worked, balance: balance + prevSigned }
  }, [rows, effectiveDailyMinutes, prevBalanceInput, prevBalanceSign])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-honey-950/40 backdrop-blur-md">
      <div className="bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/45 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-gold-200/40 flex items-start justify-between gap-3 flex-shrink-0 bg-white/40 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 group">
              <input id="nome" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Nome do Funcionário" title="Clique para editar o nome"
                className="font-bold text-honey-950 text-base sm:text-lg flex-1 bg-transparent border-b-2 border-transparent hover:border-gold-300 focus:border-honey-700 focus:outline-none transition-colors" />
              <svg className="w-3.5 h-3.5 text-honey-400 group-focus-within:text-honey-700 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <p className="text-xs text-honey-700 mt-0.5">Revise os registros · {effectiveDailyMinutes < dailyMinutes ? 'meio período' : 'integral'} · {fromMin(effectiveDailyMinutes)}/dia</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {pendingCount > 0 && (
              <button type="button" onClick={() => setShowMultiResolve(true)}
                className="hidden sm:flex items-center gap-1 bg-amber-100 border border-amber-300/60 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 transition-colors">
                {pendingCount} incompleto{pendingCount !== 1 ? 's' : ''} · Resolver tudo
              </button>
            )}
            {rows.some(r => r.absence === 'vacation') && (
              <span className="hidden sm:flex items-center gap-1 bg-blue-50 border border-blue-200/60 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                Férias registradas
              </span>
            )}
            <button id="fechar-revisao" onClick={onCancel} aria-label="Fechar"
              className="text-honey-600 hover:text-honey-950 w-8 h-8 rounded-lg hover:bg-gold-100 flex items-center justify-center text-xl">×</button>
          </div>
        </div>

        {/* Dados do Funcionário */}
        <div className="px-4 sm:px-5 py-3 border-b border-gold-200/35 bg-white/50 backdrop-blur-sm flex-shrink-0 space-y-2.5">
          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
            {([
              { id: 'pis', label: 'PIS', val: pis, set: setPis, ph: '000.00000.00-0', w: 'w-[130px]' },
              { id: 'cpf', label: 'CPF', val: cpf, set: setCpf, ph: '000.000.000-00', w: 'w-[120px]' },
              { id: 'cargo', label: 'Cargo', val: role, set: setRole, ph: 'Função', w: 'w-[130px]' },
              { id: 'setor', label: 'Setor', val: department, set: setDepartment, ph: 'Departamento', w: 'w-[130px]' },
            ] as const).map(f => (
              <div key={f.id} className="flex items-center gap-1.5">
                <label htmlFor={f.id} className="text-[10px] font-bold text-honey-600 uppercase tracking-widest flex-shrink-0">{f.label}</label>
                <input id={f.id} type="text" value={f.val} onChange={e => (f.set as (v: string) => void)(e.target.value)} placeholder={f.ph}
                  className={`${f.w} border border-gold-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gold-300/50 bg-white`} />
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <label htmlFor="admissao" className="text-[10px] font-bold text-honey-600 uppercase tracking-widest flex-shrink-0">Admissão</label>
              <input id="admissao" type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)}
                className="w-[130px] border border-gold-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gold-300/50 bg-white" />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-honey-600 uppercase tracking-widest flex-shrink-0">Saldo mês anterior</label>
              <div className="flex items-center rounded-lg overflow-hidden border border-gold-200 bg-white shadow-sm">
                <button type="button" onClick={() => setPrevBalanceSign('+')}
                  className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${prevBalanceSign === '+' ? 'bg-emerald-100 text-emerald-800' : 'text-honey-400 hover:bg-gold-50'}`}>+</button>
                <button type="button" onClick={() => setPrevBalanceSign('-')}
                  className={`px-2.5 py-1.5 text-xs font-bold border-l border-gold-200 transition-colors ${prevBalanceSign === '-' ? 'bg-red-100 text-red-700' : 'text-honey-400 hover:bg-gold-50'}`}>−</button>
                <input id="saldo-anterior" type="text" value={prevBalanceInput}
                  onChange={e => {
                    const v = e.target.value.replace(/[^\d:]/g, '')
                    setPrevBalanceInput(v)
                  }}
                  placeholder="00:00"
                  className="w-[72px] border-l border-gold-200 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-inset focus:ring-2 focus:ring-gold-300/50 bg-white" />
              </div>
              {prevBalanceInput && (
                <span className={`text-xs font-mono font-semibold ${prevBalanceSign === '-' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {prevBalanceSign}{prevBalanceInput}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar: horário padrão + ações */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-gold-200/35 bg-gold-50/15 backdrop-blur-sm flex-shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[10px] font-bold text-honey-600/70 uppercase tracking-widest whitespace-nowrap">Horário padrão</span>
            {([
              ['Entrada', 'workStart'],
              ['Almoço saída', 'breakStart'],
              ['Almoço volta', 'breakEnd'],
              ['Saída', 'workEnd'],
            ] as [string, keyof Schedule][]).map(([label, field]) => (
              <div key={field} className="flex items-center gap-1.5">
                <label className="text-[11px] text-honey-600 font-medium whitespace-nowrap">{label}</label>
                <input type="time" value={schedule[field]}
                  onChange={e => setSchedule(s => ({ ...s, [field]: e.target.value }))}
                  className="border border-gold-200 rounded-lg px-2 py-1 text-xs font-mono w-[84px] focus:outline-none focus:ring-2 focus:ring-gold-300/50 bg-white/80" />
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setShowSpecial(true)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg bg-honey-800 text-white hover:bg-honey-900 transition-colors ${specialMode ? 'visible' : 'invisible'}`}>
                Editar intervalos
              </button>
              <button type="button" onClick={() => { if (specialMode) disableSpecialMode(); else enableSpecialMode() }}
                title="Funcionários que registram mais de 4 batidas por dia (pausas não remuneradas)"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  specialMode
                    ? 'bg-honey-100 border-honey-300 text-honey-800 hover:bg-honey-200'
                    : 'bg-white border-gold-200 text-honey-500 hover:border-gold-300 hover:text-honey-700'
                }`}>
                Recursos Especiais {specialMode ? '· ativo' : '· inativo'}
              </button>
              {resolvedFlash ? (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 transition-all">
                  ✓ Resolvido
                </span>
              ) : pendingCount > 0 ? (
                <button type="button" onClick={() => setShowMultiResolve(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300/60 text-amber-900 hover:bg-amber-200 transition-colors">
                  {pendingCount} incompleto{pendingCount !== 1 ? 's' : ''} · Resolver
                </button>
              ) : null}
              <button id="ferias" type="button" onClick={() => setShowVacation(true)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-colors
                  ${rows.some(r => r.absence === 'vacation')
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                    : 'bg-honey-700 hover:bg-honey-800 text-white border-honey-600'
                  }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l6-6m0 0l6.586-6.586a2 2 0 012.828 0l2.172 2.172a2 2 0 010 2.828L14 19.5M9 15l-6 6M21 3l-3 3m-3-3l3 3" />
                </svg>
                {rows.some(r => r.absence === 'vacation') ? 'Editar Férias' : 'Férias'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div ref={tableRef} className="overflow-auto flex-1 min-h-0 bg-white/30">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md shadow-sm">
              <tr className="border-b border-gold-200">
                {['Dia', 'Ent 1', 'Saí 1', 'Ent 2', 'Saí 2', 'Total', 'Saldo', ''].map((h, hi) => (
                  <th key={hi}
                    className={`px-2 py-2.5 text-[10px] font-bold text-honey-700 uppercase tracking-wide
                      ${hi === 0 ? 'text-left pl-4 min-w-[100px]' : hi === 7 ? 'w-[1%] text-right pr-4' : 'text-center'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isOff = isWeekendOrHoliday(row)
                const fullAbsent = isFullDayAbsent(row)
                const saldo = calcDayBalance(row, effectiveDailyMinutes)
                const needsResolve = row.gapIssue !== 'none' && row.absence === null && !isOff

                let rowBg = 'bg-white/70'
                if (row.absence === 'vacation') rowBg = 'bg-blue-50/60'
                else if (row.absence === 'justified') rowBg = 'bg-amber-50/70'
                else if (row.absence === 'unjustified') rowBg = 'bg-red-50/50'
                else if (row.isHoliday) rowBg = 'bg-gold-50/60'
                else if (row.weekday === 0 || row.weekday === 6) rowBg = 'bg-gold-50/30'
                else if (needsResolve) rowBg = 'bg-amber-50/40'
                else if (row.generated) rowBg = 'bg-amber-50/20'

                const periodFields = [
                  ['ent1', 'sai1'] as const,
                  ['ent2', 'sai2'] as const,
                ]

                return (
                  <tr key={row.date} className={`${rowBg} border-b border-gold-100/60 hover:bg-gold-50/20 transition-colors`}>
                    <td className="pl-4 pr-1 py-2 align-middle">
                      <div className="font-semibold text-honey-900 whitespace-nowrap">{row.dayLabel}</div>
                      <div className="flex flex-wrap items-center gap-0.5 mt-0.5">
                        {row.isHoliday && <Tag text="feriado" />}
                        <AbsenceBadge row={row} />
                        {row.generated && !fullAbsent && !isOff && <Tag text="estimado" warn />}
                        {specialMode && row.intervals.length > 2 && (
                          <Tag text={`${row.intervals.length} int.`} />
                        )}
                      </div>
                    </td>

                    {periodFields.flatMap((pair, pi) =>
                      pair.map(field => {
                        const period = pi === 0 ? 1 : 2
                        const editable = !isOff && !fullAbsent && canEditPeriod(row, period as 1 | 2)
                        return (
                          <td key={field} className="px-1 py-1.5 text-center align-middle">
                            {editable ? (
                              <TimeCell
                                value={row[field]}
                                generated={row.generated && !row[field]}
                                onChange={v => updateRow(i, { [field]: v }, true)}
                              />
                            ) : (
                              <span className="text-honey-400/60 font-mono">—</span>
                            )}
                          </td>
                        )
                      }),
                    )}

                    <td className="px-2 py-1.5 text-center font-mono font-medium text-honey-800 align-middle">
                      {specialMode && !isOff && !fullAbsent && row.intervals.length > 0 ? (
                        <span title={row.intervals.map(iv => `${iv.entrada}-${iv.saida}`).join(', ')}>
                          {row.workedMin !== null ? fromMin(row.workedMin) : '—'}
                        </span>
                      ) : row.workedMin !== null ? fromMin(row.workedMin) : <span className="text-gold-300">—</span>}
                    </td>

                    <td className={`px-2 py-1.5 text-center font-mono font-semibold align-middle
                      ${saldo === null ? 'text-gold-300' : saldo < 0 ? 'text-red-600' : saldo > 0 ? 'text-emerald-600' : 'text-honey-600'}`}>
                      {saldo !== null ? (saldo > 0 ? '+' : '') + fromMin(saldo) : '—'}
                    </td>

                    <td className="px-3 py-1.5 align-middle text-right pr-4">
                      {!isOff && row.absence !== 'vacation' && (
                        <button
                          type="button"
                          onClick={() => setResolveIdx(i)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                            needsResolve
                              ? 'bg-amber-500 border-amber-600 text-white shadow-md hover:bg-amber-600'
                              : row.absence
                                ? 'bg-gold-50 border-gold-300 text-honey-900 hover:bg-gold-100'
                                : 'bg-white border-gold-200 text-honey-700 hover:border-gold-300 hover:bg-gold-50'
                          }`}
                        >
                          {needsResolve ? 'Resolver' : 'Ajustar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div className="px-4 sm:px-5 py-3 border-t border-gold-200/30 flex-shrink-0 bg-gold-50/10 backdrop-blur-sm">
          <label className="block text-[10px] font-bold text-honey-700/80 uppercase tracking-widest mb-1.5">
            Observações (incluídas no relatório)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Anotações gerais sobre este funcionário no mês…"
            className="w-full text-sm border border-gold-200 rounded-xl px-3 py-2 resize-y min-h-[52px] focus:outline-none focus:ring-2 focus:ring-gold-300/50 text-honey-950 placeholder:text-honey-500/60 bg-white/80"
          />
          {autoNotes.length > 0 && (
            <div className="mt-2 text-[11px] text-honey-700 space-y-0.5 max-h-20 overflow-y-auto">
              <p className="font-semibold text-honey-800">Registro automático:</p>
              {autoNotes.map((n, idx) => (
                <p key={idx} className="text-honey-600 pl-2 border-l-2 border-gold-300">{n}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-gold-200/30 flex flex-wrap items-center gap-3 flex-shrink-0 bg-white/50 backdrop-blur-md">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-honey-800">
            <span>Total: <b className="font-mono text-honey-950">{fromMin(totals.worked)}</b></span>
            <span>Saldo: <b className={`font-mono ${totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {(totals.balance >= 0 ? '+' : '') + fromMin(totals.balance)}
            </b></span>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gold-200 text-honey-800 hover:bg-gold-50/50 bg-white/55">
              Cancelar
            </button>
            <button onClick={handleConfirm}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-honey-800 hover:bg-honey-900 text-white shadow-md transition-all">
              {pendingCount > 0 ? 'Confirmar mesmo assim' : 'Confirmar →'}
            </button>
          </div>
        </div>
      </div>

      {resolveIdx !== null && (
        <DayResolveDialog
          row={rows[resolveIdx]}
          schedule={schedule}
          onClose={() => setResolveIdx(null)}
          onApply={(patch, autoLine) => applyResolve(resolveIdx, patch, autoLine)}
          onOpenJustify={() => { setJustifyRowIdx(resolveIdx); setResolveIdx(null) }}
        />
      )}
      {justifyRowIdx !== null && (
        <JustifyModal
          dayLabel={rows[justifyRowIdx].dayLabel}
          onConfirm={handleJustifyFromResolve}
          onClose={() => setJustifyRowIdx(null)}
        />
      )}
      {showMultiResolve && (
        <MultiResolveModal
          rows={rows}
          schedule={schedule}
          onApplyAll={handleMultiResolveApply}
          onClose={() => setShowMultiResolve(false)}
        />
      )}
      {showSpecial && specialMode && (
        <SpecialEditor
          rows={rows}
          setRows={setRows}
          setAutoNotes={setAutoNotes}
          onClose={() => setShowSpecial(false)}
        />
      )}
      {showVacation && (
        <VacationModal
          month={rows.length > 0 ? rows[0].date.substring(0, 7) : ''}
          existingStart={rows.find(r => r.absence === 'vacation')?.date}
          existingEnd={[...rows].reverse().find(r => r.absence === 'vacation')?.date}
          onConfirm={handleVacationConfirm}
          onClear={handleVacationClear}
          onClose={() => setShowVacation(false)}
        />
      )}
    </div>
  )
}

function Tag({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <span className={`text-[9px] rounded px-1 py-0.5 ${warn ? 'text-amber-700 bg-amber-100' : 'bg-gold-200/80 text-honey-700'}`}>
      {text}
    </span>
  )
}


