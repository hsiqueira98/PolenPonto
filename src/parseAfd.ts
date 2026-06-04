/**
 * AFD Parser — Portaria 671 / 1510
 *
 * Estratégia de identificação por NOME:
 * - Linhas tipo 5 podem ter formatos variados (PIS numérico ou com prefixo alfa).
 *   Extraímos tudo que vier após o NSR+tipo e tentamos achar nome e PIS.
 * - Linha tipo 3 traz o identificador usado nas marcações (pos 34-44).
 *   Cruzamos esse identificador com o que encontramos no tipo 5.
 * - Se encontrar nome → exibe o nome. Caso contrário exibe o identificador.
 */

export interface FoundEmployee {
  key: string          // identifier from punch lines
  displayName: string  // name if found, otherwise key
  name?: string
  cpf?: string
}

export interface AfdParseResult {
  employees: FoundEmployee[]
  marks: Record<string, Record<string, string[]>>
  defaultSchedule: Schedule
}

export interface Schedule {
  workStart: string
  breakStart: string
  breakEnd: string
  workEnd: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function clean(s: string): string {
  return s.replace(/[\x00-\x1F]/g, '').trim()
}

/** Extract only digits from a string */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Try to parse a tipo-5 line.
 * Known formats observed in the wild:
 *
 * Format A (Portaria 671 standard):
 *   [0..8]  NSR
 *   [9]     '5'
 *   [10..20] PIS 11 digits
 *   [21..72] Nome 52 chars
 *   [73..83] CPF 11 digits (optional)
 *
 * Format B (seen in sample file, "A" prefix on PIS):
 *   [0..8]  NSR
 *   [9]     '5'
 *   [10]    type/flag char (e.g. 'A')
 *   [11..21] PIS 11 digits
 *   [22]    ' '
 *   [23..74] Nome
 *   ...
 *
 * We try both and pick whichever gives us a recognizable name.
 */
function parseTipo5(line: string): { pis: string; name: string; cpf?: string } | null {
  if (line.length < 22) return null

  // ── Attempt 1: standard layout [10..20] = PIS, [21..] = name
  const pisA = clean(line.substring(10, 21))
  const nameA = clean(line.substring(21, Math.min(73, line.length)))
  if (/^\d{11}$/.test(pisA) && nameA.length > 1 && /[A-Za-zÀ-ú]/.test(nameA)) {
    const cpfRaw = line.length > 73 ? digitsOnly(line.substring(73, 84)) : ''
    return { pis: pisA, name: nameA, cpf: cpfRaw.length === 11 ? cpfRaw : undefined }
  }

  // ── Attempt 2: flag char at [10], PIS at [11..21], name at [23..]
  if (line.length >= 23) {
    const pisB = clean(line.substring(11, 22))
    const nameB = clean(line.substring(23, Math.min(75, line.length)))
    const pisDigits = digitsOnly(pisB)
    if (pisDigits.length >= 10 && nameB.length > 1 && /[A-Za-zÀ-ú]/.test(nameB)) {
      return { pis: pisDigits, name: nameB }
    }
  }

  // ── Attempt 3: look for a long alpha sequence anywhere after pos 10
  const rest = line.substring(10)
  // Find first sequence of letters+spaces that looks like a name (>=5 chars, has space)
  const nameMatch = rest.match(/([A-ZÀ-Ú][A-Za-zÀ-úÀ-Ú ]{4,52})/)
  if (nameMatch) {
    const name = nameMatch[1].trim()
    // Extract digits before the name as PIS candidate
    const before = rest.substring(0, nameMatch.index ?? 0)
    const pis = digitsOnly(before).slice(-11)
    if (name.includes(' ')) {
      return { pis, name }
    }
  }

  return null
}

// ─── main parser ──────────────────────────────────────────────────────────────

export function parseAfd(content: string): AfdParseResult {
  const lines = content.split(/\r?\n/)
  const marks: Record<string, Record<string, string[]>> = {}
  // Maps punch-line key -> employee info
  const nameByKey: Record<string, { name: string; cpf?: string }> = {}
  // Also map PIS digits -> employee info (for cross-referencing)
  const nameByPis: Record<string, { name: string; cpf?: string }> = {}

  const defaultSchedule: Schedule = {
    workStart: '07:00', breakStart: '12:00', breakEnd: '13:00', workEnd: '17:00',
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.length < 10) continue
    const tipo = line[9]

    // ── Tipo 5: employee registration
    if (tipo === '5') {
      const info = parseTipo5(line)
      if (info && info.name) {
        const entry = { name: info.name, cpf: info.cpf }
        // Index by PIS (digits only, may be 10 or 11 digits)
        if (info.pis) {
          nameByPis[info.pis] = entry
          // Also index by last 11 digits in case of length variations
          const pis11 = info.pis.slice(-11)
          if (pis11 !== info.pis) nameByPis[pis11] = entry
        }
      }
    }

    // ── Tipo 3: punch
    if (tipo === '3' && line.length >= 45) {
      const dateStr = line.substring(10, 20)
      const timeStr = line.substring(21, 26)
      const key     = clean(line.substring(34, 45))

      if (!key) continue
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue
      if (!/^\d{2}:\d{2}$/.test(timeStr)) continue

      if (!marks[key]) marks[key] = {}
      if (!marks[key][dateStr]) marks[key][dateStr] = []
      marks[key][dateStr].push(timeStr)
    }
  }

  // Sort marks per day
  for (const key of Object.keys(marks))
    for (const date of Object.keys(marks[key]))
      marks[key][date].sort()

  // Build employee list: for each punch key, find name
  const employees: FoundEmployee[] = Object.keys(marks).map(key => {
    // Direct lookup
    let info = nameByKey[key] ?? nameByPis[key]

    // Try suffix match: AFD key is 11 digits; tipo-5 PIS might differ by leading zeros
    if (!info) {
      const keyDigits = digitsOnly(key)
      info = nameByPis[keyDigits]
        ?? Object.entries(nameByPis).find(([k]) => k.endsWith(keyDigits) || keyDigits.endsWith(k))?.[1]
    }

    return {
      key,
      displayName: info?.name ?? key,
      name: info?.name,
      cpf: info?.cpf,
    }
  })

  // Sort: named first, then alpha
  employees.sort((a, b) => {
    if (a.name && !b.name) return -1
    if (!a.name && b.name) return 1
    return a.displayName.localeCompare(b.displayName, 'pt-BR')
  })

  return { employees, marks, defaultSchedule }
}
