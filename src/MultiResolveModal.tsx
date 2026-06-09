import { useState } from 'react'
import { randomNear, absenceLabel } from './calc'
import type { DayRow, Schedule } from './calc'
import { JustifyModal } from './JustifyModal'
import type { JustifyResult } from './JustifyModal'

interface Props {
  rows: DayRow[]
  schedule: Schedule
  onApplyAll: (patches: Map<number, Partial<DayRow>>, newAutoNotes: string[]) => void
  onClose: () => void
}

interface RowPatch {
  rowIndex: number
  patch: Partial<DayRow>
  autoLine: string
}

function estimatePatch(row: DayRow, schedule: Schedule): Partial<DayRow> {
  return {
    ent1: row.ent1 || randomNear(schedule.workStart),
    sai1: row.sai1 || randomNear(schedule.breakStart),
    ent2: row.ent2 || randomNear(schedule.breakEnd),
    sai2: row.sai2 || randomNear(schedule.workEnd),
    generated: false,
    gapIssue: 'none' as const,
    absence: null,
    absenceScope: null,
    isAtestado: false,
  }
}

export function MultiResolveModal({ rows, schedule, onApplyAll, onClose }: Props) {
  const incompleteRows = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.gapIssue !== 'none' && r.absence === null && r.weekday !== 0 && r.weekday !== 6 && !r.isHoliday)

  const [pendingPatches, setPendingPatches] = useState<Map<number, RowPatch>>(new Map())
  const [justifyTarget, setJustifyTarget] = useState<{ rowIndex: number; dayLabel: string } | null>(null)

  function setPatch(rowIndex: number, patch: Partial<DayRow>, autoLine: string) {
    setPendingPatches(prev => {
      const next = new Map(prev)
      next.set(rowIndex, { rowIndex, patch, autoLine })
      return next
    })
  }

  function removePatch(rowIndex: number) {
    setPendingPatches(prev => {
      const next = new Map(prev)
      next.delete(rowIndex)
      return next
    })
  }

  function handleEstimateOne(rowIndex: number, row: DayRow) {
    const patch = estimatePatch(row, schedule)
    setPatch(rowIndex, patch, '')
  }

  function handleEstimateAll() {
    const next = new Map(pendingPatches)
    for (const { r, i } of incompleteRows) {
      if (!next.has(i)) {
        const patch = estimatePatch(r, schedule)
        next.set(i, { rowIndex: i, patch, autoLine: '' })
      }
    }
    setPendingPatches(next)
  }

  function handleJustifyResult(result: JustifyResult) {
    if (!justifyTarget) return
    const { rowIndex } = justifyTarget
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
    setPatch(rowIndex, patch, result.autoLine)
    setJustifyTarget(null)
  }

  function handleConfirm() {
    const patchMap = new Map<number, Partial<DayRow>>()
    const autoLines: string[] = []
    for (const [idx, rp] of pendingPatches) {
      patchMap.set(idx, rp.patch)
      if (rp.autoLine) autoLines.push(rp.autoLine)
    }
    onApplyAll(patchMap, autoLines)
  }

  const pendingCount = pendingPatches.size
  const totalCount = incompleteRows.length

  function getRowState(rowIndex: number, _row: DayRow): 'estimate' | 'absence' | 'pending' | null {
    const p = pendingPatches.get(rowIndex)
    if (!p) return null
    if (p.patch.absence) return 'absence'
    return 'estimate'
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-3 bg-honey-950/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gold-200/50 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gold-200/40 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-honey-950 text-base">Resolver dias incompletos</h3>
            <p className="text-xs text-honey-600 mt-0.5">{totalCount} dia{totalCount !== 1 ? 's' : ''} com lacuna · {pendingCount} resolv{pendingCount !== 1 ? 'idos' : 'ido'}</p>
          </div>
          <button onClick={onClose} className="text-honey-500 hover:text-honey-900 w-8 h-8 rounded-lg hover:bg-gold-100 flex items-center justify-center text-xl">×</button>
        </div>

        <div className="px-5 py-3 border-b border-gold-100 bg-gold-50/30 flex items-center justify-between gap-3">
          <p className="text-xs text-honey-700">Gere horários estimados com base no horário padrão configurado.</p>
          <button type="button" onClick={handleEstimateAll}
            className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl bg-honey-800 hover:bg-honey-900 text-white shadow-sm transition-colors">
            Gerar todos os estimados
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {incompleteRows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-honey-500 text-center">Nenhum dia com lacuna encontrado.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-white/95 shadow-sm z-10">
                <tr className="border-b border-gold-200">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-honey-700 uppercase tracking-wide">Dia</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold text-honey-700 uppercase tracking-wide">Situação atual</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold text-honey-700 uppercase tracking-wide">Resolução</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold text-honey-700 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {incompleteRows.map(({ r, i }) => {
                  const state = getRowState(i, r)
                  const p = pendingPatches.get(i)
                  const gapLabel = r.gapIssue === 'empty' ? 'Sem batida'
                    : r.gapIssue === 'partial' ? 'Incompleto'
                    : r.gapIssue === 'odd_punches' ? 'Ímpar'
                    : 'Extra'

                  return (
                    <tr key={r.date} className={`border-b border-gold-100/60 transition-colors
                      ${state === 'estimate' ? 'bg-amber-50/50' : state === 'absence' ? 'bg-blue-50/40' : 'bg-white/70'}`}>
                      <td className="px-4 py-2.5 font-semibold text-honey-900">{r.dayLabel}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 rounded-md px-1.5 py-0.5 font-medium">
                          {gapLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {state === null ? (
                          <span className="text-honey-400 text-[11px]">—</span>
                        ) : state === 'estimate' ? (
                          <span className="text-[10px] bg-amber-50 border border-amber-300 text-amber-800 rounded-md px-1.5 py-0.5 font-medium">Estimado</span>
                        ) : (
                          <span className="text-[10px] bg-blue-50 border border-blue-300 text-blue-800 rounded-md px-1.5 py-0.5 font-medium">
                            {p ? absenceLabel(p.patch.absence as any, p.patch.absenceScope as any) : 'Falta'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {state !== null ? (
                            <button type="button" onClick={() => removePatch(i)}
                              className="text-[11px] px-2 py-1 rounded-lg border border-gold-200 text-honey-600 hover:bg-gold-50 hover:text-honey-900 transition-colors">
                              Desfazer
                            </button>
                          ) : (
                            <>
                              <button type="button" onClick={() => handleEstimateOne(i, r)}
                                className="text-[11px] px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold transition-colors">
                                Gerar estimado
                              </button>
                              <button type="button" onClick={() => setJustifyTarget({ rowIndex: i, dayLabel: r.dayLabel })}
                                className="text-[11px] px-2.5 py-1 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 font-semibold transition-colors">
                                Falta
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gold-200/40 flex items-center justify-between gap-3 bg-white/50">
          <span className="text-xs text-honey-600">{pendingCount} de {totalCount} dia{totalCount !== 1 ? 's' : ''} resolvido{pendingCount !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gold-200 bg-white hover:bg-gold-50 text-honey-700">
              Fechar
            </button>
            <button onClick={handleConfirm} disabled={pendingCount === 0}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-honey-800 hover:bg-honey-900 text-white shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Aplicar {pendingCount > 0 ? `(${pendingCount})` : ''}
            </button>
          </div>
        </div>
      </div>

      {justifyTarget && (
        <JustifyModal
          dayLabel={justifyTarget.dayLabel}
          onConfirm={handleJustifyResult}
          onClose={() => setJustifyTarget(null)}
        />
      )}
    </div>
  )
}