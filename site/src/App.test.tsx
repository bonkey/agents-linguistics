// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { ARMS } from './data/arms'
import { SAMPLES } from './data/samples'

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/') })
afterEach(cleanup)

describe('data', () => {
  it('has at least one short sample for every arm', () => {
    for (const a of ARMS) {
      expect(SAMPLES.some((s) => s.arm === a.id && s.prompt === 'short'), a.id).toBe(true)
    }
  })
})

describe('App', () => {
  it('walks from landing to a hidden-name pair to the ranking', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Start the test' })[0])

    // Two panes, labelled A and B, no arm name anywhere on the page.
    expect(screen.getByText('Pick 1 of 10')).toBeTruthy()
    const heads = document.querySelectorAll('.pane-head')
    expect(heads).toHaveLength(2)
    // The answer text itself may contain a word like "Default"; only the labels must stay anonymous.
    const labels = [...heads].map((h) => h.textContent ?? '')
    expect(labels[0]).toMatch(/^A\b/)
    expect(labels[1]).toMatch(/^B\b/)
    for (const a of ARMS) for (const l of labels) expect(l.includes(a.name), `${a.name} in "${l}"`).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'A reads better' }))
    expect(screen.getByText('Pick 2 of 10')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Results so far' }))
    expect(screen.getByRole('heading', { name: 'Your results' })).toBeTruthy()
    expect(document.querySelectorAll('.ranking li')).toHaveLength(ARMS.length)

    // The pick survives a reload.
    expect(JSON.parse(localStorage.getItem('bakeoff.v1') ?? '{}').comps).toHaveLength(1)
  })

  it('shows the ranking after ten picks', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Start the test' })[0])
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'B reads better' }))
    expect(screen.getByRole('heading', { name: 'Your results' })).toBeTruthy()
  })

  it('browses answers with names shown', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse all answers' }))
    expect(document.querySelector('.pane-head')?.textContent).toContain(ARMS[0].name)
  })
})
