// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../data/samples'
import { QuestionPicker } from './QuestionPicker'

afterEach(cleanup)

const base = { description: 'd', category: 'cli', tech: ['Python'], repo: 'https://example.test/r', ref: 'abc' }
const one: Project = {
  ...base, id: 'one', name: 'One',
  prompts: [
    { id: 'review', kind: 'review-project', text: 'Review it.' },
    { id: 'short', kind: 'short', text: 'Why?' },
  ],
}
const two: Project = {
  ...base, id: 'two', name: 'Two',
  prompts: [
    { id: 'review-pr-7', kind: 'review-pr', text: 'Review #7.', target: { pr: 7 } },
    { id: 'review-pr-9', kind: 'review-pr', text: 'Review #9.', target: { pr: 9 } },
    { id: 'odd', kind: 'not-a-known-kind', text: 'Odd.' },
    { id: 'find-issues', kind: 'find-issues', text: 'Find them.', target: { area: 'the parser' } },
    { id: 'later', kind: 'critique-readme', text: 'Later.', target: { pr: 3, title: 't', url: 'u', state_when_recorded: 'open', something_new: [1] } },
  ],
}

describe('QuestionPicker', () => {
  it('shows no project selector for a single project, and the short question first', () => {
    render(<QuestionPicker value={{ project: 'one', prompt: 'short' }} onChange={() => {}} projects={[one]} />)
    expect(screen.queryByRole('combobox', { name: 'Project' })).toBeNull()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Short question', 'Project review'])
  })

  it('offers every project once there are two, and switches to the first question of the chosen one', () => {
    const onChange = vi.fn()
    render(<QuestionPicker value={{ project: 'one', prompt: 'short' }} onChange={onChange} projects={[one, two]} />)
    const select = screen.getByRole('combobox', { name: 'Project' })
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['One', 'Two'])
    fireEvent.change(select, { target: { value: 'two' } })
    expect(onChange).toHaveBeenCalledWith({ project: 'two', prompt: 'review-pr-7' })
  })

  it('tells prompts of one kind apart by their target, and labels an unknown kind by its id', () => {
    const onChange = vi.fn()
    render(<QuestionPicker value={{ project: 'two', prompt: 'review-pr-9' }} onChange={onChange} projects={[one, two]} />)
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['PR review #7', 'PR review #9', 'odd', 'Find issues', 'README critique'])
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('PR review #9')
    fireEvent.click(screen.getByRole('tab', { name: 'odd' }))
    expect(onChange).toHaveBeenCalledWith({ project: 'two', prompt: 'odd' })
  })

  it('falls back to the first project and question for ids that name nothing', () => {
    render(<QuestionPicker value={{ project: 'gone', prompt: 'gone' }} onChange={() => {}} projects={[one, two]} />)
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Short question')
  })
})
