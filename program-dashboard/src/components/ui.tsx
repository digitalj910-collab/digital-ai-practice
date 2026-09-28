import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { ProgramStatus, RagStatus } from '../types'
import { PROGRAM_STATUS_LABELS } from '../types'
import { RAG_BADGE, RAG_COLORS, RAG_LABELS } from '../lib/rag'

// ---- Buttons ------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-500',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: {
  variant?: ButtonVariant
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ---- RAG + status indicators -------------------------------------------

export function RagDot({ rag, size = 10 }: { rag: RagStatus; size?: number }) {
  return (
    <span
      title={RAG_LABELS[rag]}
      className="inline-block rounded-full ring-2 ring-white shadow-sm"
      style={{ width: size, height: size, background: RAG_COLORS[rag] }}
    />
  )
}

export function RagBadge({ rag }: { rag: RagStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${RAG_BADGE[rag]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: RAG_COLORS[rag] }}
      />
      {RAG_LABELS[rag]}
    </span>
  )
}

const STATUS_STYLES: Record<ProgramStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  on_track: 'bg-emerald-100 text-emerald-700',
  at_risk: 'bg-amber-100 text-amber-700',
  delayed: 'bg-red-100 text-red-700',
  blocked: 'bg-rose-100 text-rose-700',
  on_hold: 'bg-slate-200 text-slate-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-slate-100 text-slate-400',
  postponed: 'bg-brand-100 text-brand-700',
  descoped: 'bg-slate-100 text-slate-400',
}

export function StatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {PROGRAM_STATUS_LABELS[status]}
    </span>
  )
}

// ---- Stat tile ----------------------------------------------------------

export function StatTile({
  icon,
  label,
  value,
  suffix,
  accent = '#0f172a',
  onClick,
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  suffix?: string
  accent?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      {icon && (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 text-left">
        <div className="text-2xl font-bold leading-none" style={{ color: accent }}>
          {value}
          {suffix}
        </div>
        <div className="mt-1 truncate text-sm text-slate-500">{label}</div>
      </div>
    </>
  )
  const base = 'flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition'
  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} hover:-translate-y-0.5 hover:shadow-md`}>
        {inner}
      </button>
    )
  }
  return <div className={`${base} hover:shadow-md`}>{inner}</div>
}

// ---- Page header --------------------------------------------------------

export function PageHeader({
  icon,
  accent = '#c8102e',
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode
  accent?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

// ---- Progress bar -------------------------------------------------------

export function ProgressBar({
  value,
  color = '#0f172a',
  className = '',
}: {
  value: number
  color?: string
  className?: string
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  )
}

// ---- Modal --------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ---- Form field ---------------------------------------------------------

export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
