import { fromMin, toMin } from './calc'
import type { EmployeeReport, DayRow } from './calc'

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

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
  month: string; carga: string; empresa: string; isLast: boolean
}

export function ReportCard({ report, month, carga, empresa, isLast }: Props) {
  const cargaMin = toMin(carga) ?? 480
  const extras  = Math.max(0, report.totalBalance)
  const debitos = Math.min(0, report.totalBalance)
  const saldoPos = report.totalBalance >= 0

  const colSaldo = (v: number) => v < 0 ? 'text-red-500' : v > 0 ? 'text-emerald-600' : 'text-honey-400'

  return (
    <>
      {/* ── Screen card ─────────────────────────────────── */}
      <div className="print:hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-gold-200/60 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gold-200/40 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-honey-900 text-base">{report.displayName}</h2>
            <p className="text-[11px] text-honey-700 font-mono mt-0.5">{report.key}</p>
          </div>
          <div className="flex gap-2">
            <StatPill label="Trabalhado" value={fromMin(report.totalWorked)} />
            <StatPill label="Saldo" value={(saldoPos?'+':'') + fromMin(report.totalBalance)} variant={saldoPos ? 'green' : 'red'} />
          </div>
        </div>

        <div className="overflow-x-auto bg-white/40">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white/60 backdrop-blur-sm border-b border-gold-200/40">
                {['Dia','Ent 1','Saí 1','Ent 2','Saí 2','Total','Saldo'].map(h => (
                  <th key={h} className="px-2 py-2 text-[10px] font-semibold text-honey-700 uppercase tracking-wide text-center first:text-left first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map(row => {
                const isWkd = row.weekday === 0 || row.weekday === 6
                const isOff = isWkd || row.isHoliday || row.isAtestado
                const saldo = row.workedMin !== null && !isOff ? row.workedMin - cargaMin : null
                return (
                  <tr key={row.date} className={`border-b border-gold-200/30 last:border-0
                    ${row.isAtestado ? 'bg-gold-50/60' : row.isHoliday ? 'bg-gold-50/40' : isWkd ? 'bg-gold-50/30 text-honey-600' : 'hover:bg-white/70'}`}>
                    <td className="pl-5 pr-2 py-1 font-medium whitespace-nowrap">
                      {row.dayLabel}
                      {row.isHoliday && <span className="ml-1 text-[9px] bg-gold-200 text-honey-700 rounded px-1">feriado</span>}
                      {row.isAtestado && <span className="ml-1 text-[9px] bg-gold-200 text-honey-900 rounded px-1">atestado</span>}
                      {row.generated && !isOff && <span className="ml-1 text-[9px] text-gold-500" title="Estimado">●</span>}
                    </td>
                    {[row.ent1, row.sai1, row.ent2, row.sai2].map((t, i) => (
                      <td key={i} className={`px-2 py-1 text-center font-mono ${t ? '' : 'text-gold-200'}`}>{t || '—'}</td>
                    ))}
                    <td className="px-2 py-1 text-center font-mono text-honey-700">
                      {row.workedMin !== null ? fromMin(row.workedMin) : <span className="text-gold-200">—</span>}
                    </td>
                    <td className={`px-2 py-1 text-center font-mono font-semibold ${saldo !== null ? colSaldo(saldo) : 'text-gold-200'}`}>
                      {saldo !== null ? (saldo > 0 ? '+' : '') + fromMin(saldo) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2.5 bg-white/60 backdrop-blur-sm border-t border-gold-200/40 flex flex-wrap gap-3 text-xs text-honey-800">
          <span><b className="text-honey-900">{report.workedDays}</b> dias trabalhados</span>
          <span><b className="text-honey-900">{fromMin(report.totalWorked)}</b> horas</span>
          <span><b className={saldoPos ? 'text-emerald-600' : 'text-red-500'}>{(saldoPos?'+':'') + fromMin(report.totalBalance)}</b> saldo</span>
          {extras > 0 && <span><b className="text-emerald-600">{fromMin(extras)}</b> extras</span>}
          {debitos < 0 && <span><b className="text-red-500">{fromMin(debitos)}</b> devidas</span>}
          <span className="ml-auto text-gold-500 text-[10px]">● estimado</span>
        </div>
      </div>

      {/* ── PDF page ────────────────────────────────────── */}
      <PrintPage
        report={report} month={month} carga={carga} cargaMin={cargaMin}
        empresa={empresa} extras={extras} debitos={debitos} saldoPos={saldoPos} isLast={isLast}
      />
    </>
  )
}

function StatPill({ label, value, variant = 'gray' }: { label: string; value: string; variant?: 'gray'|'green'|'red' }) {
  const cls = variant === 'green' 
    ? 'bg-emerald-100/80 text-emerald-700' 
    : variant === 'red' 
    ? 'bg-red-100/80 text-red-600' 
    : 'bg-gold-100/80 text-honey-700'
  return (
    <div className={`rounded-xl px-3 py-1.5 text-right backdrop-blur-sm ${cls}`}>
      <p className="text-[10px] font-medium opacity-70">{label}</p>
      <p className="text-sm font-bold font-mono">{value}</p>
    </div>
  )
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

interface PrintPageProps {
  report: EmployeeReport; month: string; carga: string; cargaMin: number
  empresa: string; extras: number; debitos: number; saldoPos: boolean; isLast: boolean
}

function PrintPage({ report, month, carga, cargaMin, empresa, extras, debitos, saldoPos, isLast }: PrintPageProps) {
  const col = (v: number) => v < 0 ? '#c0392b' : v > 0 ? '#16a34a' : '#8a6e1f'
  const half = Math.ceil(report.rows.length / 2)
  const leftRows = report.rows.slice(0, half)
  const rightRows = report.rows.slice(half)

  const saldoTexto = saldoPos
    ? `Banco de horas em crédito de ${fromMin(extras)}.`
    : `Banco de horas em débito de ${fromMin(Math.abs(debitos))}.`

  const atestadoDays = report.rows.filter(r => r.isAtestado).length
  const holidayDays  = report.rows.filter(r => r.isHoliday).length
  const generatedDays = report.rows.filter(r => r.generated && !r.isAtestado && !r.isHoliday).length

  type CSS = React.CSSProperties
  const s: Record<string, CSS> = {
    page:    { fontFamily:"'Helvetica Neue',Arial,sans-serif", fontSize:'8.5pt', color:'#3a2d22', padding:'1.4cm 1.6cm', lineHeight:'1.5', pageBreakAfter: isLast ? 'auto' : 'always' },
    topBar:  { display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderBottom:'2px solid #5a4d38', paddingBottom:'7pt', marginBottom:'10pt' },
    empBox:  { display:'flex', alignItems:'center', gap:'8pt', background:'#fffaf0', border:'1px solid #dccaa6', borderRadius:'5pt', padding:'7pt 10pt', marginBottom:'10pt' },
    grid:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8pt', marginBottom:'10pt' },
    statBox: { textAlign:'center', background:'#fff', border:'1px solid #e8dcc4', borderRadius:'4pt', padding:'4pt 8pt', minWidth:'58pt' },
    th:      { padding:'3.5pt 4pt', fontWeight:700, fontSize:'7pt', letterSpacing:'0.2px', textAlign:'center' as const },
    td:      { padding:'2.5pt 4pt', textAlign:'center' as const, fontFamily:'monospace', borderBottom:'1px solid #fffde8' },
    conclude:{ background:'#fffaf0', border:'1px solid #dccaa6', borderRadius:'4pt', padding:'7pt 10pt', fontSize:'8pt', lineHeight:'1.7', color:'#333' },
    sig:     { width:'170pt', textAlign:'center' as const },
    footer:  { marginTop:'10pt', borderTop:'1px solid #eee', paddingTop:'5pt', display:'flex', justifyContent:'space-between', fontSize:'6.5pt', color:'#bbb' },
  }

  function MiniTable({ rows }: { rows: DayRow[] }) {
    return (
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'7.5pt' }}>
        <thead>
          <tr style={{ background:'#5d4d38', color:'#fffef8' }}>
            {['Dia','Ent 1','Saí 1','Ent 2','Saí 2','Total','Saldo'].map(h => (
              <th key={h} style={{ ...s.th, textAlign: h==='Dia' ? 'left' : 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isWkd = row.weekday === 0 || row.weekday === 6
            const isOff = isWkd || row.isHoliday || row.isAtestado
            const saldo = row.workedMin !== null && !isOff ? row.workedMin - cargaMin : null
            const bg = row.isAtestado ? '#fffbeb' : row.isHoliday ? '#fffef8' : isWkd ? '#fffef8' : i%2===0 ? '#fff' : '#faf9f3'
            return (
              <tr key={row.date} style={{ background: bg }}>
                <td style={{ ...s.td, textAlign:'left', fontWeight: isWkd||isOff ? 400 : 500, color: isWkd ? '#b8956a' : '#3a2d22', whiteSpace:'nowrap' }}>
                  {row.dayLabel}
                  {row.isHoliday  && <span style={{ fontSize:'6pt', color:'#d4b960', marginLeft:'2pt' }}>feriado</span>}
                  {row.generated && !isOff && <span style={{ color:'#d4b960', marginLeft:'2pt', fontSize:'6pt' }}>●</span>}
                </td>
                {row.absence !== null ? (
                  <td colSpan={6} style={{ ...s.td, textAlign:'center', fontWeight:600, color: row.absence === 'justified' ? '#b8932d' : '#c0392b', letterSpacing:'0.3px' }}>
                    {row.absence === 'justified' ? 'Falta Justificada' : 'Falta Injustificada'}
                  </td>
                ) : (
                  <>
                    {[row.ent1, row.sai1, row.ent2, row.sai2].map((t, ti) => (
                      <td key={ti} style={{ ...s.td, color: t ? '#3a2d22' : '#d4c5b0' }}>{isOff ? '—' : t || '—'}</td>
                    ))}
                    <td style={{ ...s.td, color: row.workedMin !== null ? '#3a2d22' : '#d4c5b0' }}>
                      {row.workedMin !== null ? fromMin(row.workedMin) : '—'}
                    </td>
                    <td style={{ ...s.td, fontWeight:600, color: saldo !== null ? col(saldo) : '#d4c5b0' }}>
                      {saldo !== null ? (saldo > 0 ? '+' : '') + fromMin(saldo) : '—'}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="hidden print:block" style={s.page}>
      {/* Top bar */}
      <div style={s.topBar}>
        <div>
          <div style={{ fontSize:'15pt', fontWeight:800, lineHeight:'1.1', letterSpacing:'-0.3px', color:'#5d4d38' }}>Espelho de Ponto</div>
          <div style={{ fontSize:'8pt', color:'#8a7560', marginTop:'2pt' }}>{empresa || 'Relatório de Frequência'} · {monthLabel(month)}</div>
        </div>
        <div style={{ textAlign:'right', fontSize:'7.5pt', color:'#a89968' }}>
          <div>Emitido em {todayFmt()}</div>
          <div>Jornada: {carga}h/dia</div>
        </div>
      </div>

      {/* Employee + stats */}
      <div style={s.empBox}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'11pt', fontWeight:700, color:'#5d4d38' }}>{report.displayName}</div>
          {report.key !== report.displayName && (
            <div style={{ fontSize:'7.5pt', color:'#b8956a', fontFamily:'monospace', marginTop:'1pt' }}>{report.key}</div>
          )}
        </div>
        <div style={{ display:'flex', gap:'5pt' }}>
          {[
            { label:'Dias trab.', val:`${report.workedDays}`, c:'#3a2d22' },
            { label:'Total horas', val:fromMin(report.totalWorked), c:'#3a2d22' },
            { label:'Extras', val: extras > 0 ? `+${fromMin(extras)}` : '—', c: extras > 0 ? '#16a34a' : '#b8956a' },
            { label:'Devidas', val: debitos < 0 ? fromMin(debitos) : '—', c: debitos < 0 ? '#c0392b' : '#b8956a' },
            { label:'Saldo', val:(saldoPos?'+':'') + fromMin(report.totalBalance), c: col(report.totalBalance) },
          ].map(b => (
            <div key={b.label} style={s.statBox}>
              <div style={{ fontSize:'6.5pt', color:'#8a7560', textTransform:'uppercase', letterSpacing:'0.3px' }}>{b.label}</div>
              <div style={{ fontSize:'12pt', fontWeight:800, fontFamily:'monospace', color:b.c, lineHeight:'1.1', marginTop:'2pt' }}>{b.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column table */}
      <div style={s.grid}>
        <MiniTable rows={leftRows} />
        <MiniTable rows={rightRows} />
      </div>

      {/* Conclusion + signature */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 170pt', gap:'14pt', alignItems:'end' }}>
        <div style={s.conclude}>
          Funcionário <strong>{report.displayName}</strong> · Competência: <strong>{monthLabel(month)}</strong> ·{' '}
          <strong>{report.workedDays} dia{report.workedDays !== 1 ? 's' : ''} trabalhado{report.workedDays !== 1 ? 's' : ''}</strong> ·{' '}
          Total: <strong>{fromMin(report.totalWorked)}h</strong> · {saldoTexto}
          {atestadoDays > 0 && ` ${atestadoDays} dia${atestadoDays>1?'s':''} com atestado.`}
          {holidayDays  > 0 && ` ${holidayDays} feriado${holidayDays>1?'s':''}.`}
          {generatedDays > 0 && <span style={{ color:'#bbb', fontSize:'7pt' }}> — {generatedDays} registro{generatedDays>1?'s':''} com ● foram estimados automaticamente.</span>}
        </div>
        <div style={s.sig}>
          <div style={{ borderTop:'1px solid #5d4d38', paddingTop:'4pt' }}>
            <div style={{ fontSize:'8pt', fontWeight:600, color:'#3a2d22' }}>{report.displayName}</div>
            <div style={{ fontSize:'7pt', color:'#b8956a', marginTop:'1pt' }}>Assinatura do Funcionário</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span>Gerado eletronicamente · {todayFmt()}</span>
        <span>● = horário estimado · atestado = falta justificada · Conferir com AFD original</span>
      </div>
    </div>
  )
}
