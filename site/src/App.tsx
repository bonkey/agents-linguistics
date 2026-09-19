import { useEffect, useState } from 'react'
import { Browse } from './components/Browse'
import { Compare, ROUND } from './components/Compare'
import { Landing } from './components/Landing'
import { Nav, type Phase } from './components/Nav'
import { Results } from './components/Results'
import { Styles } from './components/Styles'
import { defaultQuestion, type Question } from './data/samples'
import { gamesFor, type Comparison } from './lib/ranking'
import { clear, load, save } from './lib/storage'

const HASH: Record<Phase, string> = { landing: '', compare: '#compare', results: '#results', browse: '#browse', styles: '#styles' }

/** The view part of a hash such as #browse/<project>/<prompt>. */
const view = (hash: string) => hash.split('/')[0]

function phaseFromHash(hash: string): Phase {
  const found = (Object.keys(HASH) as Phase[]).find((p) => HASH[p] === view(hash) && hash !== '')
  return found ?? 'landing'
}

export default function App() {
  const [comps, setComps] = useState<Comparison[]>(() => load().comps)
  const [question, setQuestion] = useState<Question>(() => defaultQuestion())
  const [phase, setPhase] = useState<Phase>(() => phaseFromHash(window.location.hash))

  useEffect(() => save({ comps }), [comps])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [phase, comps.length])

  // The phase lives in the URL hash, so the browser's back button and a shared link both work.
  useEffect(() => {
    const want = HASH[phase]
    if (view(window.location.hash) !== want) window.history.pushState(null, '', want || window.location.pathname)
  }, [phase])
  useEffect(() => {
    const onHash = () => setPhase(phaseFromHash(window.location.hash))
    window.addEventListener('popstate', onHash)
    return () => window.removeEventListener('popstate', onHash)
  }, [])

  const onPick = (c: Comparison) => {
    const next = [...comps, c]
    setComps(next)
    if (gamesFor(next, c.project, c.prompt) % ROUND === 0) setPhase('results')
  }

  const start = (q: Question) => {
    setQuestion(q)
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
      body = <Compare question={question} comps={comps} onPick={onPick} onResults={() => setPhase('results')} />
      break
    case 'results':
      body = <Results comps={comps} question={question} onContinue={start} onReset={reset} onBrowse={() => setPhase('browse')} />
      break
    case 'browse':
      body = <Browse />
      break
    case 'styles':
      body = <Styles />
      break
    default:
      body = <Landing onStart={() => start(question)} onBrowse={() => setPhase('browse')} resumable={comps.length > 0} />
  }

  return (
    <>
      <Nav phase={phase} picks={comps.length} onNav={nav} />
      {body}
    </>
  )
}
