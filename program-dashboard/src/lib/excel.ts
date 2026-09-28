import * as XLSX from 'xlsx'
import { toIso } from './dates'
import { parseISO, isValid } from 'date-fns'
import type { Domain, Program, ProgramStatus, RagStatus, StatusUpdate, Task } from '../types'
import { PROGRAM_STATUS_LABELS, PRIORITY_LABELS } from '../types'
import { programPercent } from './rag'
import { deliveryRisk, RISK_META } from './metrics'

// Program-level import: one row per program (no subtasks).
// Expected columns (header row, case-insensitive, order-independent):
//   Program | Owner | Start | End | Status | RAG | % Complete | Update
// Program, Start and End are required; the rest are optional.

export interface ParsedProgramRow {
  name: string
  owner: string
  start: string // ISO or '' if unparseable
  end: string
  status: ProgramStatus
  rag: RagStatus
  percent: number
  note: string
  errors: string[]
}

const HEADER_ALIASES: Record<string, keyof RawRow> = {
  program: 'name',
  programme: 'name',
  project: 'name',
  name: 'name',
  owner: 'owner',
  manager: 'owner',
  lead: 'owner',
  start: 'start',
  startdate: 'start',
  begin: 'start',
  end: 'end',
  enddate: 'end',
  finish: 'end',
  due: 'end',
  target: 'end',
  status: 'status',
  rag: 'rag',
  ragstatus: 'rag',
  health: 'rag',
  percent: 'percent',
  percentcomplete: 'percent',
  complete: 'percent',
  progress: 'percent',
  owner_note: 'note',
  note: 'note',
  notes: 'note',
  update: 'note',
  comment: 'note',
  comments: 'note',
  statusupdate: 'note',
}

interface RawRow {
  name?: unknown
  owner?: unknown
  start?: unknown
  end?: unknown
  status?: unknown
  rag?: unknown
  percent?: unknown
  note?: unknown
}

function normalize(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, '')
}

function cellToIso(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) return isValid(value) ? toIso(value) : ''
  if (typeof value === 'number') {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000))
    return isValid(d) ? toIso(d) : ''
  }
  const s = String(value).trim()
  const isoTry = parseISO(s)
  if (isValid(isoTry)) return toIso(isoTry)
  const loose = new Date(s)
  return isValid(loose) ? toIso(loose) : ''
}

function cellToPercent(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number') {
    const n = value <= 1 ? value * 100 : value
    return clampPercent(n)
  }
  const s = String(value).replace('%', '').trim()
  const n = Number(s)
  return Number.isFinite(n) ? clampPercent(n) : 0
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function parseStatus(value: unknown): ProgramStatus {
  const s = normalize(String(value ?? ''))
  if (!s) return 'on_track'
  if (s.includes('notstart') || s.includes('plan')) return 'not_started'
  if (s.includes('risk')) return 'at_risk'
  if (s.includes('delay') || s.includes('late') || s.includes('behind')) return 'delayed'
  if (s.includes('hold') || s.includes('pause')) return 'on_hold'
  if (s.includes('complete') || s.includes('done') || s.includes('closed')) return 'completed'
  return 'on_track'
}

function parseRag(value: unknown, status: ProgramStatus): RagStatus {
  const s = normalize(String(value ?? ''))
  if (s === 'r' || s.includes('red') || s.includes('offtrack')) return 'red'
  if (s === 'a' || s.includes('amber') || s.includes('yellow') || s.includes('risk')) return 'amber'
  if (s === 'g' || s.includes('green') || s.includes('ontrack')) return 'green'
  // No RAG given → derive a sensible default from the status.
  if (status === 'delayed') return 'red'
  if (status === 'at_risk' || status === 'on_hold') return 'amber'
  return 'green'
}

/** Parse the first worksheet of an .xlsx ArrayBuffer into program rows. */
export function parseProgramWorkbook(data: ArrayBuffer): ParsedProgramRow[] {
  const wb = XLSX.read(data, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: true,
    defval: '',
  })

  return rows.map((row) => {
    const mapped: RawRow = {}
    for (const [key, val] of Object.entries(row)) {
      const target = HEADER_ALIASES[normalize(key)]
      if (target) mapped[target] = val
    }

    const errors: string[] = []
    const name = String(mapped.name ?? '').trim()
    const start = cellToIso(mapped.start)
    const end = cellToIso(mapped.end)
    const status = parseStatus(mapped.status)

    if (!name) errors.push('Missing Program')
    if (!start) errors.push('Missing/invalid Start')
    if (!end) errors.push('Missing/invalid End')

    return {
      name,
      owner: String(mapped.owner ?? '').trim(),
      start,
      end,
      status,
      rag: parseRag(mapped.rag, status),
      percent: cellToPercent(mapped.percent),
      note: String(mapped.note ?? '').trim(),
      errors,
    }
  })
}

/** Build and download a blank template so managers know the format. */
export function downloadTemplate(): void {
  const sample = [
    {
      Program: 'Cloud Migration Wave 2',
      Owner: 'Priya Nair',
      Start: '2026-01-05',
      End: '2026-10-16',
      Status: 'On track',
      RAG: 'Green',
      '% Complete': 55,
      Update: 'Batch A complete; batch B underway.',
    },
    {
      Program: 'Network Modernization',
      Owner: 'Priya Nair',
      Start: '2026-03-02',
      End: '2026-10-05',
      Status: 'At risk',
      RAG: 'Amber',
      '% Complete': 40,
      Update: 'Firewall issue at two pilot sites; ~2 week slip.',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(sample)
  ws['!cols'] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 40 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Programs')
  XLSX.writeFile(wb, 'program-import-template.xlsx')
}

/** Export a set of programs to Excel for leadership / governance reporting. */
export function exportPrograms(
  programs: Program[],
  domains: Domain[],
  tasks: Task[],
  fileName = 'program-portfolio.xlsx',
): void {
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''
  const rows = programs.map((p) => {
    const pt = tasks.filter((t) => t.programId === p.id)
    const risk = deliveryRisk(p, pt)
    return {
      Domain: domainName(p.domainId),
      Program: p.name,
      Owner: p.owner,
      Start: p.startDate,
      End: p.endDate,
      Status: PROGRAM_STATUS_LABELS[p.status],
      RAG: p.ragStatus,
      Priority: p.priority ? PRIORITY_LABELS[p.priority] : '',
      'Percent Complete': programPercent(p, pt),
      'Planned Resources': p.plannedResources ?? '',
      'Current Resources': p.currentResources ?? '',
      'Delivery Risk': RISK_META[risk.level].label,
      Deprioritized: p.deprioritized ? 'Yes' : '',
      'Deprioritized Reason': p.deprioritizedReason ?? '',
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 30 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Portfolio')
  XLSX.writeFile(wb, fileName)
}

/** Export the weekly status updates as a report. */
export function exportUpdates(
  updates: StatusUpdate[],
  programs: Program[],
  domains: Domain[],
  fileName = 'weekly-updates.xlsx',
): void {
  const programById = (id: string) => programs.find((p) => p.id === id)
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''
  const rows = [...updates]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((u) => {
      const p = u.programId ? programById(u.programId) : undefined
      return {
        Date: u.date,
        Area: p ? domainName(p.domainId) : u.domainId ? domainName(u.domainId) : '',
        Program: p?.name ?? (u.domainId ? '(team update)' : ''),
        Author: u.author,
        RAG: p?.ragStatus ?? '',
        Status: p ? PROGRAM_STATUS_LABELS[p.status] : '',
        Update: u.note,
      }
    })
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 60 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Weekly Updates')
  XLSX.writeFile(wb, fileName)
}
