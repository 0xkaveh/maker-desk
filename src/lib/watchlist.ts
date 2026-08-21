const KEY = 'maker-desk.watchlist.v1'

export function loadWatchlist(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function saveWatchlist(slugs: string[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(slugs))
}

export function toggleWatch(slugs: string[], slug: string): string[] {
  return slugs.includes(slug) ? slugs.filter((item) => item !== slug) : [...slugs, slug]
}
