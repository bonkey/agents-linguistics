import type { Prompt as PromptData } from '../data/samples'

/** The question the answers respond to. A target url that the text mentions becomes a link. */
export function Prompt({ prompt, label = 'Prompt' }: { prompt: PromptData; label?: string }) {
  const url = typeof prompt.target?.url === 'string' && prompt.target.url.startsWith('https://') ? prompt.target.url : ''
  const at = url ? prompt.text.indexOf(url) : -1
  return (
    <p className="prompt">
      <span className="prompt-label">{label}</span>
      <span className="prompt-line">
        <span className="prompt-marker" aria-hidden="true">&gt;</span>
        <span className="prompt-text">
          {at < 0 ? prompt.text : (
            <>
              {prompt.text.slice(0, at)}
              <a href={url} target="_blank" rel="noreferrer">{url}</a>
              {prompt.text.slice(at + url.length)}
            </>
          )}
          <span className="prompt-cursor" aria-hidden="true" />
        </span>
      </span>
    </p>
  )
}
