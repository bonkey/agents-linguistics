import { ARMS } from '../data/arms'

export const KIND_CLASS: Record<string, string> = { 'built-in': 'k-builtin', 'custom style': 'k-custom', plugin: 'k-plugin' }

export function Landing({ onStart, onBrowse, resumable }: { onStart: () => void; onBrowse: () => void; resumable: boolean }) {
  const startLabel = resumable ? 'Continue the test' : 'Start the test'

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">{ARMS.length} output styles · same questions · same codebase</p>
        <h1>
          Ten ways Claude can talk.<br />
          <em>Which one do you want to read?</em>
        </h1>
        <p className="lead">
          An output style changes how Claude Code answers, not what it knows. Pick the answers you would rather
          read, and after ten picks you get your own ranking and the line that switches the winner on.
        </p>
        <div className="actions">
          <button className="primary big" onClick={onStart}>{startLabel}</button>
          <button className="big" onClick={onBrowse}>Browse all answers</button>
        </div>
        <p className="muted small">Ten picks take a few minutes. Your picks stay in this browser and go nowhere else.</p>
      </section>
    </main>
  )
}
