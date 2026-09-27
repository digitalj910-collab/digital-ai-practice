import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

/**
 * Auto-generated briefing shown as a right-side slide-over so it doesn't take
 * up page space. A small floating button opens it.
 */
export function Snapshot({ title = 'Snapshot', lines }: { title?: string; lines: string[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (lines.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-500"
        title="Open the auto snapshot"
      >
        <Sparkles size={16} />
        Snapshot
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/20"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <Sparkles size={16} />
              </span>
              <span className="font-semibold text-slate-900">{title}</span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                auto
              </span>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
