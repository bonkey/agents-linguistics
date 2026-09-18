import { useEffect, useState } from 'react'
import { Browse } from './components/Browse'
import { Compare, ROUND } from './components/Compare'
import { Landing } from './components/Landing'
import { Nav, type Phase } from './components/Nav'
import { Results } from './components/Results'
import { PROMPT_ORDER } from './data/samples'
import { gamesFor, type Comparison } from './lib/ranking'
import { clear, load, save } from './lib/storage'

const HASH: Record<Phase, string> = { landing: '', compare: '#compare', results: '#results', browse: '#browse' }

function phaseFromHash(hash: string): Phase {
  const found = (Object.keys(HASH) as Phase[]).find((p) => HASH[p] === hash && hash !== '')
  return found ?? 'landing'
}

export default function App() {
  const [comps, setComps] = useState<Comparison[]>(() => load().comps)
  const [prompt, setPrompt] = useState(PROMPT_ORDER[0])
  const [phase, setPhase] = useState<Phase>(() => phaseFromHash(window.location.hash))

  useEffect(() => save({ comps }), [comps])
  useEffect(() => window.scrollTo({ top: 0 }), [phase, comps.length])

  // The phase lives in the URL hash, so the browser's back button and a shared link both work.
  useEffect(() => {
    const want = HASH[phase]
    if (window.location.hash !== want) window.history.pushState(null, '', want || window.location.pathname)
  }, [phase])
  useEffect(() => {
    const onHash = () => setPhase(phaseFromHash(window.location.hash))
    window.addEventListener('popstate', onHash)
    return () => window.removeEventListener('popstate', onHash)
  }, [])

  const onPick = (c: Comparison) => {
    const next = [...comps, c]
    setComps(next)
    if (gamesFor(next, c.prompt) % ROUND === 0) setPhase('results')
  }

  const start = (p: string) => {
    setPrompt(p)
    setPhase('compare')
  }

  const reset = () => {
    if (!window.confirm('Delete all your picks in this browser?')) return
    clear()
    setComps([])
    setPhase('landing')
  }

  const nav = (p: Phase) => {
    if (p === 'results' && comps.length === 0) return
    setPhase(p)
  }

  let body
  switch (phase) {
    case 'compare':
      body = <Compare prompt={prompt} comps={comps} onPick={onPick} onResults={() => setPhase('results')} />
      break
    case 'results':
      body = <Results comps={comps} prompt={prompt} onContinue={start} onReset={reset} onBrowse={() => setPhase('browse')} />
      break
    case 'browse':
      body = <Browse />
      break
    default:
      body = <Landing onStart={() => start(prompt)} onBrowse={() => setPhase('browse')} resumable={comps.length > 0} />
  }

  return (
    <>
      <Nav phase={phase} picks={comps.length} onNav={nav} />
      {body}
    </>
  )
}
