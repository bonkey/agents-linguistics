import { PROJECTS, defaultQuestion, promptLabel, promptsOf, resolve, type Project, type Question } from '../data/samples'

interface Props {
  value: Question
  onChange: (q: Question) => void
  projects?: Project[]
  /** An extra leading option such as "All questions", when the picker chooses a scope rather than a test. */
  leading?: { label: string; selected: boolean; onSelect: () => void }
}

/** Project selector, shown when there is more than one project, and the prompt tabs of the selected project. */
export function QuestionPicker({ value, onChange, projects = PROJECTS, leading }: Props) {
  const { project, prompt } = resolve(value, projects)
  const active = (id: string) => !leading?.selected && id === prompt.id
  return (
    <div className="tabs" role="tablist" aria-label="Prompt">
      {leading && (
        <button role="tab" aria-selected={leading.selected} className={`tab${leading.selected ? ' active' : ''}`} onClick={leading.onSelect}>
          {leading.label}
        </button>
      )}
      {projects.length > 1 && (
        <select aria-label="Project" value={project.id} onChange={(e) => onChange(defaultQuestion(projects, e.target.value))}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {promptsOf(project).map((p) => (
        <button key={p.id} role="tab" aria-selected={active(p.id)} className={`tab${active(p.id) ? ' active' : ''}`} onClick={() => onChange({ project: project.id, prompt: p.id })}>
          {promptLabel(project, p)}
        </button>
      ))}
    </div>
  )
}
