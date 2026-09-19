import { useState } from 'react'
import { ARM_BY_ID, ARM_IDS } from '../data/arms'
import { HowItWorks } from './HowItWorks'
import { QuestionPicker } from './QuestionPicker'
import { promptLabel, resolve, type Question } from '../data/samples'
import { gamesFor, standings, totalPairs, type Comparison } from '../lib/ranking'

interface Props {
  comps: Comparison[]
  question: Question
  onContinue: (q: Question) => void
  onReset: () => void
  onBrowse: () => void
}

export function Results({ comps, question, onContinue, onReset, onBrowse }: Props) {
  const rows = standings(ARM_IDS, comps)
  const [open, setOpen] = useState<string | null>(rows[0]?.arm ?? null)
  const max = rows[0]?.score ?? 1
  const { project, prompt } = resolve(question)

  if (comps.length === 0) {
    return (
      <main className="page narrow">
        <h1>No picks yet</h1>
        <p className="muted">The ranking appears after your first pick.</p>
        <div className="actions">
          <button className="primary big" onClick={() => onContinue(question)}>Start the test</button>
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
                  {info.name} <span className="chip">{info.kind}</span>
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
        <button className="primary" onClick={() => onContinue(question)}>
          More picks on {promptLabel(project, prompt)} ({gamesFor(comps, project.id, prompt.id)}/{totalPairs(ARM_IDS.length)} pairs)
        </button>
        <button onClick={onBrowse}>Browse all answers</button>
        <button className="link danger" onClick={onReset}>Reset my picks</button>
      </div>
      <p className="muted small pick-another">Or pick another question:</p>
      <QuestionPicker value={question} onChange={onContinue} />
      <p className="muted small">{prompt.text}</p>
      <HowItWorks />
    </main>
  )
}
