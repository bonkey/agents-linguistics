import { useEffect, useMemo } from 'react'
import { ARM_IDS } from '../data/arms'
import { PROJECTS, harnessLabel, pickSample, resolve, type Question } from '../data/samples'
import { gamesFor, nextPair, type Comparison, type Outcome } from '../lib/ranking'
import { Markdown } from './Markdown'
import { Prompt } from './Prompt'

export const ROUND = 10

interface Props {
  question: Question
  comps: Comparison[]
  onPick: (c: Comparison) => void
  onResults: () => void
}

export function Compare({ question, comps, onPick, onResults }: Props) {
  const { project, prompt } = resolve(question)
  const q: Question = { project: project.id, prompt: prompt.id }
  const done = gamesFor(comps, q.project, q.prompt)
  // A new pair only when the number of picks or the prompt changes, so a re-render never reshuffles.
  const pair = useMemo(() => nextPair(ARM_IDS, comps, q.project, q.prompt), [comps.length, q.project, q.prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  const samples = useMemo(
    () => (pair ? [pickSample(q, pair[0]), pickSample(q, pair[1])] : []),
    [pair, q.project, q.prompt], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const pick = (outcome: Outcome) => {
    if (!pair) return
    onPick({ a: pair[0], b: pair[1], outcome, ...q, at: Date.now() })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') pick('a')
      else if (e.key === 'ArrowRight' || e.key === 'b' || e.key === 'B') pick('b')
      else if (e.key === '0' || e.key === 's' || e.key === 'S') pick('tie')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!pair || !samples[0] || !samples[1]) {
    return (
      <main className="page narrow">
        <h2>Every pair on this prompt is done</h2>
        <button className="primary" onClick={onResults}>See your results</button>
      </main>
    )
  }

  const inRound = done % ROUND
  return (
    <main className="page compare">
      <header className="bar">
        <Prompt prompt={prompt} label={PROJECTS.length > 1 ? project.name : 'Prompt'} />
        <details className="how muted small">
          <summary>How the ranking works</summary>
          <ol>
            <li>You see two answers to the same question, labelled A and B. Names stay hidden.</li>
            <li>You pick the one you would rather read, or say you have no preference.</li>
            <li>The next pair is chosen so that every pick carries information: the style with the fewest picks meets the one closest to it in score.</li>
            <li>After ten picks the names come out, with a Bradley-Terry score from your picks. Keep going on the short answers, or switch to the long review answers to test structure.</li>
          </ol>
        </details>
      </header>
      <nav className="vote-nav" aria-label="Pick the answer you would rather read">
        <button className="vote-a" onClick={() => pick('a')} title="Left arrow or A">A reads better</button>
        <button className="vote-tie" onClick={() => pick('tie')} title="0 or S">No preference</button>
        <button className="vote-b" onClick={() => pick('b')} title="Right arrow or B">B reads better</button>
      </nav>
      <div className="pair compare-pair">
        <article className="pane pane-a">
          <div className="pane-head">
            <span className="pane-label">A</span>{' '}
            <span className="pane-meta">{samples[0].words} words · {harnessLabel(samples[0].harness)}</span>
          </div>
          <Markdown text={samples[0].text} />
        </article>
        <article className="pane pane-b">
          <div className="pane-head">
            <span className="pane-label">B</span>{' '}
            <span className="pane-meta">{samples[1].words} words · {harnessLabel(samples[1].harness)}</span>
          </div>
          <Markdown text={samples[1].text} />
        </article>
      </div>
      <footer className="bar sticky">
        <span className="muted">
          Pick {inRound + 1} of {ROUND}{done >= ROUND ? ` (round ${Math.floor(done / ROUND) + 1})` : ''}
        </span>
        {done > 0 && <button className="link" onClick={onResults}>Results so far</button>}
      </footer>
    </main>
  )
}
