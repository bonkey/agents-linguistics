import { useEffect, useState } from 'react'
import { ARMS, ARM_BY_ID } from '../data/arms'
import { PROMPTS, PROMPT_ORDER, harnessLabel, samplesFor } from '../data/samples'
import { KIND_CLASS } from './Landing'
import { Markdown } from './Markdown'

const PROMPT_LABEL: Record<string, string> = { short: 'Short question', review: 'Long review' }

/** Two independent panes. Each has its own style tabs and arrows. */
export function Browse() {
  const [prompt, setPrompt] = useState(PROMPT_ORDER[0])
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
      <div className="tabs" role="tablist" aria-label="Prompt">
        {PROMPT_ORDER.map((p) => (
          <button key={p} role="tab" aria-selected={prompt === p} className={`tab${prompt === p ? ' active' : ''}`} onClick={() => setPrompt(p)}>
            {PROMPT_LABEL[p] ?? p}
          </button>
        ))}
        <span className="muted small tabs-note">{PROMPTS[prompt]}</span>
      </div>

      <div className="pair browse-pair">
        <Column side="Left" index={left} prompt={prompt} onSelect={setLeft} onStep={stepLeft} keyHint="Shift + arrow keys" />
        <Column side="Right" index={right} prompt={prompt} onSelect={setRight} onStep={stepRight} keyHint="Arrow keys" />
      </div>
    </main>
  )
}

interface ColumnProps {
  side: string
  index: number
  prompt: string
  onSelect: (i: number) => void
  onStep: (d: number) => void
  keyHint: string
}

function Column({ side, index, prompt, onSelect, onStep, keyHint }: ColumnProps) {
  const info = ARMS[index]
  const samples = samplesFor(info.id, prompt)
  return (
    <div className="column">
      <div className="chips" role="tablist" aria-label={`${side} style`}>
        {ARMS.map((a, i) => (
          <button key={a.id} role="tab" aria-selected={i === index} className={`chip-tab ${KIND_CLASS[a.kind]}${i === index ? ' active' : ''}`} onClick={() => onSelect(i)} title={a.summary}>
            {a.name}
          </button>
        ))}
      </div>
      <article className="pane scroll-pane">
        <div className="pane-head">
          <span>
            {info.name} <span className={`chip ${KIND_CLASS[info.kind]}`}>{info.kind}</span>
          </span>
          <span className="pager">
            <button className="arrow" onClick={() => onStep(-1)} aria-label={`${side}: previous style`} title={`${keyHint}: previous`}>←</button>
            <span className="muted small">{index + 1} / {ARMS.length}</span>
            <button className="arrow" onClick={() => onStep(1)} aria-label={`${side}: next style`} title={`${keyHint}: next`}>→</button>
          </span>
        </div>
        <p className="muted small pane-summary">{ARM_BY_ID.get(info.id)!.summary}</p>
        {samples.length === 0 && <p className="muted">No answer recorded for this prompt.</p>}
        {samples.map((s) => (
          <section key={s.id}>
            <div className="muted small">{samples.length > 1 ? `Run ${s.run} · ` : ''}{s.words} words · {harnessLabel(s.harness)}</div>
            <Markdown text={s.text} />
          </section>
        ))}
      </article>
    </div>
  )
}
