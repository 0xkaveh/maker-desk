import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Header, LaneButton, PromoStrip, Stat, cx } from '../components'
import { fetchTraderBoards, lookupVolume } from '../lib/api'
import { formatUsd, profileUrl, shortAddr } from '../lib/format'
import type { PnlRow, RefRow, TraderBoard, TraderBoards } from '../lib/types'
import { useCopy } from '../state'

export function TradersPage() {
  const { t } = useCopy()
  const [board, setBoard] = useState<TraderBoard>('pnl24h')
  const [sortRoi, setSortRoi] = useState(false)
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<{ account: string; volume: number } | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [data, setData] = useState<TraderBoards | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  async function load() {
    setFetching(true)
    setError(null)
    try {
      setData(await fetchTraderBoards())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 45_000)
    return () => window.clearInterval(timer)
  }, [])

  const windowKey = board === 'pnl7d' ? '7d' : board === 'pnl30d' ? '30d' : '24h'
  const pnlRows = useMemo(() => {
    const rows = data?.[windowKey] ?? []
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? rows.filter((row) => row.account.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))
      : rows
    return sortRoi ? [...filtered].sort((a, b) => b.roiPct - a.roiPct) : filtered
  }, [data, windowKey, sortRoi, query])
  const refRows = useMemo(() => {
    const rows = data?.refs ?? []
    const needle = query.trim().toLowerCase()
    return needle ? rows.filter((row) => row.account.toLowerCase().includes(needle)) : rows
  }, [data, query])

  const leader = board === 'refs' ? refRows[0] : pnlRows[0]
  const rowCount = board === 'refs' ? refRows.length : pnlRows.length

  async function onLookup(event: FormEvent) {
    event.preventDefault()
    setLookupError(null)
    const account = query.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
      setLookupError(t.lookupBad)
      setLookup(null)
      return
    }
    try {
      const volume = await lookupVolume(account)
      if (volume == null) {
        setLookupError(t.lookupBad)
        setLookup(null)
        return
      }
      setLookup({ account, volume })
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <Header active="traders" />
      <PromoStrip />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="max-w-2xl">
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">{t.tradersTitle}</h2>
          <p className="mt-3 max-w-xl text-sm text-muted">{t.tradersLead}</p>
        </section>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label={t.board} value={t.traderBoards[board].label} hint={t.traderBoards[board].hint} />
          <Stat
            label={t.leader}
            value={leader ? shortAddr('account' in leader ? leader.account : '') : '—'}
            hint={
              leader
                ? board === 'refs'
                  ? `${formatUsd((leader as RefRow).earnedUsd)} earned`
                  : `${formatUsd((leader as PnlRow).pnlUsd)} realized`
                : t.loading
            }
          />
          <Stat label={t.rows} value={loading ? '…' : String(rowCount)} hint={t.publicApi} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(Object.keys(t.traderBoards) as TraderBoard[]).map((id) => (
            <LaneButton
              key={id}
              active={board === id}
              label={t.traderBoards[id].label}
              hint={t.traderBoards[id].hint}
              onClick={() => setBoard(id)}
            />
          ))}
          {board.startsWith('pnl') ? (
            <button
              type="button"
              onClick={() => setSortRoi((value) => !value)}
              className={cx(
                'h-11 rounded-md border px-3 text-xs font-medium',
                sortRoi ? 'border-primary/40 bg-elevated text-fg' : 'border-border bg-surface text-muted',
              )}
            >
              {t.sortRoi}
            </button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={fetching}>
            <RefreshCw className={cx('size-3.5', fetching && 'animate-spin')} />
            {t.refresh}
          </Button>
        </div>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => void onLookup(event)}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.wallet}
            className="h-11 min-w-[16rem] flex-1 rounded-md border border-border bg-elevated px-3 font-mono text-sm text-fg placeholder:text-subtle outline-none focus:border-primary/40"
            dir="ltr"
          />
          <Button type="submit" variant="secondary">
            {t.lookup}
          </Button>
        </form>
        {lookupError ? <p className="mt-2 text-sm text-bad">{lookupError}</p> : null}
        {lookup ? (
          <p className="mt-2 text-sm text-muted">
            {t.lookupMiss}{' '}
            <span className="font-mono text-fg" dir="ltr">
              {formatUsd(lookup.volume)}
            </span>
            {' · '}
            <a className="text-fg underline-offset-4 hover:underline" href={profileUrl(lookup.account)} target="_blank" rel="noreferrer">
              {t.profile}
            </a>
          </p>
        ) : null}
        {error ? (
          <p className="mt-8 text-sm text-bad">
            {t.traderError} {error}
          </p>
        ) : loading ? (
          <div className="mt-6 h-80 animate-pulse rounded-lg bg-surface" />
        ) : board === 'refs' ? (
          <RefTable rows={refRows} />
        ) : (
          <PnlTable rows={pnlRows} />
        )}
        <p className="mt-8 max-w-2xl text-xs text-subtle">{t.traderFoot}</p>
      </main>
    </div>
  )
}

function PnlTable({ rows }: { rows: PnlRow[] }) {
  const { t } = useCopy()
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-elevated text-[11px] uppercase tracking-wider text-subtle">
          <tr>
            <th className="px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">{t.trader}</th>
            <th className="px-3 py-3 font-medium">{t.realized}</th>
            <th className="px-3 py-3 font-medium">{t.roi}</th>
            <th className="px-3 py-3 font-medium">{t.closedSize}</th>
            <th className="px-3 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.rank}-${row.account}`} className="border-t border-border">
              <td className="px-3 py-3 font-mono tabular-nums text-subtle">{row.rank}</td>
              <td className="px-3 py-3">
                <p className="font-medium">{row.name.startsWith('0x') ? shortAddr(row.account) : row.name}</p>
                <p className="font-mono text-[11px] text-subtle" dir="ltr">
                  {shortAddr(row.account)}
                </p>
              </td>
              <td className={cx('px-3 py-3 font-mono tabular-nums', row.pnlUsd >= 0 ? 'text-good' : 'text-bad')} dir="ltr">
                {formatUsd(row.pnlUsd)}
              </td>
              <td className="px-3 py-3 font-mono tabular-nums" dir="ltr">
                {row.roiPct.toFixed(2)}%
              </td>
              <td className="px-3 py-3 font-mono tabular-nums text-muted" dir="ltr">
                {formatUsd(row.volumeUsd)}
              </td>
              <td className="px-3 py-3 text-right">
                <a
                  href={profileUrl(row.account)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-sm border border-border bg-elevated px-3 text-xs"
                >
                  {t.profile}
                  <ExternalLink className="size-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RefTable({ rows }: { rows: RefRow[] }) {
  const { t } = useCopy()
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-elevated text-[11px] uppercase tracking-wider text-subtle">
          <tr>
            <th className="px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">{t.referrer}</th>
            <th className="px-3 py-3 font-medium">{t.earned}</th>
            <th className="px-3 py-3 font-medium">{t.feesMade}</th>
            <th className="px-3 py-3 font-medium">{t.referred}</th>
            <th className="px-3 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.rank}-${row.account}`} className="border-t border-border">
              <td className="px-3 py-3 font-mono tabular-nums text-subtle">{row.rank}</td>
              <td className="px-3 py-3 font-mono text-sm" dir="ltr">
                {shortAddr(row.account)}
              </td>
              <td className="px-3 py-3 font-mono tabular-nums text-good" dir="ltr">
                {formatUsd(row.earnedUsd)}
              </td>
              <td className="px-3 py-3 font-mono tabular-nums text-muted" dir="ltr">
                {formatUsd(row.feesUsd)}
              </td>
              <td className="px-3 py-3 font-mono tabular-nums">{row.referred}</td>
              <td className="px-3 py-3 text-right">
                <a
                  href={profileUrl(row.account)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-sm border border-border bg-elevated px-3 text-xs"
                >
                  {t.profile}
                  <ExternalLink className="size-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
