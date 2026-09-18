import { ARMS } from '../data/arms'
import { HARNESSES, PROMPTS, harnessLabel, samplesFor } from '../data/samples'

const EXAMPLE_ARMS = ['explanatory', 'default', 'caveman-ultra']
const EXAMPLE_WORDS = 42

function excerpt(text: string, words = EXAMPLE_WORDS): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const xs = plain.split(' ')
  return xs.length > words ? xs.slice(0, words).join(' ') + ' …' : plain
}

export const KIND_CLASS: Record<string, string> = { 'built-in': 'k-builtin', 'custom style': 'k-custom', plugin: 'k-plugin' }

export function Landing({ onStart, onBrowse, resumable }: { onStart: () => void; onBrowse: () => void; resumable: boolean }) {
  const examples = EXAMPLE_ARMS
    .map((id) => ({ info: ARMS.find((a) => a.id === id)!, sample: samplesFor(id, 'short')[0] }))
    .filter((e) => e.info && e.sample)
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
          An output style changes how Claude Code answers, not what it knows. The same model answered the same
          questions about the same project under each style. Here you see two answers at a time, names hidden, and you pick the one you would rather read.
          After ten picks the names come out. After ten picks you get your own ranking and the line that
          switches the winner on.
        </p>
        <div className="actions">
          <button className="primary big" onClick={onStart}>{startLabel}</button>
          <button className="big" onClick={onBrowse}>Browse all answers</button>
        </div>
        <p className="muted small">Ten picks take a few minutes. Your picks stay in this browser and go nowhere else.</p>
        <p className="muted small harness">
          Every answer was produced with {HARNESSES.map((h) => harnessLabel(h)).join('; ')}. The harness, model and effort are shown on every answer.
        </p>
      </section>

      {examples.length > 0 && (
        <section className="section">
          <h2>Same question, three answers</h2>
          <p className="muted">The short question every style got: <strong>{PROMPTS.short}</strong></p>
          <div className="example-grid">
            {examples.map(({ info, sample }) => (
              <article className="card" key={info.id}>
                <div className="card-head">
                  <span className={`chip ${KIND_CLASS[info.kind]}`}>{info.kind}</span>
                  <span className="muted small">{sample.words} words</span>
                </div>
                <p className="excerpt">{excerpt(sample.text)}</p>
                <div className="card-foot">{info.name}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>The styles in the test</h2>
        <p className="muted">
          Five ship with Claude Code, one is a custom style file, and four come from plugins that inject their rules at
          session start. In the test they are all anonymous.
        </p>
        <ul className="style-grid">
          {ARMS.map((a) => (
            <li className="card" key={a.id}>
              <div className="card-head">
                <strong>{a.name}</strong>
                <span className={`chip ${KIND_CLASS[a.kind]}`}>{a.kind}</span>
              </div>
              <p className="small">{a.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>How the ranking works</h2>
        <ol className="steps">
          <li>You see two answers to the same question, labelled A and B. Names stay hidden.</li>
          <li>You pick the one you would rather read, or say you have no preference.</li>
          <li>The next pair is chosen so that every pick carries information: the style with the fewest picks meets the one closest to it in score.</li>
          <li>After ten picks the names come out, with a Bradley-Terry score from your picks. Keep going on the short answers, or switch to the long review answers to test structure.</li>
        </ol>
        <div className="actions">
          <button className="primary big" onClick={onStart}>{startLabel}</button>
        </div>
      </section>

      <section className="section">
        <h2>Test your own style</h2>
        <p className="muted">
          Every answer here comes from one command. The same command takes your own style file, any plugin folder, or
          an installed plugin, runs the same prompts against the same codebase, and adds the result as a new style in
          this site.
        </p>
        <pre className="recipe">{`git clone https://github.com/bonkey/agents-linguistics && cd agents-linguistics/bakeoff

# your own style file
./run.sh arm my-style --style-file ~/.claude/output-styles/my-style.md

# a plugin folder, with the style it ships
./run.sh arm my-plugin --plugin-dir ~/src/my-plugin --style "my-plugin:My Style"

# a plugin that injects rules by hook, no style name needed
./run.sh arm other-plugin --plugin-dir ~/src/other-plugin

cd ../site && pnpm install && pnpm data && pnpm dev`}</pre>
        <p className="muted small">
          Each run answers the two prompts in an isolated session with every other plugin off. Add a name and a
          summary for the new style in <code>bakeoff/arms.json</code>, or leave it and the site lists it by its id.
        </p>
      </section>
    </main>
  )
}
