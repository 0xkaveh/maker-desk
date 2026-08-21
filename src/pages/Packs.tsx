import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Header, LaneButton, PromoStrip, Stat, cx } from '../components'
import { fetchDeskPacks } from '../lib/api'
import { formatMsLeft, formatPct, formatUsd } from '../lib/format'
import { packLaneScore } from '../lib/score'
import type { DeskPack, PackLane } from '../lib/types'
import { useCopy } from '../state'

export function PacksPage() {
  const { t } = useCopy()
  const [lane, setLane] = useState<PackLane>('best')
  const [buyableOnly, setBuyableOnly] = useState(true)
  const [packs, setPacks] = useState<DeskPack[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  async function load() {
    setFetching(true)
    setError(null)
    try {
      const payload = await fetchDeskPacks()
      setPacks(payload.packs)
      setCount(payload.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const shown = useMemo(
    () =>
      [...packs]
        .filter((pack) => !buyableOnly || pack.eligible)
        .sort((a, b) => packLaneScore(b, lane) - packLaneScore(a, lane)),
    [packs, lane, buyableOnly],
  )
  const top = shown[0]

  return (
    <div className="min-h-dvh bg-bg">
      <Header active="packs" />
      <PromoStrip />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="max-w-2xl">
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">{t.packsTitle}</h2>
          <p className="mt-3 max-w-xl text-sm text-muted">{t.packsLead}</p>
        </section>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label={t.livePackCount} value={loading ? '…' : String(count)} hint={t.fromPacks} />
          <Stat
            label={t.topTicket}
            value={top ? `${top.multiplier.toFixed(2)}x` : '—'}
            hint={top ? `${formatPct(top.jointP)} implied` : t.waiting}
          />
          <Stat label={t.tenPays} value={top ? formatUsd(top.payoutUsd) : '—'} hint={top ? top.name : t.ifEvery} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(Object.keys(t.packLanes) as PackLane[]).map((id) => (
            <LaneButton key={id} active={lane === id} label={t.packLanes[id].label} hint={t.packLanes[id].hint} onClick={() => setLane(id)} />
          ))}
          <button
            type="button"
            onClick={() => setBuyableOnly((value) => !value)}
            className={cx(
              'h-11 rounded-md border px-3 text-xs font-medium',
              buyableOnly ? 'border-primary/40 bg-elevated text-fg' : 'border-border bg-surface text-muted',
            )}
          >
            {t.buyableOnly}
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={fetching}>
            <RefreshCw className={cx('size-3.5', fetching && 'animate-spin')} />
            {t.refresh}
          </Button>
        </div>
        {error ? (
          <p className="mt-8 text-sm text-bad">
            {t.packError} {error}
          </p>
        ) : loading ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-10 text-sm text-muted">{t.noPacks}</p>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {shown.map((pack) => {
              const score = packLaneScore(pack, lane)
              return (
                <article key={pack.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{pack.name}</p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-subtle" dir="ltr">
                        {pack.kind} · {pack.legs.length} legs · {formatMsLeft(pack.msLeft)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-2xl tabular-nums text-good" dir="ltr">
                        {pack.multiplier.toFixed(2)}x
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-subtle" dir="ltr">
                        $10 → {formatUsd(pack.payoutUsd)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone={pack.eligible ? 'good' : 'bad'}>{pack.eligible ? 'BUYABLE' : 'PAUSED'}</Badge>
                    <Badge>{formatPct(pack.jointP)} joint</Badge>
                    {pack.savingsPct >= 80 ? <Badge tone="accent">+{Math.round(pack.savingsPct)}% vs singles</Badge> : null}
                    {pack.jointP < 0.1 ? <Badge tone="warn">LONGSHOT</Badge> : null}
                    {pack.jointP >= 0.35 ? <Badge tone="good">CHALK</Badge> : null}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {pack.legs.map((leg) => (
                      <li key={`${pack.id}-${leg.slug}`} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="text-fg">{leg.outcome}</span> <span className="text-muted">{leg.title}</span>
                          {leg.event ? <span className="mt-0.5 block truncate text-xs text-subtle">{leg.event}</span> : null}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-muted" dir="ltr">
                          {formatPct(leg.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="font-mono text-xs tabular-nums text-subtle" dir="ltr">
                      score {Math.round(score * 100)}
                    </p>
                    <a
                      href={pack.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1 rounded-sm bg-primary px-3 text-xs font-medium text-primary-fg"
                    >
                      {t.openPack}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <p className="mt-8 max-w-2xl text-xs text-subtle">{t.packFoot}</p>
      </main>
    </div>
  )
}
