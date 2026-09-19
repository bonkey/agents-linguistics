# i-have-adhd / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `i-have-adhd`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 9  wall: 175s  api: 102s
- cost: $1.0021  output tokens: 8291  words: 770

---

**Audit done. No files were modified.** Make Edit 1 first: add a `## Development` section above `## Contributing` (`README.md:97`). Missing local setup is the biggest gap for a contributor. All three edits take about 15 minutes.

## Missing
1. **No local setup.** `README.md:85` only links to the external Development Guide, so you can't get from clone to a running app using the README alone.
2. **No prerequisites.** `package.json` requires Node `>=18` and pins `yarn@1.22.22`. CI runs Node 20.x, the Dockerfile uses Node 24, and there is no `.nvmrc`.
3. **No repo map.** Nothing says that editor code lives in `packages/excalidraw/`, app code in `excalidraw-app/`, and the docs source in `dev-docs/`.
4. **No pre-PR checklist.** The `.husky/pre-commit` hook is commented out, so nothing catches lint or format errors locally. The PR title check in `.github/workflows/semantic-pr-title.yml` is never mentioned.
5. **Quick start skips two requirements.** `packages/excalidraw/README.md` calls the CSS import and a container with height "easy-to-miss". Without them the canvas renders blank.

Lower priority: there is no License section, and no mention of Docker/self-hosting or `yarn start:example`.

## Wrong
1. **Line 66 says "circle".** The tool is called `ellipse` in `packages/common/src/constants.ts:537`.
2. **Lines 17–18 use `</br>`, which is invalid HTML.** Use `<br />`.
3. **Line 3 puts `alt` on `<source>`, which is not a valid attribute.** It belongs only on `<img>`.
4. **The feature list is stale.** It omits text, frames, embeds, laser pointer, elbow arrows, text-to-diagram, command palette and canvas search, all of which exist in the code.
5. **The linked Development Guide says `localhost:3000`.** `.env.development:30` sets `VITE_APP_PORT=3001`. The guide's source is `dev-docs/docs/introduction/development.mdx`.

## Unclear
1. **The "Quick start" heading (line 83) is ambiguous.** It is for npm integrators, but a contributor will read it as repo setup.
2. **Line 81 promises plugins with no date.** "We'll be adding these features as drop-in plugins… in the future" has no tracking link. Link an issue or delete the sentence.
3. **"Integrations" (lines 105–106) is muddled.** It lists the npm package as an integration and does not label the VS Code extension as third-party (publisher `pomdtr`).
4. **"Report here" (line 99) links to the issue list, not `/issues/new`.** The Contributing section also never mentions the roadmap or the "Easy" starter tasks.
5. **Wording needs four fixes:**
   - "following instructions" → "The following instructions"
   - "readonly" → "read-only"
   - "VScode" → "VS Code"
   - "Hand-drawn like style" → "Hand-drawn style"

All 40 README links resolve. npm returns 403 to curl because it blocks bots; the link is not dead.

## Edit 1: new section above line 97
````markdown
## Development

Requirements: Node.js 20 (minimum 18), Yarn 1.22 (classic), Git.

```bash
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
yarn
yarn start   # http://localhost:3001
```

| Path | What it is |
| --- | --- |
| `packages/excalidraw/` | The editor, published as `@excalidraw/excalidraw` |
| `packages/*` (others) | Internal packages: `common`, `element`, `math`, `utils`, … |
| `excalidraw-app/` | The excalidraw.com app (collab, sharing, PWA) |
| `examples/` | Integration examples (Next.js, browser script) |
| `dev-docs/` | Source of docs.excalidraw.com |

Before opening a PR:

```bash
yarn fix             # Prettier + ESLint autofix
yarn test:typecheck  # tsc
yarn test:update     # tests, updates snapshots
```

PR titles need a semantic prefix (`feat:`, `fix:`, `docs:`, …); CI checks this.
````

## Edit 2: Quick start (lines 83–95)
Rename the heading to `## Quick start (npm package)`. Add this after the install block:

````markdown
```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw />
    </div>
  );
}
```

The CSS import and a parent with non-zero height are both required; without them the canvas is blank.
````

## Edit 3: line fixes
| Line | Change |
| --- | --- |
| 3 | Remove `alt="Excalidraw"` from `<source>`. |
| 17–18 | Change `</br>` to `<br />`. |
| 58 | "Hand-drawn style." |
| 66 | "rectangle, ellipse, diamond, arrow, line, text, free-draw, frame, eraser, laser pointer…" |
| 67 | "Arrow-binding, elbow arrows & labeled arrows." |
| 79 | "read-only link" |
| 81 | Delete the sentence, or link a tracking issue. |
| 85 | "**Note:** The following instructions… To run this repo locally, see [Development](#development)." |
| 99 | Link to `https://github.com/excalidraw/excalidraw/issues/new`. |
| 100 | Append: "New here? Start with *Easy* tasks on the [roadmap](https://github.com/orgs/excalidraw/projects/3)." |
| 105 | "[VS Code extension](…) (community-maintained)". Delete line 106. |

Separately, the linked Development Guide also labels `yarn test:code` as Prettier when it actually runs ESLint. Want that guide audited next?

Next: paste Edit 1 into `README.md` above line 97.