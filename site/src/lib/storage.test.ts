// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { clear, load, save } from './storage'

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('starts empty', () => {
    expect(load()).toEqual({ comps: [] })
  })

  it('returns what was saved', () => {
    const comps = [{ a: 'x', b: 'y', outcome: 'a' as const, project: 'p', prompt: 'short', at: 1 }]
    save({ comps })
    expect(load()).toEqual({ comps })
  })

  it('survives text that is not JSON', () => {
    localStorage.setItem('bakeoff.v1', '{not json')
    expect(load()).toEqual({ comps: [] })
  })

  it('survives a value without a list of picks', () => {
    localStorage.setItem('bakeoff.v1', '{"comps":"nope"}')
    expect(load()).toEqual({ comps: [] })
  })

  it('assigns picks stored without a project to the first recorded project', () => {
    localStorage.setItem('bakeoff.v1', JSON.stringify({ comps: [{ a: 'x', b: 'y', outcome: 'b', prompt: 'review', at: 7 }] }))
    expect(load().comps).toEqual([{ a: 'x', b: 'y', outcome: 'b', project: 'herdr-pr-emoji', prompt: 'review', at: 7 }])
  })

  it('drops entries that are not picks and keeps the rest', () => {
    const good = { a: 'x', b: 'y', outcome: 'tie', project: 'p', prompt: 'short', at: 1 }
    localStorage.setItem('bakeoff.v1', JSON.stringify({ comps: [null, 3, 'x', {}, { ...good, outcome: 'maybe' }, { ...good, a: 1 }, good] }))
    expect(load().comps).toEqual([good])
  })

  it('forgets everything on clear', () => {
    save({ comps: [{ a: 'x', b: 'y', outcome: 'tie', project: 'p', prompt: 'short', at: 1 }] })
    clear()
    expect(load()).toEqual({ comps: [] })
  })
})
