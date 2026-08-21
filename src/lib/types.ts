export const REF_CODE = 'YVH0J7QD0S'
export const REF_SIGNUP = `https://limitless.exchange/?r=${REF_CODE}`
export const REF_REFERRALS = `https://limitless.exchange/referrals?r=${REF_CODE}`

export type Lang = 'en' | 'fa'
export type BookLane = 'safe' | 'volume' | 'win' | 'trade'
export type PackLane = 'best' | 'safe' | 'juice'
export type TraderBoard = 'pnl24h' | 'pnl7d' | 'pnl30d' | 'refs'
export type TradeAction = 'MAKE' | 'TAKE' | 'SKIP'
export type Side = 'YES' | 'NO'
export type Flag =
  | 'TIGHT'
  | 'MAKER 0%'
  | 'REBATE'
  | 'LP'
  | 'HIGH P'
  | 'NEAR'
  | 'HOT'
  | 'WIDE'
  | 'THIN'
  | 'FEE DRAG'
  | 'MAKE'
  | 'TAKE'

export interface BestTrade {
  action: TradeAction
  side: Side
  entry: number
  ticketUsd: number
  leftover: number
  reason: string
  score: number
}

export interface DeskMarket {
  slug: string
  displayTitle: string
  ticker: string | null
  domain: string
  duration: string
  tradeType: string
  volumeUsd: number
  spread: number | null
  yes: number
  no: number
  favorite: Side
  winProb: number
  takerBuyFeePct: number
  minSizeUsd: number
  msLeft: number
  hasRebates: boolean
  hasLp: boolean
  flags: Flag[]
  why: string
  url: string
  scores: {
    safe: number
    volumeLane: number
    winLane: number
  }
  bestTrade: BestTrade
}

export interface PackLeg {
  slug: string
  title: string
  outcome: string
  price: number
  event: string | null
}

export interface DeskPack {
  id: string
  name: string
  kind: string
  legs: PackLeg[]
  multiplier: number
  payoutUsd: number
  jointP: number
  savingsPct: number
  eligible: boolean
  msLeft: number
  url: string
  scores: {
    best: number
    safe: number
    juice: number
  }
}

export interface PnlRow {
  rank: number
  account: string
  name: string
  pnlUsd: number
  roiPct: number
  volumeUsd: number
}

export interface RefRow {
  rank: number
  account: string
  earnedUsd: number
  feesUsd: number
  referred: number
}

export interface TraderBoards {
  '24h': PnlRow[]
  '7d': PnlRow[]
  '30d': PnlRow[]
  refs: RefRow[]
}
