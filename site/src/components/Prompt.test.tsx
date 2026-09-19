// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Prompt } from './Prompt'

afterEach(cleanup)

describe('Prompt', () => {
  it('shows a label and the prompt text', () => {
    render(<Prompt prompt={{ id: 'short', kind: 'short', text: 'Why is it so?' }} />)
    expect(screen.getByText('Prompt')).toBeTruthy()
    expect(screen.getByText('Why is it so?')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('links the target url where the text mentions it, without changing the text', () => {
    const url = 'https://example.test/pull/7'
    const { container } = render(<Prompt label="One" prompt={{ id: 'pr', kind: 'review-pr', text: `Review #7 (${url}). Give a verdict.`, target: { pr: 7, url } }} />)
    expect(screen.getByRole('link', { name: url }).getAttribute('href')).toBe(url)
    expect(container.querySelector('.prompt-text')?.textContent).toBe(`Review #7 (${url}). Give a verdict.`)
    expect(screen.getByText('One')).toBeTruthy()
  })

  it('leaves a url that is not https, or not in the text, as plain text', () => {
    render(<Prompt prompt={{ id: 'x', kind: 'review-pr', text: 'See javascript:alert(1) here.', target: { url: 'javascript:alert(1)' } }} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
