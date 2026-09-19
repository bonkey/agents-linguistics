// The content of src/data/samples.json, from eval/projects.json and the recorded answers.

/**
 * @param projectsFile parsed eval/projects.json
 * @param records one per answer file: { project, prompt, arm, run, json }
 * @param arms parsed eval/arms.json, or {}
 * Ships only projects that have an answer, and of those only the prompts that have one,
 * both in projects.json order.
 */
export function assemble(projectsFile, records, arms = {}) {
  const samples = []
  const projects = []
  for (const p of projectsFile.projects) {
    const prompts = []
    for (const prompt of p.prompts) {
      const found = records.filter((r) => r.project === p.id && r.prompt === prompt.id && !r.json.is_error && typeof r.json.result === 'string')
      if (found.length === 0) continue
      prompts.push({ id: prompt.id, kind: prompt.kind, text: prompt.text.trim(), ...(prompt.target ? { target: prompt.target } : {}) })
      for (const r of found) {
        samples.push({
          id: `${p.id}--${prompt.id}--${r.arm}${r.run > 1 ? `--${r.run}` : ''}`,
          project: p.id,
          arm: r.arm,
          prompt: prompt.id,
          run: r.run,
          text: r.json.result,
          words: r.json.result.split(/\s+/).filter(Boolean).length,
          harness: r.json.eval?.harness ?? null,
        })
      }
    }
    if (prompts.length === 0) continue
    projects.push({ id: p.id, name: p.name, description: p.description, category: p.category, tech: p.tech, repo: p.repo, ref: p.ref, prompts })
  }
  samples.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const harnesses = [...new Map(samples.filter((s) => s.harness).map((s) => [JSON.stringify(s.harness), s.harness])).values()]
  return { prompt_kinds: projectsFile.prompt_kinds ?? {}, projects, arms, harnesses, samples }
}
