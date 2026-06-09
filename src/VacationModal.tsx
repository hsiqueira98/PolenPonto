import { useState } from 'react'

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface Props {
  month: string
  existingStart?: string
  existingEnd?: string
  onConfirm: (start: string, end: string) => void
  onClear: () => void
  onClose: () => void
}

export function VacationModal({ month, existingStart, existingEnd, onConfirm, onClear, onClose }: Props) {
  const [start, setStart] = useState(existingStart || '')
  const [end, setEnd] = useState(existingEnd || '')
  const [calMonth, setCalMonth] = useState(existingStart ? existingStart.substring(0, 7) : month)

  const hasExisting = !!(existingStart && existingEnd)

  function handleDayClick(dateStr: string) {
    if (!start || (start && end)) {
      setStart(dateStr); setEnd('')
    } else {
      if (dateStr < start) { setEnd(start); setStart(dateStr) }
      else setEnd(dateStr)
    }
  }

  const [y, m] = calMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstDayWday = new Date(y, m - 1, 1).getDay()

  function changeMonth(diff: number) {
    const d = new Date(y, m - 1 + diff, 1)
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const grid: (string | null)[] = []
  for (let i = 0; i < firstDayWday; i++) grid.push(null)
  for (let i = 1; i <= daysInMonth; i++) {
    grid.push(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }

  const preview = start && end
    ? `Funcionário em gozo de férias no período de ${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}.`
    : ''

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-honey-950/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 border-b border-gold-200/40 flex justify-between items-center bg-white/40">
          <div>
            <h3 className="font-bold text-honey-950 text-base">{hasExisting ? 'Editar Férias' : 'Registrar Férias'}</h3>
            {hasExisting && (
              <p className="text-xs text-blue-700 mt-0.5">
                Atual: {existingStart!.split('-').reverse().join('/')} a {existingEnd!.split('-').reverse().join('/')}
              </p>
            )}
          </div>
          <button id="fechar" onClick={onClose} className="text-honey-600 hover:text-honey-950 w-8 h-8 rounded-lg hover:bg-gold-100 flex items-center justify-center text-xl">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-honey-700 uppercase tracking-widest mb-1.5">Início das Férias</label>
              <input id="inicio" type="date" value={start} onChange={e => setStart(e.target.value)}
                className="w-full border border-gold-200 rounded-xl px-3 py-2 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-gold-300 text-honey-950" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-honey-700 uppercase tracking-widest mb-1.5">Retorno ao Trabalho</label>
              <input id="fim" type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full border border-gold-200 rounded-xl px-3 py-2 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-gold-300 text-honey-950" />
            </div>
          </div>

          <div className="bg-white border border-gold-200/50 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <button id="mes-ant" onClick={() => changeMonth(-1)} className="w-7 h-7 rounded-lg hover:bg-gold-100 flex items-center justify-center text-honey-800 font-bold text-lg">‹</button>
              <span className="text-sm font-bold text-honey-900">{MONTH_NAMES[m - 1]} de {y}</span>
              <button id="mes-prox" onClick={() => changeMonth(1)} className="w-7 h-7 rounded-lg hover:bg-gold-100 flex items-center justify-center text-honey-800 font-bold text-lg">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i} className="text-[10px] font-bold text-honey-600">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((dateStr, i) => {
                if (!dateStr) return <div key={`e-${i}`} />
                const d = parseInt(dateStr.split('-')[2], 10)
                const isStart = dateStr === start
                const isEnd = dateStr === end
                const inRange = start && end && dateStr > start && dateStr < end
                let bg = 'hover:bg-gold-50 text-honey-900 rounded-lg'
                if (isStart || isEnd) bg = 'bg-honey-800 text-white font-bold rounded-lg shadow-md'
                else if (inRange) bg = 'bg-honey-100/70 text-honey-900'
                return (
                  <button key={dateStr} onClick={() => handleDayClick(dateStr)}
                    className={`h-8 w-full text-xs transition-colors flex items-center justify-center ${bg}`}>
                    {d}
                  </button>
                )
              })}
            </div>
            <p className="text-[9px] text-honey-600 text-center mt-2">Clique em duas datas para selecionar o período</p>
          </div>

          {preview && (
            <div className="bg-blue-50 border border-blue-200/50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Prévia da Observação</p>
              <p className="text-xs text-blue-900 leading-relaxed">{preview}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gold-200/40 flex items-center justify-between bg-gold-50/20">
          <button id="limpar" onClick={onClear} className="text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
            Remover Férias
          </button>
          <div className="flex gap-2">
            <button id="cancelar" onClick={onClose} className="text-sm font-semibold text-honey-800 hover:text-honey-950 px-4 py-2 rounded-xl border border-gold-200 bg-white hover:bg-gold-50 transition-colors">Cancelar</button>
            <button id="gravar" onClick={() => start && end && onConfirm(start, end)} disabled={!start || !end}
              className="text-sm font-bold bg-honey-800 hover:bg-honey-900 disabled:opacity-50 text-white px-5 py-2 rounded-xl transition-all shadow-md">
              {hasExisting ? 'Atualizar Férias' : 'Gravar Férias'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
