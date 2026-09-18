import { useState } from 'react'
import { ARM_BY_ID, ARM_IDS } from '../data/arms'
import { HowItWorks } from './HowItWorks'
import { KIND_CLASS } from './Landing'
import { PROMPTS, PROMPT_ORDER } from '../data/samples'
import { gamesFor, standings, totalPairs, type Comparison } from '../lib/ranking'

interface Props {
  comps: Comparison[]
  prompt: string
  onContinue: (prompt: string) => void
  onReset: () => void
  onBrowse: () => void
}

export function Results({ comps, prompt, onContinue, onReset, onBrowse }: Props) {
  const rows = standings(ARM_IDS, comps)
  const [open, setOpen] = useState<string | null>(rows[0]?.arm ?? null)
  const max = rows[0]?.score ?? 1
  const others = PROMPT_ORDER.filter((p) => p !== prompt)

  if (comps.length === 0) {
    return (
      <main className="page narrow">
        <h1>No picks yet</h1>
        <p className="muted">The ranking appears after your first pick.</p>
        <div className="actions">
          <button className="primary big" onClick={() => onContinue(prompt)}>Start the test</button>
          <button className="big" onClick={onBrowse}>Browse all answers</button>
        </div>
      </main>
    )
  }

  return (
    <main className="page narrow">
      <h1>Your results</h1>
      <p className="muted">
        {comps.length} picks in total. Score is a Bradley-Terry strength; the record is wins, ties, losses.
      </p>
      <ol className="ranking">
        {rows.map((r, i) => {
          const info = ARM_BY_ID.get(r.arm)!
          const isOpen = open === r.arm
          return (
            <li key={r.arm} className={isOpen ? 'open' : ''}>
              <button className="row" onClick={() => setOpen(isOpen ? null : r.arm)} aria-expanded={isOpen}>
                <span className="rank">{i + 1}</span>
                <span className="name">
                  {info.name} <span className={`chip ${KIND_CLASS[info.kind]}`}>{info.kind}</span>
                </span>
                <span className="record">{r.wins}-{r.ties}-{r.losses}</span>
                <span className="bar-wrap"><span className="bar-fill" style={{ width: `${(100 * r.score) / max}%` }} /></span>
                <span className="score">{r.score.toFixed(1)}</span>
              </button>
              {isOpen && (
                <div className="detail">
                  <p>{info.summary}</p>
                  <pre><code>{info.enable}</code></pre>
                  {info.link && <a href={info.link} target="_blank" rel="noreferrer">Source</a>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <div className="actions">
        <button className="primary" onClick={() => onContinue(prompt)}>
          More picks on "{PROMPTS[prompt].slice(0, 40)}…" ({gamesFor(comps, prompt)}/{totalPairs(ARM_IDS.length)} pairs)
        </button>
        {others.map((p) => (
          <button key={p} onClick={() => onContinue(p)}>
            {gamesFor(comps, p) === 0 ? 'Try the ' : 'Continue the '}
            {p === 'review' ? 'long review answers' : `"${PROMPTS[p].slice(0, 40)}…" answers`}
          </button>
        ))}
        <button onClick={onBrowse}>Browse all answers</button>
        <button className="link danger" onClick={onReset}>Reset my picks</button>
      </div>
      <HowItWorks />
    </main>
  )
}
