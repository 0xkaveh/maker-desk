import { REF_CODE } from './types'

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}k`
  if (Math.abs(value) >= 100) return `$${value.toFixed(0)}`
  return `$${value.toFixed(2)}`
}

export function formatCents(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}¢`
}

export function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatMsLeft(ms: number): string {
  if (ms <= 0) return 'settling'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d`
}

export function scoreTone(score: number): string {
  if (score >= 0.72) return 'text-good'
  if (score >= 0.5) return 'text-warn'
  return 'text-bad'
}

export function takeDrag(spread: number | null | undefined, takerBuyFeePct: number): number {
  return (spread ?? 0.15) * 50 + takerBuyFeePct
}

export function shortAddr(account: string): string {
  if (!account) return '—'
  if (account.length < 12) return account
  return `${account.slice(0, 6)}…${account.slice(-4)}`
}

export function withRef(url: string): string {
  const next = new URL(url)
  if (!next.searchParams.get('r')) next.searchParams.set('r', REF_CODE)
  return next.toString()
}

export function marketUrl(slug: string): string {
  return withRef(`https://limitless.exchange/markets/${slug}`)
}

export function packUrl(id: string): string {
  return withRef(`https://limitless.exchange/packs/${id}`)
}

export function profileUrl(account: string): string {
  return withRef(`https://limitless.exchange/profile/${account}`)
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
