import raw from './samples.json'

export type ArmKind = 'built-in' | 'custom style' | 'plugin'

export interface ArmInfo {
  id: string
  name: string
  kind: ArmKind
  summary: string
  /** How to switch it on, as the user would type or configure it. */
  enable: string
  link?: string
}

const BUILT_IN: ArmInfo[] = [
  {
    id: 'default',
    name: 'Default',
    kind: 'built-in',
    summary: "Claude Code's standard instructions. The baseline every other arm changes.",
    enable: '"outputStyle" unset, or "Default" in .claude/settings.local.json',
    link: 'https://code.claude.com/docs/en/output-styles',
  },
  {
    id: 'concise',
    name: 'Concise',
    kind: 'built-in',
    summary: 'Result first, no preamble, short by default. Explains in full when asked.',
    enable: '{ "outputStyle": "Concise" }',
    link: 'https://code.claude.com/docs/en/output-styles',
  },
  {
    id: 'proactive',
    name: 'Proactive',
    kind: 'built-in',
    summary: 'Acts at once, assumes instead of asking, prefers action over planning.',
    enable: '{ "outputStyle": "Proactive" }',
    link: 'https://code.claude.com/docs/en/output-styles',
  },
  {
    id: 'explanatory',
    name: 'Explanatory',
    kind: 'built-in',
    summary: 'Adds educational "Insights" between the work. Longer by design.',
    enable: '{ "outputStyle": "Explanatory" }',
    link: 'https://code.claude.com/docs/en/output-styles',
  },
  {
    id: 'learning',
    name: 'Learning',
    kind: 'built-in',
    summary: 'Insights plus TODO(human) markers: it asks you to write small pieces yourself.',
    enable: '{ "outputStyle": "Learning" }',
    link: 'https://code.claude.com/docs/en/output-styles',
  },
  {
    id: 'ste-concise',
    name: 'STE Concise',
    kind: 'custom style',
    summary: 'Result first, in ASD-STE100 Simplified Technical English: one meaning per word, short active sentences, no preamble, no recap.',
    enable: 'claude plugin marketplace add bonkey/agents-output-styles\nclaude plugin install agents-output-styles@bonkey\n{ "outputStyle": "agents-output-styles:STE Concise" }',
    link: 'https://github.com/bonkey/agents-output-styles',
  },
  {
    id: 'caveman-lite',
    name: 'Caveman, lite',
    kind: 'plugin',
    summary: 'Drops filler and pleasantries, keeps full sentences. The mildest caveman level.',
    enable: 'claude plugin marketplace add JuliusBrussee/caveman\nclaude plugin install caveman@caveman\nCAVEMAN_DEFAULT_MODE=lite',
    link: 'https://github.com/JuliusBrussee/caveman',
  },
  {
    id: 'caveman-full',
    name: 'Caveman, full',
    kind: 'plugin',
    summary: 'Terse fragments, no articles, technical terms exact. The plugin default.',
    enable: 'claude plugin marketplace add JuliusBrussee/caveman\nclaude plugin install caveman@caveman',
    link: 'https://github.com/JuliusBrussee/caveman',
  },
  {
    id: 'caveman-ultra',
    name: 'Caveman, ultra',
    kind: 'plugin',
    summary: 'Maximum compression. Every word has to earn its place.',
    enable: 'claude plugin marketplace add JuliusBrussee/caveman\nclaude plugin install caveman@caveman\nCAVEMAN_DEFAULT_MODE=ultra',
    link: 'https://github.com/JuliusBrussee/caveman',
  },
  {
    id: 'i-have-adhd',
    name: 'I have ADHD',
    kind: 'plugin',
    summary: 'Leads with the next action, numbers steps, restates state every turn, suppresses tangents.',
    enable: 'claude plugin marketplace add ayghri/i-have-adhd\nclaude plugin install i-have-adhd@i-have-adhd\ntouch ~/.claude/.i-have-adhd-always',
    link: 'https://github.com/ayghri/i-have-adhd',
  },
]

const KINDS: ArmKind[] = ['built-in', 'custom style', 'plugin']

/** Arms from bakeoff/arms.json, then any arm that has samples but no metadata at all. */
function extras(): ArmInfo[] {
  const known = new Set(BUILT_IN.map((a) => a.id))
  const meta = (raw as { arms?: Record<string, Partial<ArmInfo>> }).arms ?? {}
  const out: ArmInfo[] = []
  for (const [id, m] of Object.entries(meta)) {
    if (known.has(id)) continue
    out.push({
      id,
      name: m.name ?? id,
      kind: KINDS.includes(m.kind as ArmKind) ? (m.kind as ArmKind) : 'custom style',
      summary: m.summary ?? '',
      enable: m.enable ?? '',
      link: m.link,
    })
    known.add(id)
  }
  for (const s of (raw as { samples: { arm: string }[] }).samples) {
    if (known.has(s.arm)) continue
    out.push({ id: s.arm, name: s.arm, kind: 'custom style', summary: 'Added with ./run.sh arm. No description yet.', enable: '' })
    known.add(s.arm)
  }
  return out
}

export const ARMS: ArmInfo[] = [...BUILT_IN, ...extras()]
export const ARM_IDS = ARMS.map((a) => a.id)
export const ARM_BY_ID = new Map(ARMS.map((a) => [a.id, a]))
