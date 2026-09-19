import raw from './samples.json'

export interface Sample {
  id: string
  project: string
  arm: string
  prompt: string
  run: number
  text: string
  words: number
  harness: Harness | null
}

export interface Harness {
  tool: string
  version: string
  model: string
  effort: string
}

export interface Prompt {
  id: string
  kind: string
  text: string
  /** What the prompt is about. Its keys depend on the kind; only `pr` is read here, for the tab label. */
  target?: { pr?: number; [key: string]: unknown }
}

export interface Project {
  id: string
  name: string
  description: string
  category: string
  tech: string[]
  repo: string
  ref: string
  prompts: Prompt[]
}

/** One prompt of one project: what a pair of answers, or a browse tab, is about. */
export interface Question {
  project: string
  prompt: string
}

// samples.json is generated, so its shape is checked by a test, not by the type the compiler infers from the file.
export const PROJECTS = raw.projects as unknown as Project[]
export const SAMPLES: Sample[] = raw.samples

const KIND_LABEL: Record<string, string> = {
  short: 'Short question',
  'review-project': 'Project review',
  'review-pr': 'PR review',
  'find-issues': 'Find issues',
  'critique-readme': 'README critique',
}

/** Prompts in the order the site shows them: short questions first, then projects.json order. */
export function promptsOf(project: Project): Prompt[] {
  return [...project.prompts].sort((a, b) => Number(b.kind === 'short') - Number(a.kind === 'short'))
}

/** Tab label from the prompt's kind. Prompts that share a kind within a project also show their target or id. */
export function promptLabel(project: Project, prompt: Prompt): string {
  const label = KIND_LABEL[prompt.kind] ?? prompt.id
  if (project.prompts.filter((p) => p.kind === prompt.kind).length < 2) return label
  return prompt.target?.pr ? `${label} #${prompt.target.pr}` : `${label}: ${prompt.id}`
}

/** The first question of a project, or of the first project when the id names none. */
export function defaultQuestion(projects: Project[] = PROJECTS, projectId?: string): Question {
  const project = projects.find((p) => p.id === projectId) ?? projects[0]
  return { project: project.id, prompt: promptsOf(project)[0].id }
}

/** The project and prompt a question names, falling back to the default question for ids that name nothing. */
export function resolve(q: Question, projects: Project[] = PROJECTS): { project: Project; prompt: Prompt } {
  const project = projects.find((p) => p.id === q.project) ?? projects[0]
  const prompt = project.prompts.find((p) => p.id === q.prompt) ?? promptsOf(project)[0]
  return { project, prompt }
}

export function harnessLabel(h: Harness | null | undefined): string {
  if (!h) return 'harness unknown'
  return `${h.tool} ${h.version} · ${h.model} · effort ${h.effort}`
}

export function samplesFor(q: Question, arm: string): Sample[] {
  return SAMPLES.filter((s) => s.project === q.project && s.prompt === q.prompt && s.arm === arm)
}

export function pickSample(q: Question, arm: string, rng: () => number = Math.random): Sample | undefined {
  const xs = samplesFor(q, arm)
  return xs[Math.floor(rng() * xs.length)]
}
