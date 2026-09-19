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
  // The ranking follows one question, or pools every question when the scope is "all".
  // Default to the question just played; fall back to the pool if it has no picks yet.
  const [scope, setScope] = useState<'all' | Question>(() =>
    gamesFor(comps, question.project, question.prompt) > 0 ? question : 'all',
  )
  const target = scope === 'all' ? question : scope
  const { project, prompt } = resolve(target)
  const scoped = scope === 'all' ? comps : comps.filter((c) => c.project === scope.project && c.prompt === scope.prompt)
  const rows = standings(ARM_IDS, scoped)
  const [open, setOpen] = useState<string | null>(rows[0]?.arm ?? null)
  const max = rows[0]?.score ?? 1
  const played = gamesFor(comps, project.id, prompt.id)

  if (comps.length === 0) {
    return (
      <main className="page narrow">
        <h1>No picks yet</h1>
        <p className="muted">The ranking appears after your first pick.</p>
        <div className="actions">
          <button className="primary big" onClick={() => onContinue(question)}>Find your style</button>
          <button className="big" onClick={onBrowse}>Browse all answers</button>
        </div>
      </main>
    )
  }

  return (
    <main className="page narrow">
      <h1>Your results</h1>
      <p className="muted">
        {scope === 'all'
          ? `${scoped.length} picks across every question.`
          : `${scoped.length} picks on ${promptLabel(project, prompt)}.`}{' '}
        Record is wins-ties-losses; score is a Bradley-Terry strength.
      </p>

      <div className="scope">
        <QuestionPicker
          value={target}
          onChange={setScope}
          leading={{ label: 'All questions', selected: scope === 'all', onSelect: () => setScope('all') }}
        />
        {scope !== 'all' && <p className="muted small scope-prompt">{prompt.text}</p>}
      </div>
      <div className="ranking-head" aria-hidden="true">
        <span />
        <span>Style</span>
        <span className="record">Record</span>
        <span className="bar-col" />
        <span className="score">Score</span>
      </div>
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
                <span className="bar-wrap"><span className="bar-fill" style={{ width: `${(100 * r.score) / max}%`, minWidth: r.score > 0 ? 3 : 0 }} /></span>
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
        <button className="primary" onClick={() => onContinue(target)}>
          {played === 0 ? 'Start' : 'More'} picks on {promptLabel(project, prompt)} ({played}/{totalPairs(ARM_IDS.length)} pairs)
        </button>
        <button onClick={onBrowse}>Browse all answers</button>
        <button className="link danger" onClick={onReset}>Reset my picks</button>
      </div>

      <HowItWorks />
    </main>
  )
}
