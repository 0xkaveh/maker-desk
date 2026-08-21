import { describe, expect, it } from 'vitest'
import { pickBestTrade, scoreMarket, takerBuyFeePct } from './score'

describe('takerBuyFeePct', () => {
  it('charges 3% at or below 50¢', () => {
    expect(takerBuyFeePct(0.4)).toBe(3)
    expect(takerBuyFeePct(0.5)).toBe(3)
  })

  it('falls toward 40bps near 99.9¢', () => {
    expect(takerBuyFeePct(0.999)).toBeCloseTo(0.4, 2)
  })
})

describe('pickBestTrade', () => {
  it('rests a MAKE when leftover is at least 10¢', () => {
    const trade = pickBestTrade({
      favorite: 'YES',
      winProb: 0.62,
      bid: 0.58,
      ask: 0.62,
      spread: 0.04,
      feePct: 2.1,
      ticketUsd: 10,
    })
    expect(trade.action).toBe('MAKE')
    expect(trade.leftover).toBeCloseTo(0.42)
    expect(trade.score).toBeGreaterThan(0)
  })

  it('skips when leftover after taking is under 10¢', () => {
    const trade = pickBestTrade({
      favorite: 'YES',
      winProb: 0.96,
      bid: 0.94,
      ask: 0.97,
      spread: 0.18,
      feePct: 0.5,
      ticketUsd: 10,
    })
    expect(trade.action).toBe('SKIP')
    expect(trade.score).toBe(0)
  })
})

describe('scoreMarket', () => {
  it('flags tight CLOB rebate books and stamps the referral link', () => {
    const market = scoreMarket({
      slug: 'btc-hourly',
      title: 'BTC Up or Down - Hourly',
      tradeType: 'clob',
      volumeFormatted: 12000,
      prices: [0.62, 0.38],
      tradePrices: {
        buy: { market: [0.63, 0.39] },
        sell: { market: [0.6, 0.36] },
      },
      expirationTimestamp: Date.now() + 50 * 60 * 1000,
      categories: ['Hourly'],
      tags: ['Crypto'],
      settings: { minSize: '1000000', maxSpread: 0.04, dailyReward: '5', rebateRate: '1' },
      properties: [
        { propertyKeySlug: 'domain', value: ['crypto'] },
        { propertyKeySlug: 'duration', value: ['hourly'] },
        { propertyKeySlug: 'incentive', value: ['lp-reward', 'rebates'] },
      ],
    })
    expect(market).not.toBeNull()
    expect(market?.flags).toEqual(expect.arrayContaining(['TIGHT', 'MAKER 0%', 'REBATE', 'LP', 'MAKE']))
    expect(market?.url).toContain('r=YVH0J7QD0S')
    expect(market?.bestTrade.action).toBe('MAKE')
  })
})
