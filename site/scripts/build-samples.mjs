// Turns ../eval/outputs/<project>/<prompt>/<family>/<arm>.json into src/data/samples.json.
// Projects, prompt kinds and prompt texts come from ../eval/projects.json; see assemble.mjs for what is shipped.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assemble } from './assemble.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const evalDir = join(here, '..', '..', 'eval')
const out = join(here, '..', 'src', 'data', 'samples.json')

const projectsFile = JSON.parse(readFileSync(join(evalDir, 'projects.json'), 'utf8'))
const records = []
for (const project of projectsFile.projects) {
  for (const { id: prompt } of project.prompts) {
    const dir = join(evalDir, 'outputs', project.id, prompt)
    if (!existsSync(dir)) continue
    for (const path of readdirSync(dir, { recursive: true })) {
      // <arm>.json, or <arm>--<run>.json for a repeat run
      const m = /^([a-z0-9-]+?)(?:--(\d+))?\.json$/.exec(basename(path))
      if (!m) continue
      let json
      try {
        json = JSON.parse(readFileSync(join(dir, path), 'utf8'))
      } catch {
        // A file that is still being written is not an answer yet.
        console.warn(`skipped, not valid JSON: ${join(dir, path)}`)
        continue
      }
      records.push({ project: project.id, prompt, arm: m[1], run: m[2] ? Number(m[2]) : 1, json })
    }
  }
}

// Optional metadata for arms that are not in the site's built-in list (src/data/arms.ts):
// eval/arms.json = { "<arm>": { "name", "kind", "summary", "enable", "link" } }
const armsFile = join(evalDir, 'arms.json')
const arms = existsSync(armsFile) ? JSON.parse(readFileSync(armsFile, 'utf8')) : {}

const data = assemble(projectsFile, records, arms)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(data, null, 1))
console.log(`wrote ${data.samples.length} samples, ${data.projects.length} projects -> ${out}`)
