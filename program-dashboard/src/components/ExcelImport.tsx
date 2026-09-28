import { useMemo, useRef, useState } from 'react'
import { Download, Upload, AlertTriangle, FolderKanban } from 'lucide-react'
import { downloadTemplate, parseProgramWorkbook, type ParsedProgramRow } from '../lib/excel'
import { useStore } from '../store/useStore'
import { fmtDateShort, toIso } from '../lib/dates'
import { PROGRAM_STATUS_LABELS, type Domain } from '../types'
import { Button, Modal, RagBadge } from './ui'

export function ExcelImport({
  open,
  onClose,
  domain,
}: {
  open: boolean
  onClose: () => void
  domain: Domain
}) {
  const programs = useStore((s) => s.programs)
  const addProgram = useStore((s) => s.addProgram)
  const updateProgram = useStore((s) => s.updateProgram)
  const addUpdate = useStore((s) => s.addUpdate)

  const [rows, setRows] = useState<ParsedProgramRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setRows(null)
    setFileName('')
    setDone(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const onFile = async (file: File) => {
    setDone(null)
    setFileName(file.name)
    const buf = await file.arrayBuffer()
    setRows(parseProgramWorkbook(buf))
  }

  const valid = useMemo(() => rows?.filter((r) => r.errors.length === 0) ?? [], [rows])
  const errorCount = (rows?.length ?? 0) - valid.length

  // Mark which valid rows match an existing program (update) vs. new.
  const existingByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of programs) {
      if (p.domainId === domain.id) map.set(p.name.toLowerCase(), p.id)
    }
    return map
  }, [programs, domain.id])

  const confirm = () => {
    let created = 0
    let updated = 0
    for (const r of valid) {
      const fields = {
        domainId: domain.id,
        name: r.name,
        owner: r.owner || domain.managerName,
        status: r.status,
        ragStatus: r.rag,
        startDate: r.start,
        endDate: r.end,
        percentComplete: r.percent,
        source: 'excel' as const,
      }
      const existingId = existingByName.get(r.name.toLowerCase())
      let programId: string
      if (existingId) {
        updateProgram(existingId, fields)
        programId = existingId
        updated++
      } else {
        programId = addProgram(fields)
        created++
      }
      if (r.note) {
        addUpdate({
          programId,
          date: toIso(new Date()),
          author: r.owner || domain.managerName,
          note: r.note,
        })
      }
    }
    setDone(
      `Imported into ${domain.name}: ${created} new, ${updated} updated program${
        created + updated === 1 ? '' : 's'
      }.`,
    )
    setRows(null)
  }

  return (
    <Modal open={open} onClose={close} title={`Import programs — ${domain.name}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {done ? (
          <div className="rounded-lg bg-emerald-50 px-4 py-6 text-center">
            <p className="font-medium text-emerald-800">{done}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={reset}>
                Import another file
              </Button>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-600">
                One row per program. Columns:{' '}
                <code className="text-xs">Program, Owner, Start, End, Status, RAG, % Complete, Update</code>
              </div>
              <Button variant="secondary" onClick={downloadTemplate}>
                <Download size={16} />
                Template
              </Button>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 hover:border-slate-400 hover:bg-slate-50">
              <Upload size={22} />
              <span className="text-sm font-medium">
                {fileName || 'Choose an .xlsx file to upload'}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>

            {rows && (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <FolderKanban size={16} />
                    {valid.length} program{valid.length === 1 ? '' : 's'} ready
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <AlertTriangle size={16} />
                      {errorCount} row{errorCount === 1 ? '' : 's'} skipped (errors)
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Program</th>
                        <th className="px-3 py-2 font-semibold">Dates</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">RAG</th>
                        <th className="px-3 py-2 font-semibold">%</th>
                        <th className="px-3 py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const isUpdate = existingByName.has(r.name.toLowerCase())
                        return (
                          <tr
                            key={i}
                            className={`border-t border-slate-100 ${r.errors.length ? 'bg-amber-50' : ''}`}
                          >
                            <td className="px-3 py-1.5 font-medium text-slate-700">
                              {r.name || <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">
                              {r.start ? `${fmtDateShort(r.start)} – ${fmtDateShort(r.end)}` : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">
                              {PROGRAM_STATUS_LABELS[r.status]}
                            </td>
                            <td className="px-3 py-1.5">
                              {r.errors.length ? (
                                <span className="text-amber-700">{r.errors.join(', ')}</span>
                              ) : (
                                <RagBadge rag={r.rag} />
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">{r.percent}%</td>
                            <td className="px-3 py-1.5 text-right text-slate-400">
                              {r.errors.length ? '' : isUpdate ? 'update' : 'new'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Clear
                  </Button>
                  <Button onClick={confirm} disabled={valid.length === 0}>
                    Import {valid.length} program{valid.length === 1 ? '' : 's'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
