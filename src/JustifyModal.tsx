import { useState } from 'react'
import type { AbsenceType, AbsenceScope } from './calc'

export interface JustifyResult {
  absence: AbsenceType
  absenceScope: AbsenceScope
  autoLine: string
}

interface Props {
  dayLabel: string
  onConfirm: (result: JustifyResult) => void
  onClose: () => void
}

const JUSTIFY_TYPES = [
  { id: 'atestado', label: 'Atestado médico' },
  { id: 'eleicao', label: 'Serviço eleitoral' },
  { id: 'acidente', label: 'Acidente de trabalho' },
  { id: 'dispensa', label: 'Dispensa legal' },
  { id: 'outros', label: 'Outros' },
] as const

type JustifyTypeId = typeof JUSTIFY_TYPES[number]['id']

export function JustifyModal({ dayLabel, onConfirm, onClose }: Props) {
  const [kind, setKind] = useState<'justified' | 'unjustified'>('justified')
  const [scope, setScope] = useState<'full' | 'period1' | 'period2'>('full')
  const [typeId, setTypeId] = useState<JustifyTypeId>('atestado')

  function handleConfirm() {
    const absence: AbsenceType = kind
    const absenceScope: AbsenceScope = scope
    let autoLine = ''
    if (kind === 'justified') {
      const typeLabel = JUSTIFY_TYPES.find(t => t.id === typeId)?.label ?? 'Justificativa'
      const scopeLabel = scope === 'full' ? 'dia inteiro' : scope === 'period1' ? 'período da manhã' : 'período da tarde'
      autoLine = `${dayLabel}: falta justificada (${typeLabel}) — ${scopeLabel}.`
    } else {
      const scopeLabel = scope === 'full' ? 'dia inteiro' : scope === 'period1' ? 'período da manhã' : 'período da tarde'
      autoLine = `${dayLabel}: falta injustificada — ${scopeLabel}.`
    }
    onConfirm({ absence, absenceScope, autoLine })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-honey-950/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/50 w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gold-200/40">
          <h3 className="font-bold text-honey-950 text-base">Registrar Falta</h3>
          <p className="text-xs text-honey-600 mt-0.5">{dayLabel}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-honey-700/70 uppercase tracking-wider mb-2">Tipo de falta</p>
            <div className="flex gap-2">
              {(['justified', 'unjustified'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors
                    ${kind === k
                      ? k === 'justified'
                        ? 'bg-amber-500 border-amber-600 text-white'
                        : 'bg-red-500 border-red-600 text-white'
                      : 'bg-white border-gold-200 text-honey-700 hover:bg-gold-50'
                    }`}>
                  {k === 'justified' ? 'Justificada' : 'Injustificada'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-honey-700/70 uppercase tracking-wider mb-2">Período</p>
            <div className="flex gap-2">
              {([['full', 'Dia inteiro'], ['period1', 'Manhã'], ['period2', 'Tarde']] as const).map(([s, l]) => (
                <button key={s} type="button" onClick={() => setScope(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors
                    ${scope === s
                      ? 'bg-honey-700 border-honey-800 text-white'
                      : 'bg-white border-gold-200 text-honey-700 hover:bg-gold-50'
                    }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {kind === 'justified' && (
            <div>
              <p className="text-[10px] font-bold text-honey-700/70 uppercase tracking-wider mb-2">Motivo</p>
              <div className="flex flex-col gap-1.5">
                {JUSTIFY_TYPES.map(t => (
                  <button key={t.id} type="button" onClick={() => setTypeId(t.id)}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                      ${typeId === t.id
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-semibold'
                        : 'bg-white border-gold-200 text-honey-800 hover:bg-gold-50'
                      }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gold-200/40 flex gap-2 bg-gold-50/20">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium border border-gold-200 bg-white hover:bg-gold-50 text-honey-700">
            Cancelar
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-bold bg-honey-800 hover:bg-honey-900 text-white shadow-md">
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
