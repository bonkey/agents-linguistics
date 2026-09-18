export type Phase = 'landing' | 'compare' | 'results' | 'browse'

interface Props {
  phase: Phase
  picks: number
  onNav: (p: Phase) => void
}

export function Nav({ phase, picks, onNav }: Props) {
  const item = (p: Phase, label: string) => (
    <button className={`nav-item${phase === p ? ' active' : ''}`} onClick={() => onNav(p)} aria-current={phase === p ? 'page' : undefined}>
      {label}
    </button>
  )
  return (
    <nav className="nav">
      <button className="wordmark" onClick={() => onNav('landing')} aria-label="Home">
        <span className="dot" /> Agents linguistics
      </button>
      <div className="nav-items">
        {item('compare', picks ? 'Continue' : 'Start')}
        {picks > 0 && item('results', `Your results · ${picks}`)}
        {item('browse', 'Browse')}
      </div>
    </nav>
  )
}
