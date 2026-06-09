import type { Schedule } from './parseAfd'

export type { Schedule }

export type AbsenceType = 'justified' | 'unjustified' | 'vacation' | null
export type AbsenceScope = 'full' | 'period1' | 'period2' | null
export type DayGapIssue = 'none' | 'empty' | 'partial' | 'extra_punches' | 'odd_punches'

export interface PunchInterval {
  entrada: string
  saida: string
}

export interface DayRow {
  date: string
  dayLabel: string
  weekday: number
  isHoliday: boolean
  isAtestado: boolean
  absence: AbsenceType
  absenceScope: AbsenceScope
  ent1: string
  sai1: string
  ent2: string
  sai2: string
  extraPunches: string[]
  intervals: PunchInterval[]
  generated: boolean
  gapIssue: DayGapIssue
  workedMin: number | null
}

export interface EmployeeReport {
  key: string
  displayName: string
  rows: DayRow[]
  totalWorked: number
  totalBalance: number
  workedDays: number
  utilDays: number
  schedule: Schedule
  specialMode: boolean
  notes: string
  autoNotes: string[]
  cpf?: string
  pis?: string
  role?: string
  department?: string
  admissionDate?: string
  toleranceCLT: boolean
  previousBalanceMin?: number
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toMin(t: string): number | null {
  if (!t || !t.includes(':')) return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export function fromMin(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(minutes)
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function getEffectiveDailyMinutes(schedule: Schedule, defaultDailyMinutes: number): number {
  const workStart = toMin(schedule.workStart)
  const breakStart = toMin(schedule.breakStart)
  const breakEnd = toMin(schedule.breakEnd)
  const workEnd = toMin(schedule.workEnd)
  const isHalfDay = breakStart === null || breakEnd === null || breakStart === breakEnd
  if (isHalfDay && workStart !== null && workEnd !== null && workEnd > workStart) {
    return workEnd - workStart
  }
  if (workStart !== null && breakStart !== null && breakEnd !== null && workEnd !== null) {
    const p1 = Math.max(0, breakStart - workStart)
    const p2 = Math.max(0, workEnd - breakEnd)
    const total = p1 + p2
    return total > 0 ? total : defaultDailyMinutes
  }
  return defaultDailyMinutes
}

function randInt(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a
}

export function randomNear(base: string, spread = 12): string {
  const b = toMin(base)
  if (b === null) return base
  return fromMin(Math.max(0, Math.min(b + randInt(-spread, spread), 23 * 60 + 59)))
}

export function calcWorkedFromFour(e1: string, s1: string, e2: string, s2: string): number | null {
  const a = toMin(e1), b = toMin(s1), c = toMin(e2), d = toMin(s2)
  let total = 0, has = false
  if (a !== null && b !== null && b > a) { total += b - a; has = true }
  if (c !== null && d !== null && d > c) { total += d - c; has = true }
  return has ? total : null
}

export function timesToIntervals(times: string[]): PunchInterval[] {
  const sorted = [...times].sort()
  const out: PunchInterval[] = []
  for (let i = 0; i < sorted.length; i += 2) {
    out.push({ entrada: sorted[i] ?? '', saida: sorted[i + 1] ?? '' })
  }
  return out
}

export function calcWorkedFromIntervals(intervals: PunchInterval[]): number | null {
  let total = 0, has = false
  for (const { entrada, saida } of intervals) {
    const a = toMin(entrada), b = toMin(saida)
    if (a !== null && b !== null && b > a) { total += b - a; has = true }
  }
  return has ? total : null
}

export function intervalsToSlots(intervals: PunchInterval[]) {
  return {
    ent1: intervals[0]?.entrada ?? '',
    sai1: intervals[0]?.saida ?? '',
    ent2: intervals[1]?.entrada ?? '',
    sai2: intervals[1]?.saida ?? '',
  }
}

export function formatIntervalsShort(intervals: PunchInterval[]): string {
  return intervals
    .filter(iv => iv.entrada)
    .map(iv => iv.saida ? `${iv.entrada}–${iv.saida}` : `${iv.entrada}–?`)
    .join(', ')
}

export function formatAutoNoteSpecial(dayLabel: string, intervals: PunchInterval[], total: number): string {
  return `Recursos Especiais — ${dayLabel}: ${formatIntervalsShort(intervals)} (total ${fromMin(total)}).`
}

export function absenceLabel(absence: AbsenceType, scope: AbsenceScope): string {
  if (absence === null) return ''
  if (absence === 'vacation') return 'Férias'
  const kind = absence === 'justified' ? 'Falta justificada' : 'Falta injustificada'
  if (scope === 'period1') return `${kind} (manhã)`
  if (scope === 'period2') return `${kind} (tarde)`
  return kind
}

export function isWeekendOrHoliday(row: DayRow): boolean {
  return row.weekday === 0 || row.weekday === 6 || row.isHoliday
}

export function isFullDayAbsent(row: DayRow): boolean {
  return row.absence !== null && (row.absenceScope === 'full' || row.absenceScope === null || row.absence === 'vacation')
}

export function canEditPeriod(row: DayRow, period: 1 | 2): boolean {
  if (isWeekendOrHoliday(row)) return false
  if (row.absence === null) return true
  if (isFullDayAbsent(row)) return false
  if (row.absenceScope === 'period1' && period === 1) return false
  if (row.absenceScope === 'period2' && period === 2) return false
  return true
}

export function classifyGapIssue(times: string[], isOff: boolean, generated: boolean): DayGapIssue {
  if (isOff) return 'none'
  if (times.length === 0) return 'empty'
  if (times.length > 4) return 'extra_punches'
  if (times.length % 2 !== 0) return 'odd_punches'
  if (generated) return 'partial'
  if (times.length === 2) return 'none'
  if (times.length > 0 && times.length < 4) return 'partial'
  return 'none'
}

export function calcDayBalance(row: DayRow, dailyMin: number, toleranceCLT = false): number | null {
  if (isWeekendOrHoliday(row)) return null
  if (row.absence === 'vacation') return null
  const half = Math.floor(dailyMin / 2)
  let raw = 0
  if (row.absence === 'justified') {
    if (isFullDayAbsent(row)) return null
    const expected = row.absenceScope === 'period1' || row.absenceScope === 'period2' ? half : dailyMin
    if (row.workedMin === null) return null
    raw = row.workedMin - expected
  } else if (row.absence === 'unjustified') {
    if (isFullDayAbsent(row)) return -dailyMin
    raw = row.workedMin !== null ? row.workedMin - half : -half
  } else {
    if (row.workedMin === null) return null
    raw = row.workedMin - dailyMin
  }
  if (toleranceCLT && Math.abs(raw) <= 10) return 0
  return raw
}

export function computeRowWorkedMin(row: DayRow, specialMode: boolean): number | null {
  if (isWeekendOrHoliday(row)) return null
  if (isFullDayAbsent(row)) return null
  if (row.generated) return null
  if (specialMode && row.intervals.length > 0) return calcWorkedFromIntervals(row.intervals)
  return calcWorkedFromFour(row.ent1, row.sai1, row.ent2, row.sai2)
}

function fillStandardSlots(times: string[], _schedule: Schedule, isOff: boolean) {
  let ent1 = '', sai1 = '', ent2 = '', sai2 = '', generated = false
  const extraPunches = times.length > 4 ? times.slice(4) : []
  if (isOff) {
    ent1 = times[0] ?? ''; sai1 = times[1] ?? ''; ent2 = times[2] ?? ''; sai2 = times[3] ?? ''
  } else if (times.length === 0) {
    // sem batidas — deixa vazio
  } else if (times.length === 1) {
    ent1 = times[0]
  } else if (times.length === 2) {
    ent1 = times[0]; sai1 = times[1]
  } else if (times.length === 3) {
    ent1 = times[0]; sai1 = times[1]; ent2 = times[2]
  } else {
    ent1 = times[0]; sai1 = times[1]; ent2 = times[2]; sai2 = times[3]
  }
  return { ent1, sai1, ent2, sai2, extraPunches, generated }
}

export function buildReport(
  key: string,
  displayName: string,
  marks: Record<string, string[]>,
  year: number,
  month: number,
  dailyMinutes: number,
  schedule: Schedule,
  holidays: Set<string>,
  toleranceCLT: boolean,
  cpf?: string,
  pis?: string,
): EmployeeReport {
  const total = daysInMonth(year, month)
  const rows: DayRow[] = []
  let totalWorked = 0, totalBalance = 0, workedDays = 0, utilDays = 0
  let anyExtra = false, anyOdd = false

  for (let d = 1; d <= total; d++) {
    const date = `${year}-${pad2(month)}-${pad2(d)}`
    const wday = new Date(`${date}T00:00:00`).getDay()
    const isHoliday = holidays.has(date)
    const isOff = wday === 0 || wday === 6 || isHoliday
    const times = marks[date] ? [...marks[date]].sort() : []
    if (!isOff) utilDays++
    if (times.length > 4) anyExtra = true
    if (times.length > 0 && times.length % 2 !== 0) anyOdd = true
    const slots = fillStandardSlots(times, schedule, isOff)
    const intervals = timesToIntervals(times)
    const gapIssue = classifyGapIssue(times, isOff, slots.generated)
    rows.push({
      date, dayLabel: `${pad2(d)} ${WEEKDAYS[wday]}`, weekday: wday,
      isHoliday, isAtestado: false, absence: null, absenceScope: null,
      ent1: slots.ent1, sai1: slots.sai1, ent2: slots.ent2, sai2: slots.sai2,
      extraPunches: slots.extraPunches, intervals, generated: slots.generated,
      gapIssue, workedMin: null,
    })
  }

  const specialMode = anyExtra || anyOdd
  const autoNotes: string[] = []
  if (specialMode) autoNotes.push('Recursos Especiais ativado para este funcionário.')

  const effectiveMin = getEffectiveDailyMinutes(schedule, dailyMinutes)
  for (const row of rows) {
    const isOff = isWeekendOrHoliday(row)
    row.workedMin = isOff ? null : computeRowWorkedMin(row, specialMode)
    const bal = calcDayBalance(row, effectiveMin, toleranceCLT)
    if (row.workedMin !== null && row.workedMin > 0 && !isOff && bal !== null) {
      totalWorked += row.workedMin; workedDays++; totalBalance += bal
    }
    if (!isOff && specialMode) {
      const hasSpecial = row.intervals.length > 2 || row.extraPunches.length > 0 || row.gapIssue === 'extra_punches' || row.gapIssue === 'odd_punches'
      if (hasSpecial && row.workedMin !== null && row.workedMin > 0) {
        autoNotes.push(formatAutoNoteSpecial(row.dayLabel, row.intervals, row.workedMin))
      }
    }
  }

  return { key, displayName, rows, totalWorked, totalBalance, workedDays, utilDays, schedule, specialMode, notes: '', autoNotes, cpf, pis, toleranceCLT }
}

export function recompute(report: EmployeeReport, dailyMinutes: number): EmployeeReport {
  const effectiveMin = getEffectiveDailyMinutes(report.schedule, dailyMinutes)
  const rows = report.rows.map(row => {
    const isOff = isWeekendOrHoliday(row)
    const wm = isOff ? null : computeRowWorkedMin(row, report.specialMode)
    return { ...row, isAtestado: row.absence !== null, workedMin: wm }
  })
  let totalWorked = 0, totalBalance = 0, workedDays = 0
  for (const row of rows) {
    const isOff = isWeekendOrHoliday(row)
    const bal = calcDayBalance(row, effectiveMin, report.toleranceCLT)
    if (row.workedMin !== null && row.workedMin > 0 && !isOff) {
      if (row.absence === null || (row.absence === 'justified' && !isFullDayAbsent(row))) {
        totalWorked += row.workedMin; workedDays++
      }
    }
    if (bal !== null && !isOff) {
      if (row.absence === null) totalBalance += bal
      else if (row.absence === 'justified' && !isFullDayAbsent(row)) totalBalance += bal
      else if (row.absence === 'unjustified') totalBalance += bal
    }
  }
  totalBalance += (report.previousBalanceMin ?? 0)
  return { ...report, rows, totalWorked, totalBalance, workedDays }
}

export function appendAutoNote(notes: string[], line: string): string[] {
  if (notes.includes(line)) return notes
  return [...notes, line]
}

export function exportToCsv(reports: EmployeeReport[], monthLabel: string) {
  const headers = ['PIS', 'Nome', 'CPF', 'Cargo', 'Setor', 'Admissão', 'Dias Trabalhados', 'Total Horas', 'Saldo', 'Situação']
  const rows = reports.map(r => {
    const situacao = r.rows.some(row => row.absence === 'vacation') ? 'Férias' : r.totalBalance < -60 ? 'Débito' : r.totalBalance > 60 ? 'Crédito' : 'Regular'
    return [
      r.pis || r.key || '',
      r.displayName,
      r.cpf || '',
      r.role || '',
      r.department || '',
      r.admissionDate || '',
      r.workedDays,
      fromMin(r.totalWorked),
      (r.totalBalance >= 0 ? '+' : '') + fromMin(r.totalBalance),
      situacao,
    ]
  })
  const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.map(v => `"${v}"`).join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Ponto_${monthLabel.replace(/\s+/g, '_')}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
