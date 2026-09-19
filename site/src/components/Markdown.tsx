import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components: Components = {
  code({ children, node, ...props }) {
    const text = String(children)
    // Claude's terminal-style insight rules are decoration, not source code.
    // Fenced code includes a newline and should always render verbatim.
    if (!text.includes('\n')) {
      if (/^★ Insight ─+$/.test(text)) {
        return <span className="insight-title">★ Insight</span>
      }
      if (/^─+$/.test(text)) return null
    }
    return <code {...props}>{children}</code>
  },
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
    </div>
  )
}
