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

  it('keeps the ranking steps in a closed disclosure at the top of browse', () => {
    render(<App />)
    expect(screen.queryByText('How the ranking works')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Browse all answers' }))
    const details = screen.getByText('How the ranking works').closest('details')
    expect(details?.open).toBe(false)
    expect(details?.querySelectorAll('ol li')).toHaveLength(4)
  })

  it('browses answers with names shown', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse all answers' }))
    expect(document.querySelector('.pane-head')?.textContent).toContain(ARMS[0].name)
  })

  it('lists every style in its own section', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Styles' }))
    expect(screen.getByRole('heading', { name: 'The styles in the test' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Built into Claude Code', 'Custom style file', 'Plugins'])
    // Arms that share a link form one subsection: the Caveman modes sit under one "Caveman" heading.
    const h3 = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(h3).toEqual(['Default', 'Concise', 'Proactive', 'Explanatory', 'Learning', 'STE Concise', 'Caveman', 'I have ADHD'])
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['Lite', 'Full', 'Ultra'])
    const hrefs = screen.getAllByRole('link', { name: 'Source' }).map((l) => l.getAttribute('href'))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const a of ARMS) expect(hrefs, a.name).toContain(a.link)
    expect(window.location.hash).toBe('#styles')
  })

  it('links to the repository from the nav', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'GitHub repository' }).getAttribute('href')).toBe('https://github.com/bonkey/agents-linguistics')
    expect(screen.queryByRole('button', { name: 'Test your style' })).toBeNull()
  })

  it('shows the landing page for a hash that names no view', () => {
    window.history.replaceState(null, '', '/#own')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Ten ways Claude can talk.')
  })

  it('mounts and navigates when window.scrollTo returns a Promise', () => {
    // Chrome returns a Promise from scrollTo. React calls whatever an effect returns as its cleanup.
    const scrollTo = window.scrollTo
    window.scrollTo = (() => Promise.resolve()) as unknown as typeof window.scrollTo
    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Styles' }))
      expect(screen.getByRole('heading', { name: 'The styles in the test' })).toBeTruthy()
    } finally {
      window.scrollTo = scrollTo
    }
  })
})
