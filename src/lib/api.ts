import { scoreMarket, scorePack, type RawMarket, type RawPack } from './score'
import type { DeskMarket, DeskPack, PnlRow, RefRow, TraderBoards } from './types'

const API = '/limitless'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Limitless ${path} HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

async function mapPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()))
  return results
}

export async function fetchDeskMarkets(): Promise<DeskMarket[]> {
  const first = await getJson<{ data?: RawMarket[]; totalMarketsCount?: number }>(
    '/markets/active?limit=25&page=1&sortBy=high_value',
  )
  const total = Math.min(first.totalMarketsCount ?? first.data?.length ?? 0, 400)
  const pages = Math.ceil(total / 25)
  const restPages = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2)
  const rest = await mapPool(restPages, 4, (page) =>
    getJson<{ data?: RawMarket[] }>(`/markets/active?limit=25&page=${page}&sortBy=high_value`),
  )
  const raw = [...(first.data ?? []), ...rest.flatMap((payload) => payload.data ?? [])]
  const seen = new Set<string>()
  const markets: DeskMarket[] = []
  for (const item of raw) {
    const scored = scoreMarket(item)
    if (!scored || seen.has(scored.slug)) continue
    if (scored.yes <= 0 && scored.no <= 0) continue
    seen.add(scored.slug)
    markets.push(scored)
  }
  return markets
}

export async function fetchDeskPacks(): Promise<{ packs: DeskPack[]; count: number }> {
  const raw = await getJson<RawPack[] | { packs?: RawPack[]; data?: RawPack[] }>('/parlay/packs')
  const list = Array.isArray(raw) ? raw : (raw.packs ?? raw.data ?? [])
  const packs = list.map((item) => scorePack(item)).filter((item): item is DeskPack => item != null)
  return { packs, count: list.length }
}

interface PnlPayload {
  data?: Array<{
    rank?: number
    account?: string
    username?: string
    displayName?: string
    realizedPnl?: { usd?: string | number }
    realizedRoi?: number
    closedCostBasis?: { usd?: string | number }
  }>
}

interface RefPayload {
  entries?: Array<{
    rank?: number
    account?: string
    earnedRaw?: string
    feesGeneratedRaw?: string
    referredCount?: number
  }>
}

function usdFromRaw(raw: string | undefined): number {
  const parsed = Number(raw ?? 0)
  return Number.isFinite(parsed) ? parsed / 1e6 : 0
}

function asPnl(row: NonNullable<PnlPayload['data']>[number], index: number): PnlRow {
  return {
    rank: row.rank ?? index + 1,
    account: row.account ?? '',
    name: row.username || row.displayName || row.account || '',
    pnlUsd: Number(row.realizedPnl?.usd ?? 0),
    roiPct: Number(row.realizedRoi ?? 0),
    volumeUsd: Number(row.closedCostBasis?.usd ?? 0),
  }
}

export async function fetchTraderBoards(): Promise<TraderBoards> {
  const [h24, d7, d30, refs] = await Promise.all([
    getJson<PnlPayload>('/leaderboard/pnl?window=24h&scope=global'),
    getJson<PnlPayload>('/leaderboard/pnl?window=7d&scope=global'),
    getJson<PnlPayload>('/leaderboard/pnl?window=30d&scope=global'),
    getJson<RefPayload>('/referral/usdc/leaderboard?limit=50'),
  ])
  return {
    '24h': (h24.data ?? []).map(asPnl),
    '7d': (d7.data ?? []).map(asPnl),
    '30d': (d30.data ?? []).map(asPnl),
    refs: (refs.entries ?? []).map((row, index) => ({
      rank: row.rank ?? index + 1,
      account: row.account ?? '',
      earnedUsd: usdFromRaw(row.earnedRaw),
      feesUsd: usdFromRaw(row.feesGeneratedRaw),
      referred: row.referredCount ?? 0,
    })),
  }
}

export async function lookupVolume(account: string): Promise<number | null> {
  const clean = account.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) return null
  const payload = await getJson<{ data?: string | number }>(`/portfolio/${clean}/traded-volume`)
  const value = Number(payload.data)
  return Number.isFinite(value) ? value : null
}


