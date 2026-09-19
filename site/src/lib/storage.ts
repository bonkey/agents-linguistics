import type { Comparison } from './ranking'

const KEY = 'bakeoff.v1'
/** Picks stored without a project belong to the only project recorded at that time. */
const FIRST_PROJECT = 'herdr-pr-emoji'

export interface Saved {
  comps: Comparison[]
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { comps: [] }
    const parsed = JSON.parse(raw) as { comps?: unknown }
    return { comps: Array.isArray(parsed.comps) ? parsed.comps.flatMap(toComparison) : [] }
  } catch {
    return { comps: [] }
  }
}

/** A stored entry as a pick, or nothing when it is not one. */
function toComparison(x: unknown): Comparison[] {
  if (typeof x !== 'object' || x === null) return []
  const { a, b, outcome, project = FIRST_PROJECT, prompt, at } = x as Record<string, unknown>
  if (typeof a !== 'string' || typeof b !== 'string' || typeof prompt !== 'string' || typeof project !== 'string') return []
  if (outcome !== 'a' && outcome !== 'b' && outcome !== 'tie') return []
  return [{ a, b, outcome, project, prompt, at: typeof at === 'number' ? at : 0 }]
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
