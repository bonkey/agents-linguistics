import type { Comparison } from './ranking'

const KEY = 'bakeoff.v1'

export interface Saved {
  comps: Comparison[]
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { comps: [] }
    const parsed = JSON.parse(raw) as Partial<Saved>
    return { comps: Array.isArray(parsed.comps) ? parsed.comps : [] }
  } catch {
    return { comps: [] }
  }
}

export function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage unavailable: the session still works, it just does not persist
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
