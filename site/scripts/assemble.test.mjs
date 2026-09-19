import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assemble } from './assemble.mjs'

const answer = (result) => ({ result, eval: { harness: { tool: 'T', version: '1', model: 'm', effort: 'e' } } })
const projectsFile = {
  prompt_kinds: { short: 'One question.', 'review-pr': 'One pull request.' },
  projects: [
    { id: 'one', name: 'One', description: 'First.', category: 'cli', tech: ['Python'], repo: 'https://example.test/one', ref: 'abc', status: 'done',
      prompts: [{ id: 'review-pr-7', kind: 'review-pr', text: ' Review #7. ', target: { pr: 7 } }, { id: 'short', kind: 'short', text: 'Why?' }, { id: 'unrun', kind: 'short', text: 'Never run.' }] },
    { id: 'two', name: 'Two', description: 'Second.', category: 'web', tech: ['TypeScript'], repo: 'https://example.test/two', ref: 'def', status: 'done',
      prompts: [{ id: 'short', kind: 'short', text: 'How?' }] },
    { id: 'pending', name: 'Pending', description: 'No answers.', category: 'ios', tech: ['Swift'], repo: 'https://example.test/p', ref: '000', status: 'pending',
      prompts: [{ id: 'short', kind: 'short', text: 'When?' }] },
  ],
}
const records = [
  { project: 'one', prompt: 'short', arm: 'default', run: 1, json: answer('a b c') },
  { project: 'one', prompt: 'short', arm: 'default', run: 2, json: answer('again') },
  { project: 'one', prompt: 'review-pr-7', arm: 'concise', run: 1, json: answer('fine') },
  { project: 'one', prompt: 'short', arm: 'broken', run: 1, json: { is_error: true, result: 'x' } },
  { project: 'two', prompt: 'short', arm: 'default', run: 1, json: answer('two words') },
  { project: 'one', prompt: 'probe', arm: 'default', run: 1, json: answer('not a listed prompt') },
]

describe('assemble', () => {
  const out = assemble(projectsFile, records)

  it('ships every project that has an answer, in projects.json order, and no pending one', () => {
    expect(out.projects.map((p) => p.id)).toEqual(['one', 'two'])
    expect(out.projects[1]).toMatchObject({ name: 'Two', repo: 'https://example.test/two', ref: 'def', category: 'web', tech: ['TypeScript'] })
  })

  it('ships only prompts that have an answer, with kind, trimmed text and target', () => {
    expect(out.projects[0].prompts).toEqual([
      { id: 'review-pr-7', kind: 'review-pr', text: 'Review #7.', target: { pr: 7 } },
      { id: 'short', kind: 'short', text: 'Why?' },
    ])
  })

  it('gives every sample an id that is unique across projects and runs', () => {
    expect(out.samples.map((s) => s.id)).toEqual(['one--review-pr-7--concise', 'one--short--default', 'one--short--default--2', 'two--short--default'])
    expect(out.samples[1]).toMatchObject({ project: 'one', prompt: 'short', arm: 'default', run: 1, words: 3 })
  })

  it('carries the prompt kinds and the distinct harnesses', () => {
    expect(out.prompt_kinds).toEqual(projectsFile.prompt_kinds)
    expect(out.harnesses).toHaveLength(1)
  })
})

describe('assemble on eval/projects.json', () => {
  it('accepts every project and prompt defined today, whatever its target looks like', () => {
    const file = JSON.parse(readFileSync(new URL('../../eval/projects.json', import.meta.url), 'utf8'))
    const all = file.projects.flatMap((p) => p.prompts.map((q) => ({ project: p.id, prompt: q.id, arm: 'default', run: 1, json: answer('x') })))
    const out = assemble(file, all)
    expect(out.projects).toHaveLength(file.projects.length)
    expect(out.samples).toHaveLength(all.length)
    expect(new Set(out.samples.map((s) => s.id)).size).toBe(all.length)
    for (const p of out.projects) {
      for (const k of ['id', 'name', 'description', 'category', 'repo', 'ref']) expect(typeof p[k], `${p.id}.${k}`).toBe('string')
      expect(Array.isArray(p.tech), `${p.id}.tech`).toBe(true)
      for (const q of p.prompts) {
        for (const k of ['id', 'kind', 'text']) expect(typeof q[k], `${p.id}/${q.id}.${k}`).toBe('string')
        if ('target' in q) expect(typeof q.target, `${p.id}/${q.id}.target`).toBe('object')
      }
    }
  })
})
