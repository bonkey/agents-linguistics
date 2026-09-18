export type Outcome = 'a' | 'b' | 'tie'

export interface Comparison {
  a: string
  b: string
  outcome: Outcome
  prompt: string
  at: number
}

export interface Standing {
  arm: string
  wins: number
  losses: number
  ties: number
  games: number
  /** Bradley-Terry strength, scaled so that all arms sum to 100. */
  score: number
}

export type Rng = () => number

const PRIOR = 0.5 // pseudo-games against an average opponent; keeps strengths finite

/** Bradley-Terry strengths from pairwise outcomes. A tie counts as half a win for each side. */
export function standings(arms: string[], comps: Comparison[]): Standing[] {
  const idx = new Map(arms.map((a, i) => [a, i]))
  const n = arms.length
  const wins = new Array<number>(n).fill(0)
  const losses = new Array<number>(n).fill(0)
  const ties = new Array<number>(n).fill(0)
  const games = arms.map(() => new Array<number>(n).fill(0))
  const credit = new Array<number>(n).fill(0)

  for (const c of comps) {
    const i = idx.get(c.a)
    const j = idx.get(c.b)
    if (i === undefined || j === undefined || i === j) continue
    games[i][j]++
    games[j][i]++
    if (c.outcome === 'a') { wins[i]++; losses[j]++; credit[i] += 1 }
    else if (c.outcome === 'b') { wins[j]++; losses[i]++; credit[j] += 1 }
    else { ties[i]++; ties[j]++; credit[i] += 0.5; credit[j] += 0.5 }
  }

  // Minorization-maximization iterations for the Bradley-Terry model,
  // with a prior of PRIOR games at strength 1 so an unbeaten arm stays finite.
  let p = new Array<number>(n).fill(1)
  for (let iter = 0; iter < 200; iter++) {
    const next = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      let denom = PRIOR / (p[i] + 1)
      for (let j = 0; j < n; j++) {
        if (games[i][j] === 0) continue
        denom += games[i][j] / (p[i] + p[j])
      }
      next[i] = (credit[i] + PRIOR / 2) / denom
    }
    const mean = next.reduce((s, v) => s + Math.log(v), 0) / n
    const scale = Math.exp(-mean)
    let delta = 0
    for (let i = 0; i < n; i++) {
      next[i] *= scale
      delta = Math.max(delta, Math.abs(next[i] - p[i]))
    }
    p = next
    if (delta < 1e-9) break
  }
  const total = p.reduce((s, v) => s + v, 0)

  return arms
    .map((arm, i) => ({
      arm,
      wins: wins[i],
      losses: losses[i],
      ties: ties[i],
      games: wins[i] + losses[i] + ties[i],
      score: (100 * p[i]) / total,
    }))
    .sort((x, y) => y.score - x.score || x.arm.localeCompare(y.arm))
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Next pair to show for a prompt. The arm with the fewest games on this prompt
 * goes first; its opponent is the arm with the closest overall score that it has
 * not met on this prompt yet. Returns null when every pair has been played.
 */
export function nextPair(
  arms: string[],
  comps: Comparison[],
  prompt: string,
  rng: Rng = Math.random,
): [string, string] | null {
  const played = new Set<string>()
  const games = new Map<string, number>(arms.map((a) => [a, 0]))
  for (const c of comps) {
    if (c.prompt !== prompt) continue
    played.add(pairKey(c.a, c.b))
    games.set(c.a, (games.get(c.a) ?? 0) + 1)
    games.set(c.b, (games.get(c.b) ?? 0) + 1)
  }
  const score = new Map(standings(arms, comps).map((s) => [s.arm, s.score]))
  const shuffled = shuffle(arms, rng)
  const byGames = [...shuffled].sort((x, y) => (games.get(x) ?? 0) - (games.get(y) ?? 0))

  for (const a of byGames) {
    const candidates = shuffled.filter((b) => b !== a && !played.has(pairKey(a, b)))
    if (candidates.length === 0) continue
    const sa = score.get(a) ?? 0
    candidates.sort((x, y) => Math.abs((score.get(x) ?? 0) - sa) - Math.abs((score.get(y) ?? 0) - sa))
    const b = candidates[0]
    return rng() < 0.5 ? [a, b] : [b, a]
  }
  return null
}

export function gamesFor(comps: Comparison[], prompt: string): number {
  return comps.filter((c) => c.prompt === prompt).length
}

export function totalPairs(armCount: number): number {
  return (armCount * (armCount - 1)) / 2
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
