import { marketUrl, packUrl, takeDrag } from './format'
import type { BestTrade, DeskMarket, DeskPack, Flag, PackLeg, Side } from './types'

export interface RawMarket {
  slug?: string
  title?: string
  proxyTitle?: string | null
  tradeType?: string
  volumeFormatted?: string | number
  volume?: string | number
  prices?: number[]
  tradePrices?: {
    buy?: { market?: number[]; limit?: number[] }
    sell?: { market?: number[]; limit?: number[] }
  }
  expirationTimestamp?: number
  categories?: string[]
  tags?: string[]
  settings?: {
    minSize?: string | number
    maxSpread?: number
    dailyReward?: string | number
    rebateRate?: string | number
  }
  properties?: Array<{ propertyKeySlug?: string; value?: string[] }>
  priceOracleMetadata?: { symbol?: string }
}

export interface RawPackLeg {
  marketSlug?: string
  marketTitle?: string
  outcome?: string
  livePrice?: number
  group?: { title?: string; leagueName?: string } | null
}

export interface RawPack {
  id?: string
  name?: string
  parlayType?: string
  eligible?: boolean
  earliestDeadline?: string
  legs?: RawPackLeg[]
  payout?: {
    parlayMultiplier?: number
    parlayPayout?: string | number
    savingsPct?: number
  }
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function firstProp(market: RawMarket, slug: string): string | null {
  const hit = market.properties?.find((item) => item.propertyKeySlug === slug)
  const value = hit?.value?.[0]
  return value ?? null
}

function hasIncentive(market: RawMarket, token: string): boolean {
  const hit = market.properties?.find((item) => item.propertyKeySlug === 'incentive')
  return (hit?.value ?? []).includes(token)
}

export function takerBuyFeePct(price: number): number {
  const p = Math.min(0.999, Math.max(0.01, price))
  const table: Array<[number, number]> = [
    [0.5, 3],
    [0.55, 2.52],
    [0.6, 2.13],
    [0.65, 1.8],
    [0.7, 1.51],
    [0.75, 1.26],
    [0.8, 1.05],
    [0.85, 0.85],
    [0.9, 0.68],
    [0.95, 0.53],
    [0.99, 0.42],
    [0.999, 0.4],
  ]
  if (p <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i += 1) {
    const [x1, y1] = table[i - 1]
    const [x2, y2] = table[i]
    if (p <= x2) {
      const t = (p - x1) / (x2 - x1)
      return y1 + t * (y2 - y1)
    }
  }
  return table[table.length - 1][1]
}

function volumeUsd(market: RawMarket): number {
  const formatted = num(market.volumeFormatted, NaN)
  if (Number.isFinite(formatted)) return formatted
  return num(market.volume) / 1e6
}

function yesNo(market: RawMarket): { yes: number; no: number } {
  const yes = num(market.prices?.[0], 0.5)
  const no = num(market.prices?.[1], 1 - yes)
  return { yes, no }
}

function bookSpread(market: RawMarket): number | null {
  const yesAsk = market.tradePrices?.buy?.market?.[0]
  const yesBid = market.tradePrices?.sell?.market?.[0]
  if (typeof yesAsk === 'number' && typeof yesBid === 'number') {
    return Math.max(0, yesAsk - yesBid)
  }
  const maxSpread = market.settings?.maxSpread
  return typeof maxSpread === 'number' ? maxSpread : null
}

function tickerOf(market: RawMarket): string | null {
  const symbol = market.priceOracleMetadata?.symbol
  if (symbol) return symbol.split(/[/\s]/)[0]?.toUpperCase() ?? null
  const title = market.proxyTitle || market.title || ''
  const match = title.match(/\b([A-Z]{2,6})\b/)
  return match?.[1] ?? null
}

function minSizeUsd(market: RawMarket): number {
  const raw = num(market.settings?.minSize, 1_000_000)
  return raw >= 1000 ? raw / 1e6 : raw
}

export function pickBestTrade(input: {
  favorite: Side
  winProb: number
  bid: number
  ask: number
  spread: number | null
  feePct: number
  ticketUsd: number
}): BestTrade {
  const makeLeftover = 1 - input.bid
  const takeCost = input.ask * (1 + input.feePct / 100)
  const takeLeftover = 1 - takeCost
  const drag = takeDrag(input.spread, input.feePct)

  if (makeLeftover >= 0.1 && input.spread != null && input.spread <= 0.2) {
    return {
      action: 'MAKE',
      side: input.favorite,
      entry: input.bid,
      ticketUsd: input.ticketUsd,
      leftover: makeLeftover,
      reason: 'Rest the favorite bid. Maker fee is 0.',
      score: clamp01(makeLeftover * input.winProb * 1.4),
    }
  }

  if (takeLeftover >= 0.1 && input.winProb >= 0.62 && drag < 8) {
    return {
      action: 'TAKE',
      side: input.favorite,
      entry: input.ask,
      ticketUsd: input.ticketUsd,
      leftover: takeLeftover,
      reason: 'Leftover still ≥ 10¢ after spread + taker buy.',
      score: clamp01(takeLeftover * input.winProb),
    }
  }

  return {
    action: 'SKIP',
    side: input.favorite,
    entry: input.ask,
    ticketUsd: input.ticketUsd,
    leftover: Math.max(0, takeLeftover),
    reason: 'Book is too wide or leftover after fees is under 10¢.',
    score: 0,
  }
}

function whyFor(flags: Flag[], favorite: Side, winProb: number): string {
  if (flags.includes('THIN')) return 'Printed size is too light — you will farm a dead book.'
  if (flags.includes('WIDE')) return 'Spread eats the leftover before the fee even shows up.'
  if (flags.includes('FEE DRAG')) return 'Taking here pays the fee curve. Rest a limit or skip.'
  if (flags.includes('MAKE')) return `Rest ${favorite} as maker. Fee is 0 and leftover is still real.`
  if (flags.includes('HIGH P')) return `${favorite} is ${Math.round(winProb * 100)}% implied without a fee trap.`
  if (flags.includes('REBATE') || flags.includes('LP')) return 'Rebate / LP book — print size, do not chase mid.'
  return 'Usable CLOB. Watch spread before you lift the offer.'
}

export function scoreMarket(raw: RawMarket, now = Date.now()): DeskMarket | null {
  const slug = raw.slug
  if (!slug) return null
  const { yes, no } = yesNo(raw)
  if (yes <= 0 && no <= 0) return null
  const favorite: Side = yes >= no ? 'YES' : 'NO'
  const winProb = Math.max(yes, no)
  const spread = bookSpread(raw)
  const volume = volumeUsd(raw)
  const tradeType = (raw.tradeType ?? 'clob').toLowerCase()
  const feePct = takerBuyFeePct(winProb)
  const hasRebates = hasIncentive(raw, 'rebates') || num(raw.settings?.rebateRate) > 0
  const hasLp = hasIncentive(raw, 'lp-reward') || num(raw.settings?.dailyReward) > 0
  const msLeft = Math.max(0, num(raw.expirationTimestamp) - now)
  const minUsd = Math.max(1, minSizeUsd(raw))
  const ask = favorite === 'YES' ? num(raw.tradePrices?.buy?.market?.[0], winProb) : num(raw.tradePrices?.buy?.market?.[1], winProb)
  const bid = favorite === 'YES' ? num(raw.tradePrices?.sell?.market?.[0], Math.max(0.01, winProb - (spread ?? 0.04))) : num(raw.tradePrices?.sell?.market?.[1], Math.max(0.01, winProb - (spread ?? 0.04)))
  const bestTrade = pickBestTrade({
    favorite,
    winProb,
    bid,
    ask,
    spread,
    feePct,
    ticketUsd: Math.min(Math.max(minUsd, 10), 100),
  })
  const drag = takeDrag(spread, feePct)
  const flags: Flag[] = []
  if (tradeType === 'clob') flags.push('MAKER 0%')
  if (spread != null && spread <= 0.05) flags.push('TIGHT')
  if (spread != null && spread > 0.12) flags.push('WIDE')
  if (volume < 80) flags.push('THIN')
  if (volume >= 4000) flags.push('HOT')
  if (hasRebates) flags.push('REBATE')
  if (hasLp) flags.push('LP')
  if (winProb >= 0.72 && drag < 6) flags.push('HIGH P')
  if (msLeft > 0 && msLeft < 2 * 60 * 60 * 1000) flags.push('NEAR')
  if (drag >= 6) flags.push('FEE DRAG')
  if (bestTrade.action === 'MAKE') flags.push('MAKE')
  if (bestTrade.action === 'TAKE') flags.push('TAKE')

  const tightness = spread == null ? 0.4 : 1 - Math.min(spread / 0.2, 1)
  const size = Math.min(1, Math.log10(volume + 1) / 5)
  const thinPenalty = volume < 50 ? 0.35 : volume < 200 ? 0.12 : 0
  const safe = clamp01(0.34 * tightness + 0.32 * size + (tradeType === 'clob' ? 0.16 : 0.04) + (hasRebates ? 0.08 : 0) + (hasLp ? 0.06 : 0) + 0.12 * winProb - thinPenalty)
  const volumeLane = clamp01(size - Math.min((spread ?? 0.12) / 0.2, 1) * 0.35)
  const winLane = clamp01(winProb - (drag >= 6 ? 0.22 : drag >= 3 ? 0.08 : 0) - ((spread ?? 0) > 0.12 ? 0.18 : 0))

  return {
    slug,
    displayTitle: raw.proxyTitle || raw.title || slug,
    ticker: tickerOf(raw),
    domain: firstProp(raw, 'domain') ?? raw.tags?.[0] ?? raw.categories?.[0] ?? 'market',
    duration: firstProp(raw, 'duration') ?? raw.categories?.[0] ?? 'live',
    tradeType,
    volumeUsd: volume,
    spread,
    yes,
    no,
    favorite,
    winProb,
    takerBuyFeePct: feePct,
    minSizeUsd: minUsd,
    msLeft,
    hasRebates,
    hasLp,
    flags,
    why: whyFor(flags, favorite, winProb),
    url: marketUrl(slug),
    scores: { safe, volumeLane, winLane },
    bestTrade,
  }
}

export function laneScore(market: DeskMarket, lane: 'safe' | 'volume' | 'win' | 'trade'): number {
  if (lane === 'volume') return market.scores.volumeLane
  if (lane === 'win') return market.scores.winLane
  if (lane === 'trade') return market.bestTrade.score
  return market.scores.safe
}

function packJointP(legs: RawPackLeg[]): number {
  return legs.reduce((acc, leg) => {
    const price = num(leg.livePrice, 0)
    const p = (leg.outcome ?? 'YES').toUpperCase() === 'NO' ? 1 - price : price
    return acc * clamp01(p)
  }, 1)
}

export function scorePack(raw: RawPack, now = Date.now()): DeskPack | null {
  const id = raw.id
  if (!id) return null
  const legsRaw = raw.legs ?? []
  if (legsRaw.length < 2) return null
  const jointP = packJointP(legsRaw)
  const multiplier = num(raw.payout?.parlayMultiplier)
  const payoutUsd = num(raw.payout?.parlayPayout)
  const savingsPct = num(raw.payout?.savingsPct)
  const deadline = raw.earliestDeadline ? Date.parse(raw.earliestDeadline) : now
  const legs: PackLeg[] = legsRaw.map((leg) => ({
    slug: leg.marketSlug ?? '',
    title: leg.marketTitle ?? '',
    outcome: (leg.outcome ?? 'YES').toUpperCase(),
    price: num(leg.livePrice),
    event: leg.group?.title ?? leg.group?.leagueName ?? null,
  }))
  return {
    id,
    name: raw.name ?? 'Pack',
    kind: raw.parlayType ?? 'PACK',
    legs,
    multiplier,
    payoutUsd,
    jointP,
    savingsPct,
    eligible: Boolean(raw.eligible),
    msLeft: Math.max(0, deadline - now),
    url: packUrl(id),
    scores: {
      best: clamp01(jointP * Math.min(payoutUsd / 40, 1.4)),
      safe: jointP,
      juice: clamp01((multiplier - 1) / 8),
    },
  }
}

export function packLaneScore(pack: DeskPack, lane: 'best' | 'safe' | 'juice'): number {
  if (lane === 'juice') return pack.scores.juice
  if (lane === 'safe') return pack.scores.safe
  return pack.scores.best
}
