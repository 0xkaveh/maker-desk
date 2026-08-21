import { Bookmark, ExternalLink, Info, RefreshCw, Search, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Header, LaneButton, PromoStrip, Select, Stat, ToggleChip, cx, flagTone } from '../components'
import { fetchDeskMarkets, fetchDeskPacks } from '../lib/api'
import { formatCents, formatMsLeft, formatPct, formatUsd, median, scoreTone, takeDrag } from '../lib/format'
import { laneScore, packLaneScore } from '../lib/score'
import type { BookLane, DeskMarket, DeskPack } from '../lib/types'
import { loadWatchlist, saveWatchlist, toggleWatch } from '../lib/watchlist'
import { useCopy } from '../state'

function shareTicket(market: DeskMarket): void {
  const trade = market.bestTrade
  const line =
    trade.action === 'SKIP'
      ? `SKIP ${market.displayTitle}`
      : `${trade.action} ${trade.side} @ ${(trade.entry * 100).toFixed(1)}¢ · leftover ${(trade.leftover * 100).toFixed(1)}¢`
  const text = `${line}\n${market.displayTitle}\n${market.url}\nvia Maker Desk\n@trylimitlessfin`
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(intent, '_blank', 'noopener,noreferrer')
}

function TradeLine({ market, compact }: { market: DeskMarket; compact?: boolean }) {
  const { t } = useCopy()
  const trade = market.bestTrade
  return (
    <div className={cx('min-w-0', compact && 'max-w-[16rem]')}>
      <p
        className={cx(
          'font-mono text-sm tabular-nums',
          trade.action === 'MAKE' && 'text-good',
          trade.action === 'TAKE' && 'text-warn',
          trade.action === 'SKIP' && 'text-subtle',
        )}
        dir="ltr"
      >
        {trade.action === 'SKIP' ? t.skip : `${trade.action} ${trade.side} @ ${formatCents(trade.entry)}`}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-subtle">
        {trade.action === 'SKIP' ? trade.reason : `${formatUsd(trade.ticketUsd)} ticket · +${formatCents(trade.leftover)} if right`}
      </p>
    </div>
  )
}

function MarketCard({
  market,
  lane,
  saved,
  onToggle,
}: {
  market: DeskMarket
  lane: BookLane
  saved: boolean
  onToggle: () => void
}) {
  const { t } = useCopy()
  const score = laneScore(market, lane)
  const drag = takeDrag(market.spread, market.takerBuyFeePct)
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium leading-snug">{market.displayTitle}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-subtle" dir="ltr">
            {market.domain} · {market.duration}
            {market.ticker ? ` · ${market.ticker}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cx('font-mono text-xl tabular-nums', scoreTone(score))}>{Math.round(score * 100)}</p>
          <p className="text-[10px] uppercase tracking-wider text-subtle">{t.score}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniStat label={t.volume} value={formatUsd(market.volumeUsd)} />
        <MiniStat label={t.spread} value={formatCents(market.spread)} warn={!!market.spread && market.spread > 0.12} />
        <MiniStat label={t.winP} value={formatPct(market.winProb)} />
        <MiniStat label={t.takeDrag} value={`${drag.toFixed(1)}%`} warn={drag >= 6} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {market.flags.map((flag) => (
          <Badge key={flag} tone={flagTone(flag)}>
            {flag}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{market.why}</p>
      <div className="mt-3 rounded-md border border-border bg-elevated px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-subtle">{t.bestTrade}</p>
        <div className="mt-1">
          <TradeLine market={market} />
        </div>
      </div>
      <p className="mt-1 font-mono text-xs tabular-nums text-subtle" dir="ltr">
        {market.favorite} {formatPct(market.winProb)} · maker 0% · min {formatUsd(market.minSizeUsd)} · {formatMsLeft(market.msLeft)}
      </p>
      <div className="mt-4 flex gap-2">
        <a
          href={market.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-sm bg-primary text-sm font-medium text-primary-fg"
        >
          {t.openBook}
          <ExternalLink className="size-3.5" />
        </a>
        <Button type="button" variant="ghost" size="icon" aria-label={t.watchlist} onClick={onToggle}>
          <Bookmark className={cx('size-4', saved && 'fill-primary text-primary')} />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={t.share} onClick={() => shareTicket(market)}>
          <Share2 className="size-4" />
        </Button>
      </div>
    </article>
  )
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md bg-elevated px-2 py-2">
      <p className="text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className={cx('mt-0.5 font-mono text-sm tabular-nums', warn && 'text-bad')} dir="ltr">
        {value}
      </p>
    </div>
  )
}

export function BooksPage() {
  const { t } = useCopy()
  const [lane, setLane] = useState<BookLane>('safe')
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')
  const [duration, setDuration] = useState('all')
  const [clobOnly, setClobOnly] = useState(true)
  const [rebates, setRebates] = useState(false)
  const [hideThin, setHideThin] = useState(true)
  const [spreadCap, setSpreadCap] = useState(0.12)
  const [watchOnly, setWatchOnly] = useState(false)
  const [showScoring, setShowScoring] = useState(false)
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
  const [markets, setMarkets] = useState<DeskMarket[]>([])
  const [packs, setPacks] = useState<DeskPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  async function load() {
    setFetching(true)
    setError(null)
    try {
      const [nextMarkets, nextPacks] = await Promise.all([fetchDeskMarkets(), fetchDeskPacks()])
      setMarkets(nextMarkets)
      setPacks(nextPacks.packs)
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

  useEffect(() => {
    saveWatchlist(watchlist)
  }, [watchlist])

  const domains = useMemo(() => ['all', ...[...new Set(markets.map((item) => item.domain))].sort()], [markets])
  const durations = useMemo(() => ['all', ...[...new Set(markets.map((item) => item.duration))].sort()], [markets])
  const saved = useMemo(() => new Set(watchlist), [watchlist])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return markets
      .filter((item) => {
        if (watchOnly && !saved.has(item.slug)) return false
        if (clobOnly && item.tradeType !== 'clob') return false
        if (rebates && !item.hasRebates) return false
        if (hideThin && item.flags.includes('THIN')) return false
        if (lane === 'trade' && item.bestTrade.action === 'SKIP') return false
        if (item.spread != null && item.spread > spreadCap) return false
        if (domain !== 'all' && item.domain !== domain) return false
        if (duration !== 'all' && item.duration !== duration) return false
        if (needle && !item.displayTitle.toLowerCase().includes(needle) && !(item.ticker ?? '').toLowerCase().includes(needle)) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        if (lane === 'volume') return b.volumeUsd - a.volumeUsd || laneScore(b, lane) - laneScore(a, lane)
        if (lane === 'trade') return b.bestTrade.score - a.bestTrade.score
        return laneScore(b, lane) - laneScore(a, lane)
      })
  }, [markets, query, domain, duration, clobOnly, rebates, hideThin, spreadCap, lane, watchOnly, saved])

  const tickets = useMemo(
    () =>
      [...shown]
        .filter((item) => item.bestTrade.action !== 'SKIP')
        .sort((a, b) => b.bestTrade.score - a.bestTrade.score)
        .slice(0, 3),
    [shown],
  )
  const topPacks = useMemo(
    () => [...packs].sort((a, b) => packLaneScore(b, 'best') - packLaneScore(a, 'best')).slice(0, 3),
    [packs],
  )
  const shownVolume = shown.reduce((sum, item) => sum + item.volumeUsd, 0)
  const midSpread = median(shown.map((item) => item.spread).filter((value): value is number => value != null))
  const top = shown[0]

  return (
    <div className="min-h-dvh bg-bg">
      <Header active="books">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowScoring((open) => !open)}>
          <Info className="size-3.5" />
          <span className="max-sm:hidden">{t.scoring}</span>
        </Button>
      </Header>
      <PromoStrip />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="max-w-2xl">
          <h2 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">{t.booksTitle}</h2>
          <p className="mt-3 max-w-xl text-sm text-muted">{t.booksLead}</p>
        </section>

        {showScoring ? (
          <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-medium text-fg">{t.scoringTitle}</h3>
              <button type="button" className="text-xs text-subtle hover:text-fg" onClick={() => setShowScoring(false)}>
                {t.close}
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              <li>{t.scoringSafe}</li>
              <li>{t.scoringVol}</li>
              <li>{t.scoringWin}</li>
              <li>{t.scoringTrade}</li>
            </ul>
            <p className="mt-3">{t.scoringFoot}</p>
          </section>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label={t.scanned} value={loading ? '…' : String(markets.length)} hint={t.scannedHint} />
          <Stat label={t.shown} value={loading ? '…' : formatUsd(shownVolume)} hint={`${shown.length} after filters`} />
          <Stat label={t.median} value={midSpread == null ? '—' : formatCents(midSpread)} hint={top ? `Top: ${top.displayTitle}` : t.tighten} />
        </div>

        {tickets.length > 0 ? (
          <section className="mt-6">
            <p className="text-[11px] uppercase tracking-wider text-subtle">{t.bestTickets}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {tickets.map((item) => (
                <a
                  key={item.slug}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border bg-surface p-4 transition-colors duration-150 hover:border-primary/40"
                >
                  <p className="truncate text-sm font-medium">{item.displayTitle}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-subtle" dir="ltr">
                    {item.ticker ?? item.domain} · {item.duration} · {formatMsLeft(item.msLeft)}
                  </p>
                  <div className="mt-3">
                    <TradeLine market={item} />
                  </div>
                  <p className="mt-2 text-xs text-muted">{item.bestTrade.reason}</p>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {topPacks.length > 0 ? (
          <section className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] uppercase tracking-wider text-subtle">{t.livePacks}</p>
              <Link to="/packs" className="text-xs text-muted hover:text-fg">
                {t.allPacks}
              </Link>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {topPacks.map((pack) => (
                <a
                  key={pack.id}
                  href={pack.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border bg-surface p-4 transition-colors duration-150 hover:border-primary/40"
                >
                  <p className="truncate text-sm font-medium">{pack.name}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-subtle" dir="ltr">
                    {pack.legs.length} legs · {formatPct(pack.jointP)} joint · {formatMsLeft(pack.msLeft)}
                  </p>
                  <p className="mt-3 font-mono text-2xl tabular-nums text-good" dir="ltr">
                    {pack.multiplier.toFixed(2)}x
                  </p>
                  <p className="text-xs text-muted">
                    $10 → {formatUsd(pack.payoutUsd)} if every leg hits
                  </p>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(t.lanes) as BookLane[]).map((id) => (
            <LaneButton key={id} active={lane === id} label={t.lanes[id].label} hint={t.lanes[id].hint} onClick={() => setLane(id)} />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              className="h-11 w-full rounded-md border border-border bg-elevated ps-10 pe-3 text-sm text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={domain}
              onChange={setDomain}
              options={domains.map((item) => ({ value: item, label: item === 'all' ? t.allDomains : item }))}
            />
            <Select
              value={duration}
              onChange={setDuration}
              options={durations.map((item) => ({ value: item, label: item === 'all' ? t.anyDuration : item }))}
            />
            <Select
              value={String(spreadCap)}
              onChange={(value) => setSpreadCap(Number(value))}
              options={[
                { value: '0.05', label: 'Spread ≤ 5¢' },
                { value: '0.08', label: 'Spread ≤ 8¢' },
                { value: '0.12', label: 'Spread ≤ 12¢' },
                { value: '0.2', label: 'Spread ≤ 20¢' },
                { value: '1', label: 'Any spread' },
              ]}
            />
            <ToggleChip pressed={clobOnly} onPressed={() => setClobOnly((value) => !value)}>
              {t.clobOnly}
            </ToggleChip>
            <ToggleChip pressed={rebates} onPressed={() => setRebates((value) => !value)}>
              {t.rebates}
            </ToggleChip>
            <ToggleChip pressed={hideThin} onPressed={() => setHideThin((value) => !value)}>
              {t.hideThin}
            </ToggleChip>
            <ToggleChip pressed={watchOnly} onPressed={() => setWatchOnly((value) => !value)}>
              {t.watchlist}
            </ToggleChip>
            <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={fetching}>
              <RefreshCw className={cx('size-3.5', fetching && 'animate-spin')} />
              {t.refresh}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-8 text-sm text-bad">
            {t.loadError} {error}
          </p>
        ) : loading ? (
          <div className="mt-6 grid gap-3 md:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-52 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-10 text-sm text-muted">{t.empty}</p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:hidden">
              {shown.slice(0, 40).map((market) => (
                <MarketCard
                  key={market.slug}
                  market={market}
                  lane={lane}
                  saved={saved.has(market.slug)}
                  onToggle={() => setWatchlist((current) => toggleWatch(current, market.slug))}
                />
              ))}
            </div>
            <div className="mt-5 hidden overflow-hidden rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-elevated text-[11px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-3 py-3 font-medium">{t.book}</th>
                    <th className="px-3 py-3 font-medium">{t.score}</th>
                    <th className="px-3 py-3 font-medium">{t.volume}</th>
                    <th className="px-3 py-3 font-medium">{t.spread}</th>
                    <th className="px-3 py-3 font-medium">{t.winP}</th>
                    <th className="px-3 py-3 font-medium">{t.bestTrade}</th>
                    <th className="px-3 py-3 font-medium">{t.ends}</th>
                    <th className="px-3 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 60).map((market) => {
                    const score = laneScore(market, lane)
                    return (
                      <tr key={market.slug} className="border-t border-border align-top">
                        <td className="px-3 py-3">
                          <p className="max-w-xs font-medium leading-snug">{market.displayTitle}</p>
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-subtle" dir="ltr">
                            {market.domain} · {market.duration}
                            {market.ticker ? ` · ${market.ticker}` : ''}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {market.flags.slice(0, 4).map((flag) => (
                              <Badge key={flag} tone={flagTone(flag)}>
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className={cx('px-3 py-3 font-mono text-base tabular-nums', scoreTone(score))}>{Math.round(score * 100)}</td>
                        <td className="px-3 py-3 font-mono tabular-nums" dir="ltr">
                          {formatUsd(market.volumeUsd)}
                        </td>
                        <td className={cx('px-3 py-3 font-mono tabular-nums', market.spread != null && market.spread > 0.12 && 'text-bad')} dir="ltr">
                          {formatCents(market.spread)}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-mono tabular-nums" dir="ltr">
                            {market.favorite} {formatPct(market.winProb)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <TradeLine market={market} compact />
                        </td>
                        <td className="px-3 py-3 font-mono text-xs tabular-nums text-muted" dir="ltr">
                          {formatMsLeft(market.msLeft)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-10"
                              onClick={() => setWatchlist((current) => toggleWatch(current, market.slug))}
                            >
                              <Bookmark className={cx('size-4', saved.has(market.slug) && 'fill-primary text-primary')} />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => shareTicket(market)}>
                              <Share2 className="size-4" />
                            </Button>
                            <a
                              href={market.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center gap-1 rounded-sm border border-border bg-elevated px-3 text-xs"
                            >
                              {t.trade}
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-8 max-w-2xl text-xs text-subtle">{t.disclaimer}</p>
      </main>
    </div>
  )
}
