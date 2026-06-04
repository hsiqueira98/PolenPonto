import type { Schedule } from './parseAfd'

export type { Schedule }

export type AbsenceType = 'justified' | 'unjustified' | null

export interface DayRow {
  date: string
  dayLabel: string
  weekday: number       // 0=Dom…6=Sab
  isHoliday: boolean    // marked as holiday/folga
  isAtestado: boolean   // kept for compat — true when absence !== null
  absence: AbsenceType  // 'justified' | 'unjustified' | null
  ent1: string; sai1: string
  ent2: string; sai2: string
  generated: boolean    // any field was auto-generated
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
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function pad2(n: number): string { return String(n).padStart(2, '0') }

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

/**
 * Calcula a carga diária efetiva baseada no schedule.
 * Se o funcionário só tem período simples (sem almoço), detecta automaticamente.
 */
export function getEffectiveDailyMinutes(schedule: Schedule, defaultDailyMinutes: number): number {
  const workStart = toMin(schedule.workStart)
  const breakStart = toMin(schedule.breakStart)
  const breakEnd = toMin(schedule.breakEnd)
  const workEnd = toMin(schedule.workEnd)

  // Se breakStart e breakEnd são inválidos ou vazios → é meio período
  const isHalfDay = breakStart === null || breakEnd === null || breakStart === breakEnd

  if (isHalfDay && workStart !== null && workEnd !== null && workEnd > workStart) {
    // Meio período: apenas Entrada 1 a Saída 1
    return workEnd - workStart
  }

  // Período integral: calcula o período completo
  if (workStart !== null && breakStart !== null && breakEnd !== null && workEnd !== null) {
    const period1 = Math.max(0, breakStart - workStart)
    const period2 = Math.max(0, workEnd - breakEnd)
    const total = period1 + period2
    return total > 0 ? total : defaultDailyMinutes
  }

  return defaultDailyMinutes
}

function randInt(a: number, b: number): number { return Math.floor(Math.random() * (b - a + 1)) + a }

export function randomNear(base: string, spread = 12): string {
  const b = toMin(base)
  if (b === null) return base
  return fromMin(Math.max(0, Math.min(b + randInt(-spread, spread), 23 * 60 + 59)))
}

function calcWorked(e1: string, s1: string, e2: string, s2: string): number | null {
  const a = toMin(e1), b = toMin(s1), c = toMin(e2), d = toMin(s2)
  let total = 0, has = false
  if (a !== null && b !== null && b > a) { total += b - a; has = true }
  if (c !== null && d !== null && d > c) { total += d - c; has = true }
  return has ? total : null
}

export function buildReport(
  key: string,
  displayName: string,
  marks: Record<string, string[]>,
  year: number,
  month: number,
  dailyMinutes: number,
  schedule: Schedule,
  holidays: Set<string>,   // YYYY-MM-DD strings
): EmployeeReport {
  const total = daysInMonth(year, month)
  const rows: DayRow[] = []
  let totalWorked = 0, totalBalance = 0, workedDays = 0, utilDays = 0

  for (let d = 1; d <= total; d++) {
    const date = `${year}-${pad2(month)}-${pad2(d)}`
    const wday = new Date(`${date}T00:00:00`).getDay()
    const isWeekend = wday === 0 || wday === 6
    const isHoliday = holidays.has(date)
    const isOff = isWeekend || isHoliday
    const times = marks[date] ? [...marks[date]] : []

    if (!isOff) utilDays++

    let ent1 = '', sai1 = '', ent2 = '', sai2 = '', generated = false

    if (isOff) {
      // Weekends/holidays: use marks as-is, no generation
      if (times.length >= 1) ent1 = times[0]
      if (times.length >= 2) sai1 = times[1]
      if (times.length >= 3) ent2 = times[2]
      if (times.length >= 4) sai2 = times[3]
    } else if (times.length === 0) {
      ent1 = randomNear(schedule.workStart); sai1 = randomNear(schedule.breakStart)
      ent2 = randomNear(schedule.breakEnd);  sai2 = randomNear(schedule.workEnd)
      generated = true
    } else if (times.length === 1) {
      ent1 = times[0]
      sai1 = randomNear(schedule.breakStart); ent2 = randomNear(schedule.breakEnd); sai2 = randomNear(schedule.workEnd)
      generated = true
    } else if (times.length === 2) {
      ent1 = times[0]; sai1 = times[1]
    } else if (times.length === 3) {
      ent1 = times[0]; sai1 = times[1]; ent2 = times[2]
      sai2 = randomNear(schedule.workEnd); generated = true
    } else {
      ent1 = times[0]; sai1 = times[1]; ent2 = times[2]; sai2 = times[3]
    }

    const workedMin = isHoliday ? null : calcWorked(ent1, sai1, ent2, sai2)
    if (workedMin !== null && workedMin > 0 && !isOff) {
      totalWorked += workedMin
      workedDays++
      totalBalance += workedMin - dailyMinutes
    }

    rows.push({ date, dayLabel: `${pad2(d)} ${WEEKDAYS[wday]}`, weekday: wday, isHoliday, isAtestado: false, absence: null, ent1, sai1, ent2, sai2, generated, workedMin })
  }

  return { key, displayName, rows, totalWorked, totalBalance, workedDays, utilDays, schedule }
}

/** Recompute totals from edited rows */
export function recompute(report: EmployeeReport, dailyMinutes: number): EmployeeReport {
  let totalWorked = 0, totalBalance = 0, workedDays = 0
  const rows = report.rows.map(row => {
    const isOff = row.weekday === 0 || row.weekday === 6 || row.isHoliday || row.absence !== null
    const wm = isOff ? null : (() => {
      const a = toMin(row.ent1), b = toMin(row.sai1), c = toMin(row.ent2), d = toMin(row.sai2)
      let t = 0, has = false
      if (a !== null && b !== null && b > a) { t += b - a; has = true }
      if (c !== null && d !== null && d > c) { t += d - c; has = true }
      return has ? t : null
    })()
    if (wm !== null && wm > 0 && !isOff) { totalWorked += wm; workedDays++; totalBalance += wm - dailyMinutes }
    return { ...row, isAtestado: row.absence !== null, workedMin: wm }
  })
  return { ...report, rows, totalWorked, totalBalance, workedDays }
}
