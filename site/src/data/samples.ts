import raw from './samples.json'

export interface Sample {
  id: string
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

export const PROMPTS: Record<string, string> = raw.prompts
export const SAMPLES: Sample[] = raw.samples

export function harnessLabel(h: Harness | null | undefined): string {
  if (!h) return 'harness unknown'
  return `${h.tool} ${h.version} · ${h.model} · effort ${h.effort}`
}

/** Prompt ids in the order the test uses them: short reads first. */
export const PROMPT_ORDER = ['short', 'review'].filter((p) => p in PROMPTS)

export function samplesFor(arm: string, prompt: string): Sample[] {
  return SAMPLES.filter((s) => s.arm === arm && s.prompt === prompt)
}

export function pickSample(arm: string, prompt: string, rng: () => number = Math.random): Sample | undefined {
  const xs = samplesFor(arm, prompt)
  return xs[Math.floor(rng() * xs.length)]
}
