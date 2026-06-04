import { useState, useRef, useEffect } from 'react'
import { fromMin, toMin, recompute, randomNear, getEffectiveDailyMinutes } from './calc'
import type { EmployeeReport, DayRow, Schedule, AbsenceType } from './calc'

interface Props {
  report: EmployeeReport
  dailyMinutes: number
  onConfirm: (updated: EmployeeReport) => void
  onCancel: () => void
}

// ─── TimeCell ─────────────────────────────────────────────────────────────────

function TimeCell({ value, onChange, generated }: {
  value: string; onChange: (v: string) => void; generated: boolean
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-[72px] text-center text-xs rounded-lg border px-1 py-1 font-mono
        focus:outline-none focus:ring-2 transition-colors
        ${generated
          ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-300/50'
          : 'border-gold-200 bg-white text-honey-950 hover:border-gold-400 focus:ring-gold-300/50'
        }`}
    />
  )
}

// ─── Absence badge ────────────────────────────────────────────────────────────

function AbsenceBadge({ type }: { type: AbsenceType }) {
  if (type === 'justified')
    return <span className="ml-1.5 text-[9px] bg-gold-200 text-honey-800 rounded px-1 py-0.5">f. justificada</span>
  if (type === 'unjustified')
    return <span className="ml-1.5 text-[9px] bg-red-200 text-red-800 rounded px-1 py-0.5">f. injustificada</span>
  return null
}

// ─── ReviewModal ──────────────────────────────────────────────────────────────

export function ReviewModal({ report: initialReport, dailyMinutes, onConfirm, onCancel }: Props) {
  const [rows, setRows] = useState<DayRow[]>(initialReport.rows)
  const [schedule, setSchedule] = useState<Schedule>(initialReport.schedule)
  const tableRef = useRef<HTMLDivElement>(null)

  // Reset scroll to top on every mount (new employee)
  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0 })
  }, [])

  const pendingCount = rows.filter(
    r => r.generated && r.absence === null && !r.isHoliday && r.weekday !== 0 && r.weekday !== 6
  ).length

  // ── update a single row, optionally clearing the generated flag
  function updateRow(i: number, patch: Partial<DayRow>, clearGenerated = false) {
    setRows(prev => {
      const next = [...prev]
      const updated: DayRow = { ...next[i], ...patch }
      if (clearGenerated) updated.generated = false

      const isOff = updated.weekday === 0 || updated.weekday === 6
        || updated.isHoliday || updated.absence !== null
      if (!isOff) {
        const a = toMin(updated.ent1), b = toMin(updated.sai1)
        const c = toMin(updated.ent2), d = toMin(updated.sai2)
        let t = 0, has = false
        if (a !== null && b !== null && b > a) { t += b - a; has = true }
        if (c !== null && d !== null && d > c) { t += d - c; has = true }
        updated.workedMin = has ? t : null
      } else {
        updated.workedMin = null
      }
      next[i] = updated
      return next
    })
  }

  // Toggle absence type — clicking the same type again removes it
  function setAbsence(i: number, type: AbsenceType) {
    const current = rows[i].absence
    const next: AbsenceType = current === type ? null : type
    updateRow(i, {
      absence: next,
      isAtestado: next !== null,
      ent1: next !== null ? '' : rows[i].ent1,
      sai1: next !== null ? '' : rows[i].sai1,
      ent2: next !== null ? '' : rows[i].ent2,
      sai2: next !== null ? '' : rows[i].sai2,
      generated: false,
    })
  }

  function regenerateRow(i: number) {
    updateRow(i, {
      ent1: randomNear(schedule.workStart),
      sai1: randomNear(schedule.breakStart),
      ent2: randomNear(schedule.breakEnd),
      sai2: randomNear(schedule.workEnd),
      generated: true,
    })
  }

  function handleConfirm() {
    // Calcula a carga diária efetiva baseada no schedule configurado
    const effectiveDailyMinutes = getEffectiveDailyMinutes(schedule, dailyMinutes)
    onConfirm(recompute({ ...initialReport, rows, schedule }, effectiveDailyMinutes))
  }

  // Calcula a carga diária efetiva para exibição em tempo real
  const effectiveDailyMinutes = getEffectiveDailyMinutes(schedule, dailyMinutes)

  const totalWorked  = rows.reduce((a, r) => a + (r.workedMin ?? 0), 0)
  const totalBalance = rows.reduce((a, r) => {
    const off = r.weekday === 0 || r.weekday === 6 || r.isHoliday || r.absence !== null
    return a + (r.workedMin !== null && !off ? r.workedMin - effectiveDailyMinutes : 0)
  }, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-honey-950/40 backdrop-blur-md">
      <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/60 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-gold-200/40 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-honey-900 text-base">{initialReport.displayName}</h2>
            <p className="text-xs text-honey-700 mt-0.5">Revise e edite os registros antes de confirmar</p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-100/90 backdrop-blur-sm border border-red-300/60 rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                <span className="text-xs font-semibold text-red-800">
                  {pendingCount} estimado{pendingCount !== 1 ? 's' : ''} — verifique
                </span>
              </div>
            )}
            <button onClick={onCancel}
              className="text-honey-700/50 hover:text-honey-900 w-8 h-8 rounded-lg hover:bg-gold-100/60 flex items-center justify-center text-xl transition-colors">
              ×
            </button>
          </div>
        </div>

        {/* ── Schedule config ──────────────────────────────────────────── */}
        <div className="px-5 py-3 bg-white/50 backdrop-blur-sm border-b border-gold-200/40 flex-shrink-0">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div>
              <p className="text-[10px] font-bold text-honey-800 uppercase tracking-widest">
                Horário padrão — usado na regeneração automática
              </p>
            </div>
            <div className="text-xs font-semibold text-honey-800 bg-gold-100/80 px-3 py-1 rounded-lg">
              {getEffectiveDailyMinutes(schedule, dailyMinutes) < dailyMinutes ? '⏱️ Meio período' : '🕐 Período integral'} · {fromMin(effectiveDailyMinutes)}/dia
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            {([
              ['Entrada', 'workStart'],
              ['Saída p/ almoço', 'breakStart'],
              ['Volta do almoço', 'breakEnd'],
              ['Saída', 'workEnd'],
            ] as [string, keyof Schedule][]).map(([label, field]) => (
              <div key={field} className="flex items-center gap-1.5">
                <label className="text-xs text-honey-700 font-medium whitespace-nowrap">{label}</label>
                <input type="time" value={schedule[field]}
                  onChange={e => setSchedule(s => ({ ...s, [field]: e.target.value }))}
                  className="border border-gold-200/60 rounded-lg px-2 py-1 text-xs font-mono bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gold-300/50 hover:border-gold-300 transition-all text-honey-950" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <div className="px-5 py-2 border-b border-gold-200/40 flex flex-wrap items-center gap-4 text-[11px] text-honey-700 flex-shrink-0 bg-white/30">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-red-300 bg-red-50 flex-shrink-0" />Campo estimado — edite ou ↺ regenera</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-gold-300 bg-gold-100 flex-shrink-0" />Falta justificada</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-red-300 bg-red-100 flex-shrink-0" />Falta injustificada</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-gold-300 bg-gold-50 flex-shrink-0" />Feriado / folga</span>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div ref={tableRef} className="overflow-y-auto flex-1 bg-white/40">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg shadow-sm">
              <tr className="border-b border-gold-200/40">
                {['Dia','Entrada 1','Saída 1','Entrada 2','Saída 2','Total','Saldo','Ações'].map((h, hi) => (
                  <th key={hi} className="px-2 py-2.5 text-[10px] font-bold text-honey-700 uppercase tracking-wide text-center first:text-left first:pl-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isWkd   = row.weekday === 0 || row.weekday === 6
                const isOff   = isWkd || row.isHoliday
                const isAbsent = row.absence !== null
                const showInputs = !isOff && !isAbsent
                const saldo = row.workedMin !== null && !isOff && !isAbsent
                  ? row.workedMin - effectiveDailyMinutes : null

                let rowBg = 'bg-white/70'
                if      (row.absence === 'justified')   rowBg = 'bg-gold-50/80'
                else if (row.absence === 'unjustified') rowBg = 'bg-red-50/60'
                else if (row.isHoliday)  rowBg = 'bg-gold-50/70'
                else if (isWkd)          rowBg = 'bg-gold-50/50'
                else if (row.generated)  rowBg = 'bg-red-50/40'

                return (
                  <tr key={row.date} className={`${rowBg} border-b border-gold-200/30 last:border-0`}>

                    {/* Day label */}
                    <td className="pl-4 pr-2 py-1.5 font-medium whitespace-nowrap">
                      <span className={isOff ? 'text-honey-600/50' : row.generated ? 'text-red-700' : 'text-honey-900'}>
                        {row.dayLabel}
                      </span>
                      {row.isHoliday && (
                        <span className="ml-1.5 text-[9px] bg-gold-200 text-honey-700 rounded px-1 py-0.5">feriado</span>
                      )}
                      <AbsenceBadge type={row.absence} />
                      {row.generated && !isOff && !isAbsent && (
                        <span className="ml-1.5 text-[9px] text-red-500 font-semibold">●estimado</span>
                      )}
                    </td>

                    {/* Time inputs — always editable when not off/absent */}
                    {(['ent1','sai1','ent2','sai2'] as const).map(field => (
                      <td key={field} className="px-1 py-1 text-center">
                        {showInputs ? (
                          <TimeCell
                            value={row[field]}
                            onChange={v => updateRow(i, { [field]: v }, true)}
                            generated={row.generated && !row[field]}
                          />
                        ) : (
                          <span className="text-honey-600/40 font-mono">—</span>
                        )}
                      </td>
                    ))}

                    {/* Total */}
                    <td className="px-2 py-1.5 text-center font-mono text-honey-800">
                      {row.workedMin !== null
                        ? fromMin(row.workedMin)
                        : <span className="text-gold-200">—</span>}
                    </td>

                    {/* Saldo */}
                    <td className={`px-2 py-1.5 text-center font-mono font-semibold
                      ${saldo === null ? 'text-gold-200' : saldo < 0 ? 'text-red-500' : saldo > 0 ? 'text-emerald-600' : 'text-honey-600'}`}>
                      {saldo !== null ? (saldo > 0 ? '+' : '') + fromMin(saldo) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1.5">
                      {!isWkd && !row.isHoliday && (
                        <div className="flex items-center justify-center gap-1 flex-wrap">

                          {/* Falta Justificada */}
                          <button
                            onClick={() => setAbsence(i, 'justified')}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium transition-colors whitespace-nowrap
                              ${row.absence === 'justified'
                                ? 'bg-gold-200 border-gold-400 text-honey-900'
                                : 'bg-white/80 border-gold-200/60 text-honey-700 hover:bg-gold-50 hover:border-gold-400 hover:text-honey-800'
                              }`}
                          >
                            {row.absence === 'justified' ? '✕ Justif.' : 'F. Justificada'}
                          </button>

                          {/* Falta Injustificada */}
                          <button
                            onClick={() => setAbsence(i, 'unjustified')}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium transition-colors whitespace-nowrap
                              ${row.absence === 'unjustified'
                                ? 'bg-red-200 border-red-400 text-red-900'
                                : 'bg-white/80 border-gold-200/60 text-honey-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                              }`}
                          >
                            {row.absence === 'unjustified' ? '✕ Injustif.' : 'F. Injustificada'}
                          </button>

                          {/* Regenerate — only when no absence */}
                          {row.absence === null && (
                            <button
                              onClick={() => regenerateRow(i)}
                              title="Regenerar horários"
                              className="text-[10px] w-6 h-6 rounded-md border border-gold-200/60 bg-white/80 text-honey-700 hover:bg-gold-50 hover:border-gold-400 hover:text-honey-800 transition-colors flex items-center justify-center"
                            >↺</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-gold-200/40 flex items-center gap-5 flex-shrink-0 bg-white/80 backdrop-blur-lg">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-honey-800">Total: <b className="text-honey-950 font-mono">{fromMin(totalWorked)}</b></span>
            <span className="text-gold-400">|</span>
            <span className="text-honey-800">Saldo: <b className={`font-mono ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {(totalBalance >= 0 ? '+' : '') + fromMin(totalBalance)}
            </b></span>
            {pendingCount > 0 && (
              <>
                <span className="text-gold-300">|</span>
                <span className="text-red-600 font-medium">{pendingCount} estimado{pendingCount !== 1 ? 's' : ''} sem revisão</span>
              </>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gold-200/60 bg-white/70 text-honey-800 hover:bg-gold-50/80 transition-colors backdrop-blur-sm">
              Cancelar
            </button>
            <button onClick={handleConfirm}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-honey-800 hover:bg-honey-900 text-white transition-colors shadow-lg shadow-gold-200">
              {pendingCount > 0 ? 'Confirmar mesmo assim' : 'Confirmar →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
