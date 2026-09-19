import { describe, expect, it } from 'vitest'
import { gamesFor, nextPair, standings, totalPairs, type Comparison } from './ranking'

const arms = ['a', 'b', 'c', 'd']
const cmp = (a: string, b: string, outcome: Comparison['outcome'], prompt = 'short', project = 'p1'): Comparison => ({
  a, b, outcome, project, prompt, at: 0,
})

function seeded(seed = 1): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('standings', () => {
  it('gives every arm the same score without comparisons', () => {
    const s = standings(arms, [])
    expect(s).toHaveLength(4)
    for (const x of s) expect(x.score).toBeCloseTo(25, 6)
  })

  it('ranks a winner above the loser and counts the record', () => {
    const s = standings(arms, [cmp('a', 'b', 'a'), cmp('b', 'a', 'b')])
    expect(s[0].arm).toBe('a')
    expect(s[0]).toMatchObject({ wins: 2, losses: 0, ties: 0, games: 2 })
    expect(s.find((x) => x.arm === 'b')).toMatchObject({ wins: 0, losses: 2, games: 2 })
    expect(s[0].score).toBeGreaterThan(s[1].score)
  })

  it('keeps tied arms equal', () => {
    const s = standings(arms, [cmp('a', 'b', 'tie')])
    const a = s.find((x) => x.arm === 'a')!
    const b = s.find((x) => x.arm === 'b')!
    expect(a.score).toBeCloseTo(b.score, 9)
    expect(a.ties).toBe(1)
  })

  it('orders by transitive strength', () => {
    const s = standings(arms, [cmp('a', 'b', 'a'), cmp('b', 'c', 'a'), cmp('c', 'd', 'a')])
    expect(s.map((x) => x.arm)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('pools picks from every prompt into one ranking', () => {
    const rows = standings(arms, [cmp('a', 'b', 'a', 'short'), cmp('a', 'b', 'a', 'review')])
    expect(rows.find((r) => r.arm === 'a')).toMatchObject({ wins: 2, games: 2 })
    expect(rows[0].arm).toBe('a')
  })

  it('ignores arms it does not know', () => {
    const s = standings(arms, [cmp('a', 'zzz', 'a')])
    expect(s.find((x) => x.arm === 'a')!.games).toBe(0)
  })
})

describe('nextPair', () => {
  it('never repeats a pair on the same prompt and exhausts every pair', () => {
    const comps: Comparison[] = []
    const seen = new Set<string>()
    const rng = seeded(7)
    for (;;) {
      const pair = nextPair(arms, comps, 'p1', 'short', rng)
      if (!pair) break
      const key = [...pair].sort().join('|')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
      comps.push(cmp(pair[0], pair[1], 'a'))
    }
    expect(seen.size).toBe(totalPairs(arms.length))
    expect(gamesFor(comps, 'p1', 'short')).toBe(6)
  })

  it('starts a second prompt from scratch', () => {
    const comps: Comparison[] = [cmp('a', 'b', 'a'), cmp('c', 'd', 'a')]
    expect(nextPair(arms, comps, 'p1', 'review', seeded(3))).not.toBeNull()
    expect(gamesFor(comps, 'p1', 'review')).toBe(0)
  })

  it('keeps the same prompt id apart between projects', () => {
    const comps: Comparison[] = [cmp('a', 'b', 'a', 'short', 'p1')]
    expect(gamesFor(comps, 'p1', 'short')).toBe(1)
    expect(gamesFor(comps, 'p2', 'short')).toBe(0)
    // On p2 the pair a-b is still open, so all six pairs can be played there.
    const seen = new Set<string>()
    const rng = seeded(5)
    const all = [...comps]
    for (;;) {
      const pair = nextPair(arms, all, 'p2', 'short', rng)
      if (!pair) break
      seen.add([...pair].sort().join('|'))
      all.push(cmp(pair[0], pair[1], 'a', 'short', 'p2'))
    }
    expect(seen.size).toBe(totalPairs(arms.length))
  })

  it('gives the arm with the fewest games the next pair', () => {
    const comps: Comparison[] = [cmp('a', 'b', 'a'), cmp('a', 'c', 'a'), cmp('b', 'c', 'a')]
    const pair = nextPair(arms, comps, 'p1', 'short', seeded(11))!
    expect(pair).toContain('d')
  })

  it('pairs the leader with the arm closest in score', () => {
    // a beat everyone twice, b beat c and d, c beat d: clear ladder a > b > c > d on prompt "review".
    const ladder: Comparison[] = [
      cmp('a', 'b', 'a', 'review'), cmp('a', 'c', 'a', 'review'), cmp('a', 'd', 'a', 'review'),
      cmp('b', 'c', 'a', 'review'), cmp('b', 'd', 'a', 'review'), cmp('c', 'd', 'a', 'review'),
    ]
    // On "short", only a and d have played once (each other), so b and c have the fewest games.
    const comps = [...ladder, cmp('a', 'd', 'a')]
    const pair = nextPair(arms, comps, 'p1', 'short', seeded(5))!
    expect([...pair].sort()).toEqual(['b', 'c'])
  })
})
