// Turns ../bakeoff/<arm>--<prompt>.json into src/data/samples.json.
// Each sample keeps only what the site needs: arm, prompt, the answer text.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bakeoff = join(here, '..', '..', 'bakeoff')
const out = join(here, '..', 'src', 'data', 'samples.json')

const prompts = {}
for (const f of readdirSync(join(bakeoff, 'prompts'))) {
  if (!f.endsWith('.md') || f === 'probe.md') continue
  prompts[f.replace(/\.md$/, '')] = readFileSync(join(bakeoff, 'prompts', f), 'utf8').trim()
}

const samples = []
for (const f of readdirSync(bakeoff).sort()) {
  const m = /^([a-z0-9-]+)--([a-z0-9-]+)(?:--(\d+))?\.json$/.exec(f)
  if (!m) continue
  const j = JSON.parse(readFileSync(join(bakeoff, f), 'utf8'))
  if (j.is_error || typeof j.result !== 'string') continue
  samples.push({
    id: f.replace(/\.json$/, ''),
    arm: m[1],
    prompt: m[2],
    run: m[3] ? Number(m[3]) : 1,
    text: j.result,
    words: j.result.split(/\s+/).filter(Boolean).length,
    harness: j.bakeoff?.harness ?? null,
  })
}

// Optional metadata for arms that are not in the site's built-in list (src/data/arms.ts):
// bakeoff/arms.json = { "<arm>": { "name", "kind", "summary", "enable", "link" } }
const armsFile = join(bakeoff, 'arms.json')
const arms = existsSync(armsFile) ? JSON.parse(readFileSync(armsFile, 'utf8')) : {}

const harnesses = [...new Map(samples.filter((s) => s.harness).map((s) => [JSON.stringify(s.harness), s.harness])).values()]

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ prompts, arms, harnesses, samples }, null, 1))
console.log(`wrote ${samples.length} samples, ${Object.keys(prompts).length} prompts -> ${out}`)
