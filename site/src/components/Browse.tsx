import { useEffect, useState } from 'react'
import { ARMS, ARM_BY_ID } from '../data/arms'
import { defaultQuestion, harnessLabel, resolve, samplesFor, type Question, type Sample } from '../data/samples'
import { Markdown } from './Markdown'
import { Prompt } from './Prompt'
import { QuestionPicker } from './QuestionPicker'

/** The question named by #browse/<project>/<prompt>, or the default one. */
function questionFromHash(): Question {
  const [, project, prompt] = window.location.hash.split('/')
  return { ...defaultQuestion(undefined, project), ...(prompt ? { prompt } : {}) }
}

/** Two independent panes. Each has its own style tabs and arrows. */
export function Browse() {
  const [question, setQuestionState] = useState<Question>(questionFromHash)
  const { project, prompt } = resolve(question)
  // The selection lives in the hash, so a link can point at one project and prompt.
  const setQuestion = (q: Question) => {
    setQuestionState(q)
    window.history.replaceState(null, '', `#browse/${q.project}/${q.prompt}`)
  }
  const [left, setLeft] = useState(0)
  const [right, setRight] = useState(1)
  const n = ARMS.length
  const stepLeft = (d: number) => setLeft((i) => (i + d + n) % n)
  const stepRight = (d: number) => setRight((i) => (i + d + n) % n)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const d = e.key === 'ArrowLeft' ? -1 : 1
      if (e.shiftKey) stepLeft(d)
      else stepRight(d)
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <main className="page browse">
      <p className="muted small project-line">
        <strong>{project.name}</strong> · {project.description} · {[project.category, ...project.tech].join(', ')} ·{' '}
        <a href={project.repo} target="_blank" rel="noreferrer">{project.ref}</a>
      </p>
      <QuestionPicker value={question} onChange={setQuestion} />
      <Prompt prompt={prompt} />

      <div className="pair browse-pair">
        <Column side="Left" index={left} question={{ project: project.id, prompt: prompt.id }} onSelect={setLeft} onStep={stepLeft} keyHint="Shift + arrow keys" />
        <Column side="Right" index={right} question={{ project: project.id, prompt: prompt.id }} onSelect={setRight} onStep={stepRight} keyHint="Arrow keys" />
      </div>
    </main>
  )
}

interface ColumnProps {
  side: string
  index: number
  question: Question
  onSelect: (i: number) => void
  onStep: (d: number) => void
  keyHint: string
}

function Column({ side, index, question, onSelect, onStep, keyHint }: ColumnProps) {
  const info = ARMS[index]
  const samples = samplesFor(question, info.id)
  const meta = (s: Sample) => `${samples.length > 1 ? `Run ${s.run} · ` : ''}${s.words} words · ${harnessLabel(s.harness)}`
  return (
    <div className="column">
      <div className="chips" role="tablist" aria-label={`${side} style`}>
        {ARMS.map((a, i) => (
          <button key={a.id} role="tab" aria-selected={i === index} className={`chip-tab${i === index ? ' active' : ''}`} onClick={() => onSelect(i)} title={a.summary}>
            {a.name}
          </button>
        ))}
      </div>
      <article className="pane scroll-pane">
        <div className="pane-head">
          <span>
            {info.name} <span className="chip">{info.kind}</span>
          </span>
          <span className="pager">
            <button className="arrow" onClick={() => onStep(-1)} aria-label={`${side}: previous style`} title={`${keyHint}: previous`}>←</button>
            <span className="muted small">{index + 1} / {ARMS.length}</span>
            <button className="arrow" onClick={() => onStep(1)} aria-label={`${side}: next style`} title={`${keyHint}: next`}>→</button>
          </span>
        </div>
        <div className="muted small pane-info">
          <p className="pane-summary">{ARM_BY_ID.get(info.id)!.summary}</p>
          {samples[0] && <div>{meta(samples[0])}</div>}
        </div>
        {samples.length === 0 && <p className="muted">No answer recorded for this prompt.</p>}
        {samples.map((s, i) => (
          <section key={s.id}>
            {i > 0 && <div className="muted small sample-meta">{meta(s)}</div>}
            <Markdown text={s.text} />
          </section>
        ))}
      </article>
    </div>
  )
}
