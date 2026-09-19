import { PROJECTS, defaultQuestion, promptLabel, promptsOf, resolve, type Project, type Question } from '../data/samples'

interface Props {
  value: Question
  onChange: (q: Question) => void
  projects?: Project[]
}

/** Project selector, shown when there is more than one project, and the prompt tabs of the selected project. */
export function QuestionPicker({ value, onChange, projects = PROJECTS }: Props) {
  const { project, prompt } = resolve(value, projects)
  return (
    <div className="tabs" role="tablist" aria-label="Prompt">
      {projects.length > 1 && (
        <select aria-label="Project" value={project.id} onChange={(e) => onChange(defaultQuestion(projects, e.target.value))}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {promptsOf(project).map((p) => (
        <button key={p.id} role="tab" aria-selected={p.id === prompt.id} className={`tab${p.id === prompt.id ? ' active' : ''}`} onClick={() => onChange({ project: project.id, prompt: p.id })}>
          {promptLabel(project, p)}
        </button>
      ))}
    </div>
  )
}
