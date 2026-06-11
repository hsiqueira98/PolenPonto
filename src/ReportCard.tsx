import {
  fromMin, toMin, getEffectiveDailyMinutes, calcDayBalance,
  absenceLabel, isWeekendOrHoliday, isFullDayAbsent, formatIntervalsShort,
} from './calc'
import type { EmployeeReport, DayRow } from './calc'

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function monthLabel(val: string) {
  const [y, m] = val.split('-').map(Number)
  if (!y || !m) return val
  return `${MONTH_NAMES[m - 1]} de ${y}`
}

function todayFmt() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface Props {
  report: EmployeeReport
  month: string
  carga: string
  empresa: string
  cnpj: string
  isLast: boolean
  onEdit?: () => void
}

function DayCells({ row, isOff }: { row: DayRow; isOff: boolean }) {
  if (isFullDayAbsent(row)) {
    const isVac = row.absence === 'vacation'
    return (
      <td colSpan={4} className="px-2 py-1.5 text-center font-semibold text-xs">
        <span className={isVac ? 'text-blue-700' : row.absence === 'justified' ? 'text-amber-800' : 'text-red-700'}>
          {absenceLabel(row.absence!, row.absenceScope)}
        </span>
      </td>
    )
  }

  const partial = row.absence !== null && !isFullDayAbsent(row)
  const fields = [row.ent1, row.sai1, row.ent2, row.sai2] as const

  return (
    <>
      {fields.map((t, i) => {
        const period = i < 2 ? 1 : 2
        const blocked = partial && ((row.absenceScope === 'period1' && period === 1) || (row.absenceScope === 'period2' && period === 2))
        return (
          <td key={i} className={`px-2 py-1.5 text-center font-mono text-xs ${t ? 'text-honey-900' : 'text-gold-300'}`}>
            {isOff ? '—' : blocked ? <span className="text-[10px] font-sans font-medium text-amber-700/80">just.</span> : (t || '—')}
          </td>
        )
      })}
    </>
  )
}

export function ReportCard({ report, month, carga, empresa, cnpj, isLast, onEdit }: Props) {
  const cargaMin = toMin(carga) ?? 480
  const effectiveMin = getEffectiveDailyMinutes(report.schedule, cargaMin)
  const extras = Math.max(0, report.totalBalance)
  const debitos = Math.min(0, report.totalBalance)
  const saldoPos = report.totalBalance >= 0
  const colSaldo = (v: number) => v < 0 ? 'text-red-600' : v > 0 ? 'text-emerald-600' : 'text-honey-500'
  const hasVacation = report.rows.some(r => r.absence === 'vacation')

  return (
    <>
      <div className="print:hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-gold-200/45 shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gold-200/40 flex flex-wrap items-start justify-between gap-3 bg-white/40">
          <div>
            <h2 className="font-bold text-honey-950 text-lg">{report.displayName}</h2>
            <div className="flex items-center flex-wrap gap-2 mt-0.5">
              <p className="text-[11px] text-honey-600 font-mono">{report.key}</p>
              {report.role && <span className="text-[11px] text-honey-600">· {report.role}</span>}
              {report.department && <span className="text-[11px] text-honey-500">· {report.department}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {report.specialMode && (
                <span className="text-[10px] font-semibold bg-honey-100 text-honey-800 border border-honey-200 rounded-md px-2 py-0.5">
                  Recursos Especiais
                </span>
              )}
              {hasVacation && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-2 py-0.5">
                  Férias no período
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <Pill label="Trabalhado" value={fromMin(report.totalWorked)} />
            <Pill label="Saldo" value={(saldoPos ? '+' : '') + fromMin(report.totalBalance)} variant={saldoPos ? 'green' : 'red'} />
            {onEdit && (
              <button type="button" onClick={onEdit}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gold-200 bg-white/80 text-honey-700 hover:bg-gold-50 hover:border-gold-300 transition-colors self-end">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Editar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-gold-50/45 border-b border-gold-200">
                {['Dia', 'Ent 1', 'Saí 1', 'Ent 2', 'Saí 2', 'Total', 'Saldo'].map(h => (
                  <th key={h} className="px-2 py-2.5 text-[10px] font-bold text-honey-700 uppercase tracking-wide text-center first:text-left first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map(row => {
                const isOff = isWeekendOrHoliday(row)
                const saldo = calcDayBalance(row, effectiveMin)
                const isVac = row.absence === 'vacation'
                return (
                  <tr key={row.date}
                    className={`border-b border-gold-100/60 last:border-0 hover:bg-gold-50/20 transition-colors
                      ${isVac ? 'bg-blue-50/40' : ''}
                      ${!isVac && row.absence === 'justified' ? 'bg-amber-50/40' : ''}
                      ${!isVac && row.absence === 'unjustified' ? 'bg-red-50/30' : ''}
                      ${!row.absence && row.isHoliday ? 'bg-gold-50/30' : ''}
                      ${!row.absence && (row.weekday === 0 || row.weekday === 6) ? 'bg-gold-50/15' : ''}`}>
                    <td className="pl-5 pr-2 py-1.5 font-medium text-honey-900 whitespace-nowrap align-middle">
                      {row.dayLabel}
                      {row.isHoliday && <span className="ml-1 text-[9px] bg-gold-200/80 text-honey-700 rounded px-1">feriado</span>}
                      {isVac && <span className="ml-1 text-[9px] bg-blue-100 text-blue-700 rounded px-1">férias</span>}
                      {row.absence && !isFullDayAbsent(row) && (
                        <span className="ml-1 text-[9px] text-amber-800">{absenceLabel(row.absence, row.absenceScope)}</span>
                      )}
                      {report.specialMode && row.intervals.length > 2 && (
                        <span className="block text-[9px] text-honey-600 font-normal font-sans mt-0.5 max-w-[140px] truncate" title={formatIntervalsShort(row.intervals)}>
                          {formatIntervalsShort(row.intervals)}
                        </span>
                      )}
                    </td>
                    <DayCells row={row} isOff={isOff} />
                    <td className="px-2 py-1.5 text-center font-mono font-medium text-honey-800 align-middle">
                      {row.workedMin !== null ? fromMin(row.workedMin) : <span className="text-gold-300">—</span>}
                    </td>
                    <td className={`px-2 py-1.5 text-center font-mono font-semibold align-middle ${saldo !== null ? colSaldo(saldo) : 'text-gold-300'}`}>
                      {saldo !== null ? (saldo > 0 ? '+' : '') + fromMin(saldo) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {report.notes.trim() && (
          <div className="px-5 py-3 border-t border-gold-200/40 bg-gold-50/20 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-honey-700 uppercase tracking-widest mb-1.5">Observações</p>
            <div className="text-sm text-honey-800 leading-relaxed whitespace-pre-line">{report.notes.trim()}</div>
          </div>
        )}
        {report.autoNotes.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gold-100/60 bg-white/30">
            <p className="text-[10px] font-bold text-honey-600/70 uppercase tracking-widest mb-1">Registros automáticos</p>
            <div className="space-y-0.5">
              {report.autoNotes.map((n, i) => (
                <p key={i} className="text-[11px] text-honey-600 pl-2 border-l-2 border-gold-200">{n}</p>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-2.5 bg-white/50 backdrop-blur-md border-t border-gold-200/30 flex flex-wrap gap-4 text-xs text-honey-800">
          <span><b className="text-honey-950">{report.workedDays}</b> dias trabalhados</span>
          <span><b className="text-honey-950">{fromMin(report.totalWorked)}</b> horas</span>
          <span>Saldo <b className={saldoPos ? 'text-emerald-600' : 'text-red-600'}>{(saldoPos ? '+' : '') + fromMin(report.totalBalance)}</b></span>
          {report.previousBalanceMin !== undefined && report.previousBalanceMin !== 0 && (
            <span className="text-honey-600">
              Saldo ant.: <b className={report.previousBalanceMin >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {(report.previousBalanceMin >= 0 ? '+' : '') + fromMin(report.previousBalanceMin)}
              </b>
            </span>
          )}
          <span className="text-honey-600">Carga ref.: {fromMin(effectiveMin)}/dia</span>
        </div>
      </div>

      <PrintPage
        report={report} month={month} carga={carga} effectiveMin={effectiveMin}
        empresa={empresa} cnpj={cnpj} extras={extras} debitos={debitos}
        saldoPos={saldoPos} isLast={isLast}
      />
    </>
  )
}

function Pill({ label, value, variant = 'gray' }: { label: string; value: string; variant?: 'gray' | 'green' | 'red' }) {
  const cls = variant === 'green' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : variant === 'red' ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-gold-50 text-honey-800 border-gold-200'
  return (
    <div className={`rounded-xl px-3 py-1.5 text-right border ${cls}`}>
      <p className="text-[10px] font-medium opacity-80">{label}</p>
      <p className="text-sm font-bold font-mono">{value}</p>
    </div>
  )
}

interface PrintProps {
  report: EmployeeReport; month: string; carga: string; effectiveMin: number
  empresa: string; cnpj: string; extras: number; debitos: number
  saldoPos: boolean; isLast: boolean
}

function PrintPage({ report, month, carga, effectiveMin, empresa, cnpj, extras, debitos, saldoPos, isLast }: PrintProps) {
  const col = (v: number) => v < 0 ? '#c0392b' : v > 0 ? '#16a34a' : '#8a6e1f'
  const half = Math.ceil(report.rows.length / 2)
  const leftRows = report.rows.slice(0, half)
  const rightRows = report.rows.slice(half)
  const saldoTexto = saldoPos
    ? `Banco de horas em crédito de ${fromMin(extras)}.`
    : `Banco de horas em débito de ${fromMin(Math.abs(debitos))}.`

  type CSS = React.CSSProperties
  const s: Record<string, CSS> = {
    page: { fontFamily: "'Helvetica Neue',Arial,sans-serif", fontSize: '8.5pt', color: '#3a2d22', padding: '1.4cm 1.6cm', lineHeight: '1.5', pageBreakAfter: isLast ? 'auto' : 'always' },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #5a4d38', paddingBottom: '7pt', marginBottom: '10pt' },
    empBox: { display: 'flex', alignItems: 'center', gap: '8pt', background: '#fffaf0', border: '1px solid #dccaa6', borderRadius: '5pt', padding: '7pt 10pt', marginBottom: '10pt' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8pt', marginBottom: '10pt' },
    stat: { textAlign: 'center', background: '#fff', border: '1px solid #e8dcc4', borderRadius: '4pt', padding: '4pt 8pt', minWidth: '58pt' },
    th: { padding: '3.5pt 4pt', fontWeight: 700, fontSize: '7pt', letterSpacing: '0.2px', textAlign: 'center' as const },
    td: { padding: '2.5pt 4pt', textAlign: 'center' as const, fontFamily: 'monospace', borderBottom: '1px solid #fffde8', fontSize: '7.5pt' },
    conclude: { background: '#fffaf0', border: '1px solid #dccaa6', borderRadius: '4pt', padding: '7pt 10pt', fontSize: '8pt', lineHeight: '1.7', color: '#333' },
    obsBox: { background: '#fffef8', border: '1px solid #e8dcc4', borderRadius: '4pt', padding: '6pt 10pt', marginBottom: '10pt', fontSize: '7.5pt', lineHeight: '1.6' },
    sig: { width: '170pt', textAlign: 'center' as const },
    footer: { marginTop: '10pt', borderTop: '1px solid #eee', paddingTop: '5pt', display: 'flex', justifyContent: 'space-between', fontSize: '6.5pt', color: '#bbb' },
  }

  function PrintRow({ row, stripe }: { row: DayRow; stripe: boolean }) {
    const isOff = isWeekendOrHoliday(row)
    const saldo = calcDayBalance(row, effectiveMin)
    const bg = stripe ? '#faf9f3' : '#fff'
    const isVac = row.absence === 'vacation'

    if (isFullDayAbsent(row)) {
      return (
        <tr style={{ background: isVac ? '#eff6ff' : bg }}>
          <td style={{ ...s.td, textAlign: 'left', color: '#3a2d22' }}>
            {row.dayLabel}
          </td>
          <td colSpan={6} style={{ ...s.td, fontWeight: 600, color: isVac ? '#1d4ed8' : row.absence === 'justified' ? '#b8932d' : '#c0392b' }}>
            {absenceLabel(row.absence!, row.absenceScope)}
          </td>
        </tr>
      )
    }

    if (row.isHoliday && !row.absence) {
      return (
        <tr style={{ background: '#f3f4f6' }}>
          <td style={{ ...s.td, textAlign: 'left', color: '#3a2d22' }}>{row.dayLabel}</td>
          <td colSpan={6} style={{ ...s.td, fontWeight: 600, color: '#9ca3af', textAlign: 'center' }}>
            Feriado
          </td>
        </tr>
      )
    }

    return (
      <tr style={{ background: bg }}>
        <td style={{ ...s.td, textAlign: 'left', fontWeight: 500, color: '#3a2d22' }}>
          {row.dayLabel}
          {row.absence && !isFullDayAbsent(row) && (
            <div style={{ fontSize: '6pt', color: '#b8932d', fontFamily: 'sans-serif' }}>{absenceLabel(row.absence, row.absenceScope)}</div>
          )}
        </td>
        {[row.ent1, row.sai1, row.ent2, row.sai2].map((t, ti) => (
          <td key={ti} style={{ ...s.td, color: t ? '#3a2d22' : '#d4c5b0' }}>{isOff ? '—' : t || '—'}</td>
        ))}
        <td style={{ ...s.td, color: row.workedMin !== null ? '#3a2d22' : '#d4c5b0' }}>
          {row.workedMin !== null ? fromMin(row.workedMin) : '—'}
        </td>
        <td style={{ ...s.td, fontWeight: 600, color: saldo !== null ? col(saldo) : '#d4c5b0' }}>
          {saldo !== null ? (saldo > 0 ? '+' : '') + fromMin(saldo) : '—'}
        </td>
      </tr>
    )
  }

  function MiniTable({ rows }: { rows: DayRow[] }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#5d4d38', color: '#fffef8' }}>
            {['Dia', 'Ent 1', 'Saí 1', 'Ent 2', 'Saí 2', 'Total', 'Saldo'].map(h => (
              <th key={h} style={{ ...s.th, textAlign: h === 'Dia' ? 'left' : 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => <PrintRow key={row.date} row={row} stripe={i % 2 === 1} />)}
        </tbody>
      </table>
    )
  }

  return (
    <div className="hidden print:block" style={s.page}>
      <div style={s.topBar}>
        <div>
          <div style={{ fontSize: '15pt', fontWeight: 800, color: '#5d4d38' }}>Espelho de Ponto</div>
          <div style={{ fontSize: '8pt', color: '#8a7560', marginTop: '2pt' }}>
            {empresa || 'Relatório de Frequência'} {cnpj ? ` · CNPJ: ${cnpj}` : ''} · {monthLabel(month)}
            {report.specialMode ? ' · Recursos Especiais' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '7.5pt', color: '#a89968' }}>
          <div>Emitido em {todayFmt()}</div>
          <div>Jornada ref.: {carga} · efetiva {fromMin(effectiveMin)}/dia</div>
        </div>
      </div>

      <div style={s.empBox}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11pt', fontWeight: 700, color: '#5d4d38', marginBottom: '2pt' }}>{report.displayName}</div>
          <div style={{ fontSize: '7pt', color: '#8a7560', display: 'flex', gap: '8pt', flexWrap: 'wrap' }}>
            {report.cpf && <span>CPF: {report.cpf}</span>}
            {(report.pis || report.key) && <span>PIS: {report.pis || report.key}</span>}
            {report.role && <span>Cargo: {report.role}</span>}
            {report.department && <span>Setor: {report.department}</span>}
            {report.admissionDate && <span>Admissão: {report.admissionDate.split('-').reverse().join('/')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5pt' }}>
          {[
            { label: 'Dias trab.', val: `${report.workedDays}`, c: '#3a2d22' },
            { label: 'Total horas', val: fromMin(report.totalWorked), c: '#3a2d22' },
            { label: 'Saldo', val: (saldoPos ? '+' : '') + fromMin(report.totalBalance), c: col(report.totalBalance) },
          ].map(b => (
            <div key={b.label} style={s.stat}>
              <div style={{ fontSize: '6.5pt', color: '#8a7560', textTransform: 'uppercase' }}>{b.label}</div>
              <div style={{ fontSize: '12pt', fontWeight: 800, fontFamily: 'monospace', color: b.c }}>{b.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.grid}>
        <MiniTable rows={leftRows} />
        <MiniTable rows={rightRows} />
      </div>

      {report.notes.trim() && (
        <div style={s.obsBox}>
          <div style={{ fontWeight: 700, marginBottom: '4pt', color: '#5d4d38' }}>Observações</div>
          <div style={{ color: '#444', whiteSpace: 'pre-line' }}>{report.notes.trim()}</div>
        </div>
      )}
      {report.autoNotes.length > 0 && (
        <div style={{ ...s.obsBox, background: '#fafafa', borderColor: '#e0ddd8', marginBottom: '8pt' }}>
          <div style={{ fontWeight: 700, marginBottom: '4pt', color: '#8a7560', fontSize: '7pt', textTransform: 'uppercase' }}>Registros automáticos</div>
          {report.autoNotes.map((line, i) => (
            <div key={i} style={{ marginBottom: '2pt', color: '#777', fontSize: '7pt', paddingLeft: '6pt', borderLeft: '2px solid #d4c5b0' }}>{line}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 170pt', gap: '14pt', alignItems: 'end', marginTop: '24pt' }}>
        <div style={s.conclude}>
          Funcionário <strong>{report.displayName}</strong> · {saldoTexto}
          {report.previousBalanceMin !== undefined && report.previousBalanceMin !== 0 && (
            <span style={{ display: 'block', fontSize: '7.5pt', color: '#8a7560', marginTop: '3pt' }}>
              Saldo mês anterior: {(report.previousBalanceMin >= 0 ? '+' : '') + fromMin(report.previousBalanceMin)}
            </span>
          )}
        </div>
        <div style={s.sig}>
          <div style={{ borderTop: '1px solid #5d4d38', paddingTop: '4pt', marginTop: '45pt' }}>
            <div style={{ fontSize: '8pt', fontWeight: 600 }}>{report.displayName}</div>
            <div style={{ fontSize: '7pt', color: '#b8956a', marginTop: '1pt' }}>Assinatura do Funcionário</div>
          </div>
        </div>
      </div>

      <div style={s.footer}>
        <span>Gerado eletronicamente · {todayFmt()}</span>
        <span>Conferir com AFD original</span>
      </div>
    </div>
  )
}