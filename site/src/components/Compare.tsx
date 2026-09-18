import { useEffect, useMemo } from 'react'
import { ARM_IDS } from '../data/arms'
import { PROMPTS, harnessLabel, pickSample } from '../data/samples'
import { gamesFor, nextPair, type Comparison, type Outcome } from '../lib/ranking'
import { Markdown } from './Markdown'

export const ROUND = 10

interface Props {
  prompt: string
  comps: Comparison[]
  onPick: (c: Comparison) => void
  onResults: () => void
}

export function Compare({ prompt, comps, onPick, onResults }: Props) {
  const done = gamesFor(comps, prompt)
  // A new pair only when the number of picks or the prompt changes, so a re-render never reshuffles.
  const pair = useMemo(() => nextPair(ARM_IDS, comps, prompt), [comps.length, prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  const samples = useMemo(
    () => (pair ? [pickSample(pair[0], prompt), pickSample(pair[1], prompt)] : []),
    [pair, prompt],
  )

  const pick = (outcome: Outcome) => {
    if (!pair) return
    onPick({ a: pair[0], b: pair[1], outcome, prompt, at: Date.now() })
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
    <main className="page">
      <header className="bar">
        <div>
          <span className="muted">Prompt</span> <strong>{PROMPTS[prompt]}</strong>
        </div>
        <div className="muted">
          Pick {inRound + 1} of {ROUND}{done >= ROUND ? ` (round ${Math.floor(done / ROUND) + 1})` : ''}
        </div>
      </header>
      <div className="pair">
        <article className="pane">
          <div className="pane-head">A <span className="muted">{samples[0].words} words · {harnessLabel(samples[0].harness)}</span></div>
          <Markdown text={samples[0].text} />
        </article>
        <article className="pane">
          <div className="pane-head">B <span className="muted">{samples[1].words} words · {harnessLabel(samples[1].harness)}</span></div>
          <Markdown text={samples[1].text} />
        </article>
      </div>
      <footer className="bar sticky">
        <button className="primary" onClick={() => pick('a')} title="Left arrow or A">A reads better</button>
        <button onClick={() => pick('tie')} title="0 or S">No preference</button>
        <button className="primary" onClick={() => pick('b')} title="Right arrow or B">B reads better</button>
        {done > 0 && <button className="link" onClick={onResults}>Results so far</button>}
      </footer>
    </main>
  )
}
