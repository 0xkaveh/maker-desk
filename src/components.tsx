import { ExternalLink } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { formatUsd } from './lib/format'
import { REF_SIGNUP, type Flag } from './lib/types'
import { useCopy } from './state'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'secondary' | 'solid'
  size?: 'md' | 'sm' | 'icon'
}) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        variant === 'solid' && 'bg-primary text-primary-fg hover:bg-primary/90',
        variant === 'secondary' && 'border border-border bg-elevated text-fg hover:text-fg',
        variant === 'ghost' && 'text-muted hover:bg-elevated hover:text-fg',
        size === 'md' && 'h-11 px-3 text-sm',
        size === 'sm' && 'h-9 px-3 text-xs',
        size === 'icon' && 'size-10',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide',
        tone === 'neutral' && 'border border-border bg-elevated text-muted',
        tone === 'good' && 'bg-good/15 text-good',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'accent' && 'bg-accent/15 text-accent',
      )}
    >
      {children}
    </span>
  )
}

export function flagTone(flag: Flag): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  if (['TIGHT', 'MAKER 0%', 'HIGH P', 'MAKE'].includes(flag)) return 'good'
  if (['REBATE', 'LP', 'HOT', 'TAKE'].includes(flag)) return 'accent'
  if (flag === 'NEAR') return 'warn'
  if (['WIDE', 'THIN', 'FEE DRAG'].includes(flag)) return 'bad'
  return 'neutral'
}

export function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums" dir="ltr">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted">{hint}</p>
    </div>
  )
}

export function Header({ active, children }: { active: 'books' | 'packs' | 'traders'; children?: ReactNode }) {
  const { t, toggleLang } = useCopy()
  const links = [
    { to: '/', id: 'books' as const, label: t.navBooks },
    { to: '/packs', id: 'packs' as const, label: t.navPacks },
    { to: '/traders', id: 'traders' as const, label: t.navTraders },
  ]

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">{t.brandKicker}</p>
          <h1 className="text-lg font-medium tracking-tight">{t.brand}</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={cx(
                'rounded-md px-3 py-2 text-sm transition-colors duration-150',
                active === link.id ? 'bg-elevated text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          {children}
          <Button type="button" variant="secondary" size="sm" onClick={toggleLang}>
            {t.langToggle}
          </Button>
        </div>
      </div>
    </header>
  )
}

export function PromoStrip() {
  const { t } = useCopy()
  return (
    <div className="border-b border-border bg-elevated">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm text-muted">
        <p className="max-w-3xl">{t.promo}</p>
        <a
          href={REF_SIGNUP}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-fg hover:underline"
        >
          {t.promoCta}
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  )
}

export function LaneButton({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-md border px-3 py-2 text-left transition-colors duration-150',
        active ? 'border-primary/40 bg-elevated text-fg' : 'border-border bg-surface text-muted hover:text-fg',
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-subtle">{hint}</span>
    </button>
  )
}

export function ToggleChip({
  pressed,
  onPressed,
  disabled,
  children,
}: {
  pressed: boolean
  onPressed: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPressed}
      className={cx(
        'h-11 rounded-md border px-3 text-xs font-medium transition-colors duration-150 disabled:opacity-40',
        pressed ? 'border-primary/40 bg-elevated text-fg' : 'border-border bg-bg text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 max-w-full rounded-md border border-border bg-bg px-3 text-xs text-fg"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function money(value: number): string {
  return formatUsd(value)
}
