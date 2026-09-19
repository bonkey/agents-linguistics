import { ARMS, type ArmInfo, type ArmKind } from '../data/arms'

const GROUPS: [ArmKind, string][] = [
  ['built-in', 'Built into Claude Code'],
  ['custom style', 'Custom style file'],
  ['plugin', 'Plugins'],
]

/** Splits arms into units that share a link, in the order of each unit's first arm. */
function units(arms: ArmInfo[]): ArmInfo[][] {
  const out: ArmInfo[][] = []
  for (const a of arms) {
    const unit = a.link ? out.find((u) => u[0].link === a.link) : undefined
    if (unit) unit.push(a)
    else out.push([a])
  }
  return out
}

function commonPrefix(names: string[]): string {
  let prefix = names[0]
  for (const n of names) while (!n.startsWith(prefix)) prefix = prefix.slice(0, -1)
  return prefix
}

function Source({ href }: { href?: string }) {
  return href ? <a href={href} target="_blank" rel="noreferrer">Source</a> : null
}

/** One link per destination: a unit of several arms shows its shared link once, under the common part of their names. */
function Unit({ arms }: { arms: ArmInfo[] }) {
  const prefix = arms.length > 1 ? commonPrefix(arms.map((a) => a.name)) : ''
  const title = prefix.replace(/[\s,:-]+$/, '')
  if (!title) {
    return arms.map((a, i) => (
      <div className="style-entry" key={a.id}>
        <h3>{a.name}</h3>
        <p>{a.summary} {i === arms.length - 1 && <Source href={a.link} />}</p>
      </div>
    ))
  }
  return (
    <div className="style-entry">
      <h3>{title}</h3>
      <p className="small"><Source href={arms[0].link} /></p>
      {arms.map((a) => {
        const variant = a.name.slice(prefix.length)
        return (
          <div className="style-variant" key={a.id}>
            <h4>{variant.charAt(0).toUpperCase() + variant.slice(1)}</h4>
            <p>{a.summary}</p>
          </div>
        )
      })}
    </div>
  )
}

export function Styles() {
  return (
    <main className="page narrow">
      <h1>The styles in the test</h1>
      <p className="muted">
        Five ship with Claude Code, one is a custom style file, and four come from plugins that inject their rules at
        session start. In the test they are all anonymous.
      </p>
      {GROUPS.map(([kind, title]) => {
        const arms = ARMS.filter((a) => a.kind === kind)
        if (arms.length === 0) return null
        const us = units(arms)
        // When every arm of the kind shares one link, the link belongs to the group heading.
        const shared = us.length === 1 && arms.length > 1
        return (
          <section className="style-group" key={kind}>
            <h2>{title}</h2>
            {shared && <p className="small"><Source href={arms[0].link} /></p>}
            {shared
              ? arms.map((a) => (
                  <div className="style-entry" key={a.id}>
                    <h3>{a.name}</h3>
                    <p>{a.summary}</p>
                  </div>
                ))
              : us.map((u) => <Unit arms={u} key={u[0].id} />)}
          </section>
        )
      })}
    </main>
  )
}
